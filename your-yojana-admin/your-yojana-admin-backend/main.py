import os
import sqlite3
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Your Yojana Admin Portal Backend",
    description="Admin metrics aggregator for Schemes, Civic Issues, and Cross-Sector Collabs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve SQLite database path
DB_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../../your-yojana-backend/priority/your_yojana.db"
    )
)

class StatusUpdate(BaseModel):
    status: str

def query_db(query: str, args: tuple = (), one: bool = False):
    if not os.path.exists(DB_PATH):
        return [] if not one else None
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    conn.close()
    
    if rv:
        res = [dict(ix) for ix in rv]
        return res[0] if one else res
    return [] if not one else None

@app.get("/")
def read_root():
    return {"message": "Your Yojana Admin Portal Backend Active"}

@app.get("/api/complaints")
def get_complaints():
    complaints = query_db("SELECT id, complaint_id, description, location, category, priority, priority_score, priority_reasons, department, status, created_at FROM complaints ORDER BY priority_score DESC")
    for c in complaints:
        try:
            c["priority_reasons"] = json.loads(c["priority_reasons"] or "[]")
        except:
            c["priority_reasons"] = []
    return {"count": len(complaints), "complaints": complaints}

@app.patch("/api/complaints/{complaint_id}/status")
def patch_status(complaint_id: str, data: StatusUpdate):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="Database not found")
        
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE complaints SET status = ? WHERE complaint_id = ?", (data.status, complaint_id))
    conn.commit()
    rows_affected = cur.rowcount
    conn.close()
    
    if rows_affected == 0:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    return {"message": "Status updated successfully", "complaint_id": complaint_id, "status": data.status}

@app.get("/api/performance/summary")
def get_summary():
    complaints = query_db("SELECT priority, status, category, department FROM complaints")
    
    total_civic = len(complaints)
    pending_civic = sum(1 for c in complaints if c["status"] == "PENDING")
    resolved_civic = sum(1 for c in complaints if c["status"] == "RESOLVED")
    
    critical_civic = sum(1 for c in complaints if c["priority"] == "CRITICAL")
    high_civic = sum(1 for c in complaints if c["priority"] == "HIGH")
    
    scheme_recommendations = 142
    scheme_success_rate = 87.5
    popular_scheme_category = "Health & Welfare"
    
    collab_index = 82.4
    joint_projects = 8
    resolved_transfers = 24
    
    return {
        "civic": {
            "total": total_civic,
            "pending": pending_civic,
            "resolved": resolved_civic,
            "critical": critical_civic,
            "high": high_civic,
        },
        "schemes": {
            "total_recommendations": scheme_recommendations,
            "success_rate": scheme_success_rate,
            "popular_category": popular_scheme_category,
        },
        "collaboration": {
            "index": collab_index,
            "projects": joint_projects,
            "transfers": resolved_transfers,
        }
    }

@app.get("/api/performance/schemes")
def get_schemes_performance():
    return {
        "total_recommendations": 142,
        "success_rate": 87.5,
        "categories": [
            {"name": "Health & Medical", "count": 52, "percentage": 36.6},
            {"name": "Educational Support", "count": 38, "percentage": 26.7},
            {"name": "Pensions & Senior Care", "count": 28, "percentage": 19.7},
            {"name": "Housing & Infrastructure", "count": 14, "percentage": 9.9},
            {"name": "Livelihood & Loans", "count": 10, "percentage": 7.0}
        ],
        "matching_efficiency": [
            {"month": "Jan", "accuracy": 82},
            {"month": "Feb", "accuracy": 84},
            {"month": "Mar", "accuracy": 85},
            {"month": "Apr", "accuracy": 87},
            {"month": "May", "accuracy": 89},
            {"month": "Jun", "accuracy": 92}
        ],
        "demographics": {
            "female": 58.2,
            "male": 41.8,
            "low_income": 74.5,
            "middle_income": 25.5
        }
    }

@app.get("/api/performance/civic-issues")
def get_civic_performance():
    complaints = query_db("SELECT priority, status, category, department FROM complaints")
    
    total = len(complaints)
    
    priority_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for c in complaints:
        p = c["priority"].upper()
        if p in priority_counts:
            priority_counts[p] += 1
            
    status_counts = {"PENDING": 0, "ASSIGNED": 0, "IN_PROGRESS": 0, "RESOLVED": 0}
    for c in complaints:
        s = c["status"].upper()
        if s in status_counts:
            status_counts[s] += 1
            
    categories = {}
    for c in complaints:
        cat = c["category"] or "General"
        categories[cat] = categories.get(cat, 0) + 1
        
    categories_list = [
        {"name": k, "count": v, "percentage": round((v / (total if total > 0 else 1)) * 100, 1)}
        for k, v in categories.items()
    ]
    categories_list = sorted(categories_list, key=lambda x: x["count"], reverse=True)

    return {
        "total": total,
        "priorities": priority_counts,
        "statuses": status_counts,
        "categories": categories_list,
        "sla_resolution_hours": {
            "CRITICAL": 6.2,
            "HIGH": 12.4,
            "MEDIUM": 24.5,
            "LOW": 48.0
        },
        "trends": [
            {"month": "Jan", "reported": 12, "resolved": 10},
            {"month": "Feb", "reported": 18, "resolved": 15},
            {"month": "Mar", "reported": 24, "resolved": 20},
            {"month": "Apr", "reported": 32, "resolved": 28},
            {"month": "May", "reported": total + 5, "resolved": status_counts["RESOLVED"]}
        ]
    }

@app.get("/api/performance/collaboration")
def get_collaboration_performance():
    return {
        "collaboration_index": 82.4,
        "inter_department_transfers": {
            "total": 36,
            "resolved": 24,
            "pending": 12
        },
        "cooperative_projects": [
            {
                "id": "PROJ-CS01",
                "name": "Road Excavation & Cable Re-laying Coordination",
                "sectors": ["Roads & Traffic", "Electricity Dept"],
                "status": "COMPLETED",
                "efficiency_gain": "24% Saved SLA"
            },
            {
                "id": "PROJ-CS02",
                "name": "Waterlogging & Public Sanitation Drive",
                "sectors": ["Water Supply Dept", "Sanitation Dept"],
                "status": "IN_PROGRESS",
                "efficiency_gain": "18% Saved SLA"
            },
            {
                "id": "PROJ-CS03",
                "name": "Street Light Grid & Smart Surveillance Mapping",
                "sectors": ["Electricity Dept", "Municipal Surveillance"],
                "status": "PLANNING",
                "efficiency_gain": "30% Cost Saving"
            }
        ],
        "synergy_scores": [
            {"sector_a": "Roads & Traffic", "sector_b": "Electricity Dept", "synergy": 88},
            {"sector_a": "Water Supply Dept", "sector_b": "Sanitation Dept", "synergy": 92},
            {"sector_a": "Sanitation Dept", "sector_b": "Public Parks", "synergy": 76}
        ]
    }
