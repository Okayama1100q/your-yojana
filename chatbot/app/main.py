import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes.chat import router as chat_router
from app.services.rag_service import SchemeRetriever
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm the Scheme dataset and BM25 index
    try:
        retriever = SchemeRetriever.get_instance()
        print(f"Startup: Pre-warmed SchemeRetriever with {len(retriever.schemes)} schemes.")
    except Exception as e:
        print(f"Startup: Failed to pre-warm SchemeRetriever: {e}")
    yield

app = FastAPI(title="YOJANA AI Assistant API", lifespan=lifespan)

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the web-based interactive dashboard at /dashboard
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/dashboard", StaticFiles(directory=static_dir, html=True), name="static")

app.include_router(chat_router, prefix="/api")

@app.get("/")
def root():
    return {
        "service": "YOJANA AI Assistant",
        "status": "running"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
