import json
import os
import threading
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Complaint

from agents.complaint_agent import understand_complaint, warmup as warmup_groq
from agents.priority_agent import prioritize_complaint
from agents.routing_agent import route_complaint
from agents.vision_agent import (
    assess_civic_images,
    enrich_complaint_with_vision,
)


# --------------------------------------------------
# DATABASE
# --------------------------------------------------

Base.metadata.create_all(bind=engine)


# --------------------------------------------------
# FASTAPI
# --------------------------------------------------

app = FastAPI(
    title="Your Yojana",
    description="Agentic AI Civic Governance Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Open the Groq connection in the background so the first citizen to submit
# does not wait on the TLS handshake. Never blocks or fails startup.
threading.Thread(target=warmup_groq, daemon=True).start()


# --------------------------------------------------
# REQUEST SCHEMAS
# --------------------------------------------------

class ComplaintInput(BaseModel):
    complaint: str
    # Optional base64 / data-URL images for Vision Agent (max 3 enforced in handler)
    images: list[str] | None = None


class StatusUpdate(BaseModel):
    status: str


class VisionAssessInput(BaseModel):
    images: list[str]
    complaint: str | None = None


# --------------------------------------------------
# RESPONSE HELPER
# --------------------------------------------------

def complaint_to_dict(complaint: Complaint):

    return {
        "id": complaint.id,
        "complaint_id": complaint.complaint_id,
        "description": complaint.description,
        "location": complaint.location,
        "category": complaint.category,
        "priority": complaint.priority,
        "priority_score": complaint.priority_score,
        "priority_reasons": json.loads(
            complaint.priority_reasons or "[]"
        ),
        "department": complaint.department,
        "status": complaint.status,
        "created_at": (
            complaint.created_at.isoformat()
            if complaint.created_at
            else None
        )
    }


# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
def root():

    return {
        "message": "Your Yojana backend is running!",
        "docs": "/docs"
    }


# --------------------------------------------------
# CREATE COMPLAINT
# --------------------------------------------------

@app.post("/complaint")
def process_complaint(
    data: ComplaintInput,
    db: Session = Depends(get_db)
):

    complaint_text = data.complaint
    vision_result = None

    # Optional Vision Agent — only when citizen provides photos
    if data.images:
        try:
            vision_result = assess_civic_images(
                data.images[:3],
                complaint_text,
            )
            complaint_text = enrich_complaint_with_vision(
                complaint_text,
                vision_result,
            )
        except Exception as exc:
            # Never block text complaint submission if vision fails
            vision_result = None
            print(f"[vision] skipped during complaint submit: {exc}")

    # Agent 1
    analysis = understand_complaint(
        complaint_text
    )

    # Agent 2
    priority = prioritize_complaint(
        analysis
    )

    # Agent 3
    routing = route_complaint(
        analysis
    )

    # Generate ID
    complaint_id = (
        f"YY-{uuid4().hex[:8].upper()}"
    )

    # Store original citizen text (not the enriched vision appendix)
    complaint_record = Complaint(

        complaint_id=complaint_id,

        description=data.complaint,

        location=analysis.location,

        category=analysis.category,

        priority=priority.level,

        priority_score=priority.score,

        priority_reasons=json.dumps(
            priority.reasons
        ),

        department=routing.department,

        status="PENDING"
    )

    db.add(complaint_record)

    db.commit()

    db.refresh(complaint_record)

    payload = {
        "message": "Complaint registered successfully",
        "complaint": complaint_to_dict(
            complaint_record
        ),
        "analysis": analysis.model_dump(),
        "priority": priority.model_dump(),
        "routing": routing.model_dump()
    }

    if vision_result is not None:
        payload["vision"] = vision_result.model_dump()

    return payload


# --------------------------------------------------
# AI VISUAL ASSESSMENT (standalone)
# --------------------------------------------------

@app.post("/vision/assess")
def vision_assess(data: VisionAssessInput):

    if not data.images:
        raise HTTPException(
            status_code=400,
            detail="At least one image is required"
        )

    if len(data.images) > 3:
        raise HTTPException(
            status_code=400,
            detail="Maximum 3 images allowed"
        )

    try:
        result = assess_civic_images(
            data.images,
            data.complaint or "",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Vision assessment failed: {exc}"
        ) from exc

    return {
        "message": "Visual assessment complete",
        "vision": result.model_dump(),
        "model": os.getenv(
            "GROQ_VISION_MODEL",
            "qwen/qwen3.6-27b",
        ),
        "label": "AI-ASSISTED ASSESSMENT",
    }


# --------------------------------------------------
# GET ALL COMPLAINTS
# --------------------------------------------------

@app.get("/complaints")
def get_complaints(
    priority: str | None = None,
    department: str | None = None,
    status: str | None = None,
    location: str | None = None,
    db: Session = Depends(get_db)
):

    query = db.query(Complaint)

    if priority:
        query = query.filter(
            Complaint.priority == priority.upper()
        )

    if department:
        query = query.filter(
            Complaint.department == department
        )

    if status:
        query = query.filter(
            Complaint.status == status.upper()
        )

    if location:
        query = query.filter(
            Complaint.location.ilike(
                f"%{location}%"
            )
        )

    complaints = query.order_by(
        Complaint.priority_score.desc(),
        Complaint.created_at.desc()
    ).all()

    return {
        "count": len(complaints),
        "complaints": [
            complaint_to_dict(c)
            for c in complaints
        ]
    }


# --------------------------------------------------
# GET SINGLE COMPLAINT
# --------------------------------------------------

@app.get("/complaints/{complaint_id}")
def get_complaint(
    complaint_id: str,
    db: Session = Depends(get_db)
):

    complaint = (
        db.query(Complaint)
        .filter(
            Complaint.complaint_id == complaint_id
        )
        .first()
    )

    if not complaint:

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    return complaint_to_dict(
        complaint
    )


# --------------------------------------------------
# UPDATE STATUS
# --------------------------------------------------

@app.patch("/complaints/{complaint_id}/status")
def update_status(
    complaint_id: str,
    data: StatusUpdate,
    db: Session = Depends(get_db)
):

    allowed_statuses = {
        "PENDING",
        "ASSIGNED",
        "IN_PROGRESS",
        "RESOLVED"
    }

    new_status = data.status.upper()

    if new_status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid status. Use: "
                "PENDING, ASSIGNED, "
                "IN_PROGRESS or RESOLVED"
            )
        )

    complaint = (
        db.query(Complaint)
        .filter(
            Complaint.complaint_id == complaint_id
        )
        .first()
    )

    if not complaint:

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    complaint.status = new_status

    db.commit()

    db.refresh(complaint)

    return {
        "message": "Status updated",
        "complaint": complaint_to_dict(
            complaint
        )
    }


# --------------------------------------------------
# DASHBOARD STATISTICS
# --------------------------------------------------

@app.get("/dashboard/stats")
def dashboard_stats(
    db: Session = Depends(get_db)
):

    complaints = db.query(Complaint).all()

    total = len(complaints)

    critical = sum(
        c.priority == "CRITICAL"
        for c in complaints
    )

    high = sum(
        c.priority == "HIGH"
        for c in complaints
    )

    medium = sum(
        c.priority == "MEDIUM"
        for c in complaints
    )

    low = sum(
        c.priority == "LOW"
        for c in complaints
    )

    pending = sum(
        c.status == "PENDING"
        for c in complaints
    )

    assigned = sum(
        c.status == "ASSIGNED"
        for c in complaints
    )

    in_progress = sum(
        c.status == "IN_PROGRESS"
        for c in complaints
    )

    resolved = sum(
        c.status == "RESOLVED"
        for c in complaints
    )

    departments = {}

    for complaint in complaints:

        department = complaint.department

        if department not in departments:
            departments[department] = 0

        departments[department] += 1

    return {
        "total": total,

        "priority": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low
        },

        "status": {
            "pending": pending,
            "assigned": assigned,
            "in_progress": in_progress,
            "resolved": resolved
        },

        "departments": departments
    }