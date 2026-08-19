from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.enums import RequestOverallStatus, CollaborationStatus, EstimatedDurationUnit


class CollaborationRequest(Base):
    __tablename__ = "collaboration_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    external_user_id = Column(String(100), nullable=False, index=True)
    service_category_id = Column(Integer, ForeignKey("service_categories.id"), nullable=False)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    requirement_details = Column(String(1000), nullable=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    area = Column(String(100), nullable=True, index=True)
    income = Column(Float, nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit = Column(String(50), nullable=False)
    status = Column(
        SQLEnum(RequestOverallStatus),
        default=RequestOverallStatus.OPEN,
        nullable=False,
        index=True
    )
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    service_category = relationship("ServiceCategory", back_populates="collaboration_requests")
    requirement = relationship("Requirement", back_populates="collaboration_requests")
    collaborations = relationship("Collaboration", back_populates="request", cascade="all, delete-orphan")


class Collaboration(Base):
    __tablename__ = "collaborations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("collaboration_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(
        SQLEnum(CollaborationStatus),
        default=CollaborationStatus.REQUESTED,
        nullable=False,
        index=True
    )
    matched_score = Column(Float, default=0.0, nullable=False)
    matched_reasons = Column(Text, nullable=True)  # JSON string array of explanation reasons
    requested_quantity = Column(Integer, default=1, nullable=False)
    accepted_quantity = Column(Integer, default=0, nullable=False)
    estimated_duration_value = Column(Integer, nullable=True)
    estimated_duration_unit = Column(SQLEnum(EstimatedDurationUnit), nullable=True)
    response_message = Column(String(1000), nullable=True)
    rejection_reason = Column(String(1000), nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    request = relationship("CollaborationRequest", back_populates="collaborations")
    ngo = relationship("NGO", back_populates="collaborations")
    status_history = relationship("RequestStatusHistory", back_populates="collaboration", cascade="all, delete-orphan")
    contribution = relationship("Contribution", back_populates="collaboration", uselist=False)


class RequestStatusHistory(Base):
    __tablename__ = "request_status_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    collaboration_id = Column(Integer, ForeignKey("collaborations.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SQLEnum(CollaborationStatus), nullable=False)
    remarks = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    collaboration = relationship("Collaboration", back_populates="status_history")
