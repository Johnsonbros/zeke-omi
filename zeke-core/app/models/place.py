from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, Text, Float, DateTime, Boolean, JSON, Integer, ForeignKey, Index
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from enum import Enum

from .base import Base, TimestampMixin, UUIDMixin


class PlaceCategory(str, Enum):
    home = "home"
    work = "work"
    school = "school"
    gym = "gym"
    restaurant = "restaurant"
    shopping = "shopping"
    medical = "medical"
    family = "family"
    friend = "friend"
    other = "other"


class PlaceDB(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "places"
    
    uid: str = Column(String(64), nullable=False, index=True)
    name: str = Column(String(255), nullable=False)
    
    latitude: float = Column(Float, nullable=False)
    longitude: float = Column(Float, nullable=False)
    radius_meters: float = Column(Float, default=100.0)
    
    category: str = Column(String(32), default="other")
    address: Optional[str] = Column(String(512), nullable=True)
    
    is_auto_detected: bool = Column(Boolean, default=False)
    is_confirmed: bool = Column(Boolean, default=False)
    
    visit_count: int = Column(Integer, default=0)
    total_dwell_time_minutes: int = Column(Integer, default=0)
    
    first_visited: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    last_visited: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    
    metadata_json: Optional[dict] = Column(JSON, nullable=True)
    
    visits = relationship("PlaceVisitDB", back_populates="place", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_places_uid_category', 'uid', 'category'),
        Index('ix_places_uid_name', 'uid', 'name'),
    )


class PlaceVisitDB(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "place_visits"
    
    uid: str = Column(String(64), nullable=False, index=True)
    place_id: str = Column(String(36), ForeignKey("places.id", ondelete="CASCADE"), nullable=False, index=True)
    
    entered_at: datetime = Column(DateTime(timezone=True), nullable=False)
    exited_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    
    dwell_minutes: Optional[int] = Column(Integer, nullable=True)
    day_of_week: int = Column(Integer, nullable=False)
    is_routine: bool = Column(Boolean, default=False)
    
    place = relationship("PlaceDB", back_populates="visits")
    
    __table_args__ = (
        Index('ix_place_visits_uid_place_id', 'uid', 'place_id'),
        Index('ix_place_visits_entered_at', 'entered_at'),
    )


class PlaceCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    radius_meters: float = 100.0
    category: PlaceCategory = PlaceCategory.other
    address: Optional[str] = None
    is_auto_detected: bool = False
    metadata_json: Optional[dict] = None


class PlaceUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: Optional[float] = None
    category: Optional[PlaceCategory] = None
    address: Optional[str] = None
    is_confirmed: Optional[bool] = None
    metadata_json: Optional[dict] = None


class PlaceResponse(BaseModel):
    id: str
    uid: str
    name: str
    latitude: float
    longitude: float
    radius_meters: float
    category: str
    address: Optional[str] = None
    is_auto_detected: bool
    is_confirmed: bool
    visit_count: int
    total_dwell_time_minutes: int
    first_visited: Optional[datetime] = None
    last_visited: Optional[datetime] = None
    metadata_json: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PlaceVisitResponse(BaseModel):
    id: str
    uid: str
    place_id: str
    entered_at: datetime
    exited_at: Optional[datetime] = None
    dwell_minutes: Optional[int] = None
    day_of_week: int
    is_routine: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PlaceContext(BaseModel):
    current_place: Optional[PlaceResponse] = None
    is_at_known_place: bool = False
    place_category: Optional[str] = None
    time_at_current_place_minutes: Optional[int] = None
    nearby_places: List[PlaceResponse] = Field(default_factory=list)
    most_visited_today: Optional[str] = None
    typical_place_for_time: Optional[str] = None
