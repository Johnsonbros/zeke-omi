from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import and_
import logging
import os

from ..services.location_service import LocationService
from ..services.place_service import PlaceService
from ..models.location import (
    OverlandPayload, 
    LocationResponse, 
    LocationContext
)
from ..models.place import PlaceCategory
from ..models.task import TaskDB
from ..core.config import get_settings
from ..core.database import get_db_context

router = APIRouter(prefix="/overland", tags=["overland"], redirect_slashes=False)
logger = logging.getLogger(__name__)
settings = get_settings()

_home_place_checked = False


class OverlandResponse(BaseModel):
    result: str


class LocationHistoryRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    motion_filter: Optional[str] = None
    limit: int = 100


def get_location_service() -> LocationService:
    return LocationService()


def get_place_service() -> PlaceService:
    return PlaceService()


async def ensure_home_place_exists(place_service: PlaceService, user_id: str):
    global _home_place_checked
    
    if _home_place_checked:
        return
    
    home_location = os.environ.get("HOME_LOCATION")
    if not home_location:
        _home_place_checked = True
        return
    
    try:
        parts = home_location.split(",")
        if len(parts) != 2:
            logger.warning(f"Invalid HOME_LOCATION format (expected 'lat,lon'): {home_location}")
            _home_place_checked = True
            return
        
        home_lat = float(parts[0].strip())
        home_lon = float(parts[1].strip())
        
        existing_places = await place_service.list_places(uid=user_id)
        home_exists = any(p.name.lower() == "home" for p in existing_places)
        
        if not home_exists:
            await place_service.create_place(
                uid=user_id,
                name="Home",
                latitude=home_lat,
                longitude=home_lon,
                radius_meters=100.0,
                category=PlaceCategory.home,
                is_auto_detected=True
            )
            logger.info(f"Auto-created Home place at ({home_lat}, {home_lon})")
        
        _home_place_checked = True
        
    except Exception as e:
        logger.error(f"Error checking/creating Home place: {e}")
        _home_place_checked = True


async def check_location_triggered_tasks(user_id: str, place_id: str, trigger_type: str):
    """Check and trigger location-based task reminders"""
    try:
        with get_db_context() as db:
            if trigger_type == "arrival":
                tasks = db.query(TaskDB).filter(
                    and_(
                        TaskDB.uid == user_id,
                        TaskDB.place_id == place_id,
                        TaskDB.trigger_on_arrival == True,
                        TaskDB.status == "pending",
                        TaskDB.location_triggered == False
                    )
                ).all()
            else:
                tasks = db.query(TaskDB).filter(
                    and_(
                        TaskDB.uid == user_id,
                        TaskDB.place_id == place_id,
                        TaskDB.trigger_on_departure == True,
                        TaskDB.status == "pending",
                        TaskDB.location_triggered == False
                    )
                ).all()
            
            for task in tasks:
                task.location_triggered = True
                logger.info(f"Location triggered task: {task.title} ({trigger_type} at place {place_id})")
                
    except Exception as e:
        logger.error(f"Error checking location triggers: {e}")


async def process_place_detection(
    place_service: PlaceService,
    user_id: str,
    lat: float,
    lon: float
):
    try:
        exited_place = await place_service.check_place_exit(
            uid=user_id,
            lat=lat,
            lon=lon
        )
        
        if exited_place:
            await place_service.end_visit(
                uid=user_id,
                place_id=exited_place.id
            )
            logger.info(f"User exited place: {exited_place.name}")
            await check_location_triggered_tasks(user_id, exited_place.id, "departure")
        
        entered_place = await place_service.check_place_entry(
            uid=user_id,
            lat=lat,
            lon=lon
        )
        
        if entered_place:
            await place_service.record_visit(
                uid=user_id,
                place_id=entered_place.id
            )
            logger.info(f"User entered place: {entered_place.name}")
            await check_location_triggered_tasks(user_id, entered_place.id, "arrival")
            
    except Exception as e:
        logger.error(f"Error during place detection: {e}")


def verify_overland_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    expected_token = getattr(settings, 'overland_api_key', None)
    
    if not expected_token:
        if getattr(settings, 'debug', False):
            logger.warning("Overland API key not configured - endpoint is unauthenticated in debug mode")
            return None
        else:
            logger.error("Overland API key not configured - rejecting request in production")
            raise HTTPException(status_code=503, detail="GPS tracking endpoint not configured")
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    if authorization.startswith("Bearer "):
        token = authorization[7:]
    else:
        token = authorization
    
    if token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    
    return token


@router.post("/", response_model=OverlandResponse)
@router.post("", response_model=OverlandResponse, include_in_schema=False)
async def receive_overland_data(
    request: Request,
    authorization: Optional[str] = Header(None),
    location_service: LocationService = Depends(get_location_service),
    place_service: PlaceService = Depends(get_place_service)
):
    verify_overland_token(authorization)
    
    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Overland request body: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    try:
        payload = OverlandPayload(**body)
    except Exception as e:
        logger.error(f"Failed to validate Overland payload: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid payload structure: {e}")
    
    user_id = "default_user"
    device_id = None
    
    if payload.locations:
        first_loc = payload.locations[0]
        if isinstance(first_loc, dict):
            props = first_loc.get("properties", {})
            device_id = props.get("device_id")
    
    locations_stored = await location_service.process_overland_batch(
        user_id=user_id,
        payload=payload,
        device_id=device_id
    )
    
    logger.info(f"Received Overland batch: {len(payload.locations)} locations, stored {locations_stored}")
    
    try:
        await ensure_home_place_exists(place_service, user_id)
        
        if payload.locations:
            last_loc = payload.locations[-1]
            if isinstance(last_loc, dict):
                geometry = last_loc.get("geometry", {})
                coords = geometry.get("coordinates", [])
                if len(coords) >= 2:
                    lon, lat = coords[0], coords[1]
                    await process_place_detection(
                        place_service=place_service,
                        user_id=user_id,
                        lat=lat,
                        lon=lon
                    )
    except Exception as e:
        logger.error(f"Place detection error (non-blocking): {e}")
    
    return OverlandResponse(result="ok")


@router.get("/current", response_model=Optional[LocationResponse])
async def get_current_location(
    location_service: LocationService = Depends(get_location_service)
):
    location = await location_service.get_current("default_user")
    if not location:
        raise HTTPException(status_code=404, detail="No location data available")
    return location


@router.get("/context", response_model=Optional[LocationContext])
async def get_location_context(
    location_service: LocationService = Depends(get_location_service)
):
    context = await location_service.get_location_context("default_user")
    if not context:
        raise HTTPException(status_code=404, detail="No location context available")
    return context


@router.get("/recent", response_model=List[LocationResponse])
async def get_recent_locations(
    hours: int = 24,
    limit: int = 100,
    location_service: LocationService = Depends(get_location_service)
):
    locations = await location_service.get_recent(
        user_id="default_user",
        hours=hours,
        limit=limit
    )
    return locations


@router.post("/history", response_model=List[LocationResponse])
async def get_location_history(
    request: LocationHistoryRequest,
    location_service: LocationService = Depends(get_location_service)
):
    locations = await location_service.get_location_history(
        user_id="default_user",
        start_date=request.start_date,
        end_date=request.end_date,
        motion_filter=request.motion_filter,
        limit=request.limit
    )
    return locations


@router.get("/summary")
async def get_motion_summary(
    hours: int = 24,
    location_service: LocationService = Depends(get_location_service)
):
    summary = await location_service.get_motion_summary(
        user_id="default_user",
        hours=hours
    )
    return summary


@router.delete("/cleanup")
async def cleanup_old_locations(
    days_to_keep: int = 90,
    location_service: LocationService = Depends(get_location_service)
):
    deleted_count = await location_service.delete_old_locations(
        user_id="default_user",
        days_to_keep=days_to_keep
    )
    return {"deleted": deleted_count, "days_to_keep": days_to_keep}
