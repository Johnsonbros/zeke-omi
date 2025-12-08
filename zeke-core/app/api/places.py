from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
import logging

from ..services.place_service import PlaceService
from ..models.place import (
    PlaceCreate,
    PlaceUpdate,
    PlaceResponse,
    PlaceVisitResponse,
    PlaceCategory,
    PlaceContext
)
from ..core.database import get_db_context
from ..models.place import PlaceVisitDB

router = APIRouter()
logger = logging.getLogger(__name__)

USER_ID = "default_user"


def get_place_service() -> PlaceService:
    return PlaceService()


@router.post("/", response_model=PlaceResponse)
async def create_place(
    place_data: PlaceCreate,
    place_service: PlaceService = Depends(get_place_service)
):
    place = await place_service.create_place(
        uid=USER_ID,
        name=place_data.name,
        latitude=place_data.latitude,
        longitude=place_data.longitude,
        radius_meters=place_data.radius_meters,
        category=place_data.category,
        address=place_data.address,
        is_auto_detected=place_data.is_auto_detected,
        metadata_json=place_data.metadata_json
    )
    logger.info(f"Created place: {place.name} (id={place.id})")
    return place


@router.get("/", response_model=List[PlaceResponse])
async def list_places(
    category: Optional[PlaceCategory] = None,
    place_service: PlaceService = Depends(get_place_service)
):
    places = await place_service.list_places(
        uid=USER_ID,
        category=category
    )
    return places


@router.get("/current", response_model=Optional[PlaceResponse])
async def get_current_place(
    place_service: PlaceService = Depends(get_place_service)
):
    place = await place_service.get_current_place(uid=USER_ID)
    return place


@router.get("/nearby", response_model=List[PlaceResponse])
async def find_nearby_places(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    max_distance: float = Query(200.0, description="Maximum distance in meters"),
    place_service: PlaceService = Depends(get_place_service)
):
    places = await place_service.find_nearby_places(
        uid=USER_ID,
        lat=lat,
        lon=lon,
        max_distance_meters=max_distance
    )
    return places


@router.get("/most-visited", response_model=List[PlaceResponse])
async def get_most_visited_places(
    limit: int = Query(10, ge=1, le=50, description="Number of places to return"),
    place_service: PlaceService = Depends(get_place_service)
):
    places = await place_service.get_most_visited_places(
        uid=USER_ID,
        limit=limit
    )
    return places


@router.get("/context", response_model=PlaceContext)
async def get_place_context(
    lat: Optional[float] = Query(None, description="Current latitude"),
    lon: Optional[float] = Query(None, description="Current longitude"),
    place_service: PlaceService = Depends(get_place_service)
):
    context = await place_service.get_place_context(
        uid=USER_ID,
        lat=lat,
        lon=lon
    )
    return context


@router.get("/discover")
async def discover_places(
    min_visits: int = Query(3, ge=1, description="Minimum visits to consider a location"),
    days_back: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    place_service: PlaceService = Depends(get_place_service)
):
    """Discover frequently visited locations that aren't saved as places."""
    suggestions = await place_service.discover_frequent_locations(
        uid=USER_ID,
        min_visits=min_visits,
        days_back=days_back
    )
    return suggestions


@router.post("/discover/confirm", response_model=PlaceResponse)
async def confirm_discovered_place(
    request: PlaceCreate,
    place_service: PlaceService = Depends(get_place_service)
):
    """Confirm a discovered location as a saved place."""
    place = await place_service.confirm_discovered_place(
        uid=USER_ID,
        latitude=request.latitude,
        longitude=request.longitude,
        name=request.name,
        category=request.category.value if hasattr(request.category, 'value') else request.category
    )
    logger.info(f"Confirmed discovered place: {place.name} (id={place.id})")
    return place


@router.get("/routines")
async def get_routines(
    days_back: int = Query(28, ge=7, le=365, description="Number of days to analyze"),
    place_service: PlaceService = Depends(get_place_service)
):
    """Get detected routines based on visit patterns."""
    routines = await place_service.get_routines(uid=USER_ID, days_back=days_back)
    return routines


@router.get("/routines/deviation")
async def check_routine_deviation(
    place_service: PlaceService = Depends(get_place_service)
):
    """Check if user is deviating from their typical routine."""
    deviation = await place_service.check_routine_deviation(uid=USER_ID)
    return deviation or {"is_deviation": False}


@router.get("/{place_id}", response_model=PlaceResponse)
async def get_place(
    place_id: str,
    place_service: PlaceService = Depends(get_place_service)
):
    place = await place_service.get_place(place_id=place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return place


@router.put("/{place_id}", response_model=PlaceResponse)
async def update_place(
    place_id: str,
    updates: PlaceUpdate,
    place_service: PlaceService = Depends(get_place_service)
):
    place = await place_service.update_place(
        place_id=place_id,
        updates=updates
    )
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    logger.info(f"Updated place: {place.name} (id={place.id})")
    return place


@router.delete("/{place_id}")
async def delete_place(
    place_id: str,
    place_service: PlaceService = Depends(get_place_service)
):
    deleted = await place_service.delete_place(place_id=place_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Place not found")
    logger.info(f"Deleted place: {place_id}")
    return {"message": "Place deleted successfully", "place_id": place_id}


@router.get("/{place_id}/stats")
async def get_place_stats(
    place_id: str,
    place_service: PlaceService = Depends(get_place_service)
):
    stats = await place_service.get_place_stats(place_id=place_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Place not found")
    return stats


@router.get("/{place_id}/visits", response_model=List[PlaceVisitResponse])
async def get_place_visits(
    place_id: str,
    limit: int = Query(50, ge=1, le=200, description="Number of visits to return")
):
    with get_db_context() as db:
        visits = db.query(PlaceVisitDB).filter(
            PlaceVisitDB.place_id == place_id
        ).order_by(PlaceVisitDB.entered_at.desc()).limit(limit).all()
        
        if not visits:
            place_exists = db.query(PlaceVisitDB).filter(
                PlaceVisitDB.place_id == place_id
            ).first()
            from ..models.place import PlaceDB
            place_exists = db.query(PlaceDB).filter(PlaceDB.id == place_id).first()
            if not place_exists:
                raise HTTPException(status_code=404, detail="Place not found")
        
        return [PlaceVisitResponse.model_validate(v) for v in visits]
