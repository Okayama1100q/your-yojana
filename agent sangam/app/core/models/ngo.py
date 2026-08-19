from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.enums import RegistrationStatus, EstimatedDurationUnit


class NGO(Base):
    __tablename__ = "ngos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ngo_code = Column(String(50), unique=True, nullable=False, index=True)
    ngo_name = Column(String(200), nullable=False, index=True)
    registration_number = Column(String(100), unique=True, nullable=False)
    contact_person = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    address = Column(String(300), nullable=False)
    description = Column(String(1000), nullable=True)
    registration_status = Column(
        SQLEnum(RegistrationStatus),
        default=RegistrationStatus.PENDING,
        nullable=False,
        index=True
    )
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    services = relationship("NGOService", back_populates="ngo", cascade="all, delete-orphan")
    coverage = relationship("NGOCoverage", back_populates="ngo", cascade="all, delete-orphan")
    collaborations = relationship("Collaboration", back_populates="ngo", cascade="all, delete-orphan")
    contributions = relationship("Contribution", back_populates="ngo", cascade="all, delete-orphan")


class NGOService(Base):
    __tablename__ = "ngo_services"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False, index=True)
    service_category_id = Column(Integer, ForeignKey("service_categories.id", ondelete="CASCADE"), nullable=False)
    requirement_id = Column(Integer, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False)
    available_quantity = Column(Integer, default=0, nullable=False)
    unit = Column(String(50), nullable=False)
    estimated_duration_value = Column(Integer, default=1, nullable=False)
    estimated_duration_unit = Column(SQLEnum(EstimatedDurationUnit), default=EstimatedDurationUnit.DAYS, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    ngo = relationship("NGO", back_populates="services")
    service_category = relationship("ServiceCategory", back_populates="ngo_services")
    requirement = relationship("Requirement", back_populates="ngo_services")


class NGOCoverage(Base):
    __tablename__ = "ngo_coverage"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    area = Column(String(100), nullable=True, index=True)
    active = Column(Boolean, default=True, nullable=False)

    # Relationships
    ngo = relationship("NGO", back_populates="coverage")
