from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    requirements = relationship("Requirement", back_populates="service_category", cascade="all, delete-orphan")
    ngo_services = relationship("NGOService", back_populates="service_category")
    collaboration_requests = relationship("CollaborationRequest", back_populates="service_category")


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    service_category_id = Column(Integer, ForeignKey("service_categories.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("service_category_id", "code", name="uq_category_requirement_code"),
    )

    # Relationships
    service_category = relationship("ServiceCategory", back_populates="requirements")
    ngo_services = relationship("NGOService", back_populates="requirement")
    collaboration_requests = relationship("CollaborationRequest", back_populates="requirement")
    contributions = relationship("Contribution", back_populates="requirement")
