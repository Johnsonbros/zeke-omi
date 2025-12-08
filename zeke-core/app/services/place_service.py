from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, func
import logging

from ..models.place import (
    PlaceDB,
    PlaceVisitDB,
    PlaceCreate,
    PlaceUpdate,
    PlaceResponse,
    PlaceVisitResponse,
    PlaceContext,
    PlaceCategory
)
from ..core.database import get_db_context
from .location_service import LocationService

logger = logging.getLogger(__name__)


class PlaceService:
    
    @staticmethod
    def _haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        distance_km = LocationService.haversine_distance(lat1, lon1, lat2, lon2)
        return distance_km * 1000
    
    async def set_current_place_cache(self, user_id: str, place_id: Optional[str], place_name: Optional[str]) -> None:
        """Cache the current place in Redis for fast access"""
        try:
            from ..core.redis import get_redis
            redis = await get_redis()
            key = f"current_place:{user_id}"
            if place_id:
                await redis.hset(key, mapping={"place_id": place_id, "place_name": place_name or ""})
                await redis.expire(key, 86400)
            else:
                await redis.delete(key)
        except Exception as e:
            logger.debug(f"Could not cache current place: {e}")

    async def get_current_place_from_cache(self, user_id: str) -> Optional[dict]:
        """Get current place from Redis cache"""
        try:
            from ..core.redis import get_redis
            redis = await get_redis()
            key = f"current_place:{user_id}"
            data = await redis.hgetall(key)
            if data and data.get("place_id"):
                return {"place_id": data["place_id"], "place_name": data.get("place_name", "")}
        except Exception as e:
            logger.debug(f"Could not get cached place: {e}")
        return None
    
    async def create_place(
        self,
        uid: str,
        name: str,
        latitude: float,
        longitude: float,
        radius_meters: float = 100.0,
        category: PlaceCategory = PlaceCategory.other,
        address: Optional[str] = None,
        is_auto_detected: bool = False,
        metadata_json: Optional[dict] = None
    ) -> PlaceResponse:
        with get_db_context() as db:
            place = PlaceDB(
                uid=uid,
                name=name,
                latitude=latitude,
                longitude=longitude,
                radius_meters=radius_meters,
                category=category.value if isinstance(category, PlaceCategory) else category,
                address=address,
                is_auto_detected=is_auto_detected,
                metadata_json=metadata_json
            )
            db.add(place)
            db.flush()
            db.refresh(place)
            
            return PlaceResponse.model_validate(place)
    
    async def update_place(
        self,
        place_id: str,
        updates: PlaceUpdate
    ) -> Optional[PlaceResponse]:
        with get_db_context() as db:
            place = db.query(PlaceDB).filter(PlaceDB.id == place_id).first()
            if not place:
                return None
            
            update_data = updates.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                if value is not None:
                    if key == "category" and isinstance(value, PlaceCategory):
                        value = value.value
                    setattr(place, key, value)
            
            db.flush()
            db.refresh(place)
            
            return PlaceResponse.model_validate(place)
    
    async def delete_place(self, place_id: str) -> bool:
        with get_db_context() as db:
            place = db.query(PlaceDB).filter(PlaceDB.id == place_id).first()
            if not place:
                return False
            
            db.delete(place)
            return True
    
    async def get_place(self, place_id: str) -> Optional[PlaceResponse]:
        with get_db_context() as db:
            place = db.query(PlaceDB).filter(PlaceDB.id == place_id).first()
            if place:
                return PlaceResponse.model_validate(place)
            return None
    
    async def list_places(
        self,
        uid: str,
        category: Optional[PlaceCategory] = None
    ) -> List[PlaceResponse]:
        with get_db_context() as db:
            query = db.query(PlaceDB).filter(PlaceDB.uid == uid)
            
            if category:
                cat_value = category.value if isinstance(category, PlaceCategory) else category
                query = query.filter(PlaceDB.category == cat_value)
            
            places = query.order_by(desc(PlaceDB.visit_count)).all()
            return [PlaceResponse.model_validate(p) for p in places]
    
    def is_at_place(self, lat: float, lon: float, place: PlaceDB) -> bool:
        distance_meters = self._haversine_distance_meters(lat, lon, place.latitude, place.longitude)
        return distance_meters <= place.radius_meters
    
    async def check_place_entry(
        self,
        uid: str,
        lat: float,
        lon: float
    ) -> Optional[PlaceResponse]:
        with get_db_context() as db:
            places = db.query(PlaceDB).filter(PlaceDB.uid == uid).all()
            
            for place in places:
                if self.is_at_place(lat, lon, place):
                    active_visit = db.query(PlaceVisitDB).filter(
                        and_(
                            PlaceVisitDB.uid == uid,
                            PlaceVisitDB.place_id == place.id,
                            PlaceVisitDB.exited_at.is_(None)
                        )
                    ).first()
                    
                    if not active_visit:
                        return PlaceResponse.model_validate(place)
            
            return None
    
    async def check_place_exit(
        self,
        uid: str,
        lat: float,
        lon: float
    ) -> Optional[PlaceResponse]:
        with get_db_context() as db:
            active_visit = db.query(PlaceVisitDB).filter(
                and_(
                    PlaceVisitDB.uid == uid,
                    PlaceVisitDB.exited_at.is_(None)
                )
            ).first()
            
            if not active_visit:
                return None
            
            place = db.query(PlaceDB).filter(PlaceDB.id == active_visit.place_id).first()
            if not place:
                return None
            
            if not self.is_at_place(lat, lon, place):
                return PlaceResponse.model_validate(place)
            
            return None
    
    async def record_visit(
        self,
        uid: str,
        place_id: str
    ) -> Optional[PlaceVisitResponse]:
        """Start a new visit to a place, closing any existing open visits first"""
        now = datetime.utcnow()
        
        with get_db_context() as db:
            place = db.query(PlaceDB).filter(PlaceDB.id == place_id).first()
            if not place:
                return None
            
            open_visits = db.query(PlaceVisitDB).filter(
                and_(
                    PlaceVisitDB.uid == uid,
                    PlaceVisitDB.exited_at.is_(None)
                )
            ).all()
            
            for open_visit in open_visits:
                open_visit.exited_at = now
                open_visit.dwell_minutes = int((now - open_visit.entered_at).total_seconds() / 60)
            
            existing_visit = db.query(PlaceVisitDB).filter(
                and_(
                    PlaceVisitDB.uid == uid,
                    PlaceVisitDB.place_id == place_id,
                    PlaceVisitDB.exited_at.is_(None)
                )
            ).first()
            
            if existing_visit:
                await self.set_current_place_cache(uid, place.id, place.name)
                return PlaceVisitResponse.model_validate(existing_visit)
            
            day_of_week = now.weekday()
            is_routine = self._is_routine_visit(db, uid, place_id, now)
            
            visit = PlaceVisitDB(
                uid=uid,
                place_id=place_id,
                entered_at=now,
                day_of_week=day_of_week,
                is_routine=is_routine
            )
            db.add(visit)
            
            place.visit_count += 1
            place.last_visited = now
            if not place.first_visited:
                place.first_visited = now
            
            db.flush()
            db.refresh(visit)
            
            await self.set_current_place_cache(uid, place.id, place.name)
            
            return PlaceVisitResponse.model_validate(visit)
    
    def _is_routine_visit(
        self,
        db: Session,
        uid: str,
        place_id: str,
        current_time: datetime
    ) -> bool:
        day_of_week = current_time.weekday()
        hour = current_time.hour
        
        two_weeks_ago = current_time - timedelta(days=14)
        
        similar_visits = db.query(PlaceVisitDB).filter(
            and_(
                PlaceVisitDB.uid == uid,
                PlaceVisitDB.place_id == place_id,
                PlaceVisitDB.day_of_week == day_of_week,
                PlaceVisitDB.entered_at >= two_weeks_ago
            )
        ).all()
        
        if len(similar_visits) < 2:
            return False
        
        for visit in similar_visits:
            visit_hour = visit.entered_at.hour
            if abs(visit_hour - hour) <= 2:
                return True
        
        return False
    
    async def end_visit(
        self,
        uid: str,
        place_id: str
    ) -> Optional[PlaceVisitResponse]:
        now = datetime.utcnow()
        
        with get_db_context() as db:
            visit = db.query(PlaceVisitDB).filter(
                and_(
                    PlaceVisitDB.uid == uid,
                    PlaceVisitDB.place_id == place_id,
                    PlaceVisitDB.exited_at.is_(None)
                )
            ).first()
            
            if not visit:
                return None
            
            visit.exited_at = now
            dwell_minutes = int((now - visit.entered_at).total_seconds() / 60)
            visit.dwell_minutes = dwell_minutes
            
            place = db.query(PlaceDB).filter(PlaceDB.id == place_id).first()
            if place:
                place.total_dwell_time_minutes += dwell_minutes
            
            db.flush()
            db.refresh(visit)
            
            await self.set_current_place_cache(uid, None, None)
            
            return PlaceVisitResponse.model_validate(visit)
    
    async def get_current_place(
        self,
        uid: str
    ) -> Optional[PlaceResponse]:
        cached = await self.get_current_place_from_cache(uid)
        if cached:
            place = await self.get_place(cached["place_id"])
            if place:
                return place
        
        with get_db_context() as db:
            active_visit = db.query(PlaceVisitDB).filter(
                and_(
                    PlaceVisitDB.uid == uid,
                    PlaceVisitDB.exited_at.is_(None)
                )
            ).order_by(desc(PlaceVisitDB.entered_at)).first()
            
            if not active_visit:
                return None
            
            place = db.query(PlaceDB).filter(PlaceDB.id == active_visit.place_id).first()
            if place:
                return PlaceResponse.model_validate(place)
            
            return None
    
    async def find_nearby_places(
        self,
        uid: str,
        lat: float,
        lon: float,
        max_distance_meters: float = 200.0
    ) -> List[PlaceResponse]:
        with get_db_context() as db:
            places = db.query(PlaceDB).filter(PlaceDB.uid == uid).all()
            
            nearby = []
            for place in places:
                distance = self._haversine_distance_meters(lat, lon, place.latitude, place.longitude)
                if distance <= max_distance_meters:
                    nearby.append((place, distance))
            
            nearby.sort(key=lambda x: x[1])
            
            return [PlaceResponse.model_validate(p) for p, _ in nearby]
    
    async def get_place_stats(self, place_id: str) -> Optional[dict]:
        with get_db_context() as db:
            place = db.query(PlaceDB).filter(PlaceDB.id == place_id).first()
            if not place:
                return None
            
            visits = db.query(PlaceVisitDB).filter(
                PlaceVisitDB.place_id == place_id
            ).all()
            
            completed_visits = [v for v in visits if v.dwell_minutes is not None]
            avg_dwell = 0
            if completed_visits:
                avg_dwell = sum(v.dwell_minutes for v in completed_visits) / len(completed_visits)
            
            day_counts = {}
            hour_counts = {}
            for visit in visits:
                day = visit.day_of_week
                day_counts[day] = day_counts.get(day, 0) + 1
                
                hour = visit.entered_at.hour
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
            
            common_days = sorted(day_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            common_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            return {
                "place_id": place_id,
                "name": place.name,
                "category": place.category,
                "visit_count": place.visit_count,
                "total_dwell_time_minutes": place.total_dwell_time_minutes,
                "average_dwell_minutes": round(avg_dwell, 1),
                "first_visited": place.first_visited,
                "last_visited": place.last_visited,
                "common_days": [(day_names[d], c) for d, c in common_days],
                "common_hours": [(f"{h:02d}:00", c) for h, c in common_hours],
                "routine_visit_percentage": (
                    sum(1 for v in visits if v.is_routine) / len(visits) * 100 if visits else 0
                )
            }
    
    async def get_most_visited_places(
        self,
        uid: str,
        limit: int = 10
    ) -> List[PlaceResponse]:
        with get_db_context() as db:
            places = db.query(PlaceDB).filter(
                PlaceDB.uid == uid
            ).order_by(desc(PlaceDB.visit_count)).limit(limit).all()
            
            return [PlaceResponse.model_validate(p) for p in places]
    
    async def get_place_context(
        self,
        uid: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None
    ) -> PlaceContext:
        current_place = await self.get_current_place(uid)
        
        nearby_places = []
        if lat is not None and lon is not None:
            nearby_places = await self.find_nearby_places(uid, lat, lon)
        
        time_at_place = None
        if current_place:
            with get_db_context() as db:
                active_visit = db.query(PlaceVisitDB).filter(
                    and_(
                        PlaceVisitDB.uid == uid,
                        PlaceVisitDB.place_id == current_place.id,
                        PlaceVisitDB.exited_at.is_(None)
                    )
                ).first()
                
                if active_visit:
                    time_at_place = int((datetime.utcnow() - active_visit.entered_at).total_seconds() / 60)
        
        typical_place = await self._get_typical_place_for_time(uid, datetime.utcnow())
        
        return PlaceContext(
            current_place=current_place,
            is_at_known_place=current_place is not None,
            place_category=current_place.category if current_place else None,
            time_at_current_place_minutes=time_at_place,
            nearby_places=nearby_places,
            typical_place_for_time=typical_place
        )
    
    async def _get_typical_place_for_time(
        self,
        uid: str,
        current_time: datetime
    ) -> Optional[str]:
        day_of_week = current_time.weekday()
        hour = current_time.hour
        
        with get_db_context() as db:
            four_weeks_ago = current_time - timedelta(days=28)
            
            visits = db.query(PlaceVisitDB).filter(
                and_(
                    PlaceVisitDB.uid == uid,
                    PlaceVisitDB.day_of_week == day_of_week,
                    PlaceVisitDB.entered_at >= four_weeks_ago
                )
            ).all()
            
            place_counts = {}
            for visit in visits:
                visit_hour = visit.entered_at.hour
                if abs(visit_hour - hour) <= 1:
                    place_counts[visit.place_id] = place_counts.get(visit.place_id, 0) + 1
            
            if not place_counts:
                return None
            
            most_common_place_id = max(place_counts, key=place_counts.get)
            place = db.query(PlaceDB).filter(PlaceDB.id == most_common_place_id).first()
            
            return place.name if place else None
