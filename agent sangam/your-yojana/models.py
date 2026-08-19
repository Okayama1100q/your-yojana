from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, Float, DateTime

from database import Base


class Complaint(Base):

    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)

    complaint_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    description = Column(Text, nullable=False)

    location = Column(String, default="")

    category = Column(String, default="General")

    priority = Column(String, default="LOW")

    priority_score = Column(Float, default=0)

    priority_reasons = Column(Text, default="")

    department = Column(String, default="")

    status = Column(String, default="PENDING")

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )