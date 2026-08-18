from fastapi import FastAPI
from app.core.database import check_database_connection
from app.api.routes import enrollment, admin, benefits

app = FastAPI(title="Saarthi Agent Backend", version="1.0.0")

app.include_router(enrollment.router, prefix="/api/v1/saarthi", tags=["Saarthi - Citizen"])
app.include_router(admin.router, prefix="/api/v1/saarthi/admin", tags=["Saarthi - Admin"])
app.include_router(benefits.router, prefix="/api/v1/saarthi", tags=["Saarthi - Benefits"])

@app.get("/")
def read_root():
    return {"message": "Welcome to YOUR YOJANA - Saarthi Backend"}

@app.get("/health")
def health_check():
    db_status = "connected" if check_database_connection() else "disconnected"
    return {"status": "ok", "database": db_status}
