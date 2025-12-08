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

    async def discover_frequent_locations(
        self,
        uid: str,
        min_visits: int = 3,
        cluster_radius_meters: float = 100.0,
        days_back: int = 30
    ) -> List[dict]:
        """
        Analyze location history to find frequently visited spots that aren't saved places.
        First aggregates GPS pings into distinct visits (dwell sessions), then clusters locations.
        Returns list of suggested places with actual visit counts (not raw GPS pings).
        """
        from ..models.location import LocationDB
        
        with get_db_context() as db:
            cutoff = datetime.utcnow() - timedelta(days=days_back)
            locations = db.query(LocationDB).filter(
                and_(
                    LocationDB.uid == uid,
                    LocationDB.timestamp >= cutoff,
                    LocationDB.speed < 2.0
                )
            ).order_by(LocationDB.timestamp).all()
            
            if not locations:
                return []
            
            existing_places = db.query(PlaceDB).filter(PlaceDB.uid == uid).all()
            
            # Step 1: Aggregate consecutive GPS pings into distinct visits/dwell sessions
            # A visit ends if next ping is >30 min later OR >500m away
            dwell_sessions = []
            current_session = None
            session_gap_minutes = 30
            session_gap_meters = 500
            
            for loc in locations:
                # Skip if near existing place
                near_existing = False
                for place in existing_places:
                    dist = self._haversine_distance_meters(
                        loc.latitude, loc.longitude,
                        place.latitude, place.longitude
                    )
                    if dist <= place.radius_meters:
                        near_existing = True
                        break
                
                if near_existing:
                    # End current session if exists
                    if current_session:
                        dwell_sessions.append(current_session)
                        current_session = None
                    continue
                
                if current_session is None:
                    # Start new session
                    current_session = {
                        "points": [(loc.latitude, loc.longitude)],
                        "start_time": loc.timestamp,
                        "end_time": loc.timestamp
                    }
                else:
                    # Check if this point continues the session or starts a new one
                    time_gap = (loc.timestamp - current_session["end_time"]).total_seconds() / 60
                    avg_lat = sum(p[0] for p in current_session["points"]) / len(current_session["points"])
                    avg_lon = sum(p[1] for p in current_session["points"]) / len(current_session["points"])
                    dist = self._haversine_distance_meters(loc.latitude, loc.longitude, avg_lat, avg_lon)
                    
                    if time_gap > session_gap_minutes or dist > session_gap_meters:
                        # End current session, start new one
                        dwell_sessions.append(current_session)
                        current_session = {
                            "points": [(loc.latitude, loc.longitude)],
                            "start_time": loc.timestamp,
                            "end_time": loc.timestamp
                        }
                    else:
                        # Continue session
                        current_session["points"].append((loc.latitude, loc.longitude))
                        current_session["end_time"] = loc.timestamp
            
            # Don't forget last session
            if current_session:
                dwell_sessions.append(current_session)
            
            if not dwell_sessions:
                return []
            
            # Step 2: Cluster dwell sessions by location
            clusters = []
            used_sessions = set()
            
            for i, session in enumerate(dwell_sessions):
                if i in used_sessions:
                    continue
                
                # Calculate session centroid
                s_lat = sum(p[0] for p in session["points"]) / len(session["points"])
                s_lon = sum(p[1] for p in session["points"]) / len(session["points"])
                
                # Find all sessions near this location
                cluster_sessions = [session]
                cluster_hours = [session["start_time"].hour]
                used_sessions.add(i)
                
                for j, other in enumerate(dwell_sessions):
                    if j in used_sessions:
                        continue
                    
                    o_lat = sum(p[0] for p in other["points"]) / len(other["points"])
                    o_lon = sum(p[1] for p in other["points"]) / len(other["points"])
                    
                    dist = self._haversine_distance_meters(s_lat, s_lon, o_lat, o_lon)
                    if dist <= cluster_radius_meters:
                        cluster_sessions.append(other)
                        cluster_hours.append(other["start_time"].hour)
                        used_sessions.add(j)
                
                # Count distinct visits (sessions), not GPS pings
                visit_count = len(cluster_sessions)
                
                if visit_count >= min_visits:
                    # Calculate centroid of all session centroids
                    all_centroids = []
                    for sess in cluster_sessions:
                        c_lat = sum(p[0] for p in sess["points"]) / len(sess["points"])
                        c_lon = sum(p[1] for p in sess["points"]) / len(sess["points"])
                        all_centroids.append((c_lat, c_lon))
                    
                    avg_lat = sum(c[0] for c in all_centroids) / len(all_centroids)
                    avg_lon = sum(c[1] for c in all_centroids) / len(all_centroids)
                    
                    suggested_category = self._suggest_category_from_times(cluster_hours)
                    
                    clusters.append({
                        "latitude": round(avg_lat, 6),
                        "longitude": round(avg_lon, 6),
                        "visit_count": visit_count,
                        "suggested_category": suggested_category,
                        "first_seen": min(s["start_time"] for s in cluster_sessions).isoformat(),
                        "last_seen": max(s["end_time"] for s in cluster_sessions).isoformat()
                    })
            
            clusters.sort(key=lambda x: x["visit_count"], reverse=True)
            return clusters[:10]

    def _suggest_category_from_times(self, hours: List[int]) -> str:
        """Suggest a category based on visit times."""
        avg_hour = sum(hours) / len(hours) if hours else 12
        
        if 6 <= avg_hour <= 10:
            return "work"
        elif 11 <= avg_hour <= 14:
            return "restaurant"
        elif 9 <= avg_hour <= 17:
            return "work"
        elif 17 <= avg_hour <= 21:
            return "restaurant"
        else:
            return "home"

    async def confirm_discovered_place(
        self,
        uid: str,
        latitude: float,
        longitude: float,
        name: str,
        category: str = "other"
    ) -> PlaceResponse:
        """Confirm a discovered location as a saved place."""
        return await self.create_place(
            uid=uid,
            name=name,
            latitude=latitude,
            longitude=longitude,
            radius_meters=100.0,
            category=PlaceCategory(category) if category in PlaceCategory.__members__ else PlaceCategory.other,
            is_auto_detected=True
        )

    async def get_routines(
        self,
        uid: str,
        days_back: int = 28
    ) -> List[dict]:
        """
        Analyze visit patterns to identify routines.
        Returns list of detected routines with place, typical day/time, and confidence.
        """
        with get_db_context() as db:
            cutoff = datetime.utcnow() - timedelta(days=days_back)
            
            visits = db.query(PlaceVisitDB, PlaceDB).join(
                PlaceDB, PlaceVisitDB.place_id == PlaceDB.id
            ).filter(
                and_(
                    PlaceVisitDB.uid == uid,
                    PlaceVisitDB.entered_at >= cutoff
                )
            ).all()
            
            if not visits:
                return []
            
            patterns = {}
            place_names = {}
            
            for visit, place in visits:
                place_id = place.id
                place_names[place_id] = place.name
                
                if place_id not in patterns:
                    patterns[place_id] = {}
                
                day = visit.day_of_week
                hour = visit.entered_at.hour
                
                if day not in patterns[place_id]:
                    patterns[place_id][day] = {}
                
                patterns[place_id][day][hour] = patterns[place_id][day].get(hour, 0) + 1
            
            routines = []
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            for place_id, day_patterns in patterns.items():
                for day, hour_patterns in day_patterns.items():
                    for hour, count in hour_patterns.items():
                        if count >= 2:
                            weeks = days_back // 7
                            confidence = min(count / weeks, 1.0)
                            
                            routines.append({
                                "place_id": place_id,
                                "place_name": place_names[place_id],
                                "day": day_names[day],
                                "day_number": day,
                                "hour": hour,
                                "time_display": f"{hour:02d}:00",
                                "occurrence_count": count,
                                "confidence": round(confidence, 2),
                                "description": f"Usually at {place_names[place_id]} on {day_names[day]}s around {hour:02d}:00"
                            })
            
            routines.sort(key=lambda x: (x["confidence"], x["occurrence_count"]), reverse=True)
            return routines

    async def check_routine_deviation(
        self,
        uid: str
    ) -> Optional[dict]:
        """
        Check if the user is deviating from their typical routine right now.
        Returns deviation info if user should be somewhere else.
        """
        now = datetime.utcnow()
        day_of_week = now.weekday()
        current_hour = now.hour
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        typical_place = await self._get_typical_place_for_time(uid, now)
        
        if not typical_place:
            return None
        
        current_place = await self.get_current_place(uid)
        current_name = current_place.name if current_place else None
        
        if current_name == typical_place:
            return None
        
        return {
            "is_deviation": True,
            "typical_place": typical_place,
            "current_place": current_name,
            "expected_time": f"{current_hour:02d}:00",
            "day": day_names[day_of_week],
            "message": f"You're usually at {typical_place} around this time on {day_names[day_of_week]}s"
        }
