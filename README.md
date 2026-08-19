# YOJANA AI Assistant API

Standalone FastAPI-based domain-restricted AI chatbot agent for YOUR-YOJANA.

## Architecture
- **Backend**: Python, FastAPI
- **AI**: Google Gemini API via `google-genai`
- **Domain Restriction**: Dual-layer architecture with scope-validator and strict system prompts.

## Setup Instructions

1. **Environment Setup**:
   ```bash
   cd backend
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Mac/Linux:
   source venv/bin/activate
   ```
2. **Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Configuration**:
   Copy `.env.example` to `.env` and set your API key:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ALLOWED_ORIGINS=http://localhost:5173
   ```
4. **Run**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

## API Endpoints

- `GET /` - Root status
- `GET /health` - Health check
- `POST /api/chat` - Chatbot interaction endpoint (requires `message` and optional `history` array).
  - Open Swagger UI at `http://127.0.0.1:8000/docs` to test the API directly.
