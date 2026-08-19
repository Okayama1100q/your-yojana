from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False, index=True)
    collaboration_id = Column(Integer, ForeignKey("collaborations.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    quantity_provided = Column(Integer, nullable=False)
    unit = Column(String(50), nullable=False)
    beneficiaries_helped = Column(Integer, default=1, nullable=False)
    completed_on_time = Column(Boolean, default=True, nullable=False)
    completed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    ngo = relationship("NGO", back_populates="contributions")
    collaboration = relationship("Collaboration", back_populates="contribution")
    requirement = relationship("Requirement", back_populates="contributions")
