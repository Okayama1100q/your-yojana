import os
from fastapi import APIRouter, Security, HTTPException, status, Depends
from fastapi.security.api_key import APIKeyHeader
from app.models.chat_models import ChatRequest, ChatResponse
from app.services.gemini_service import process_chat

router = APIRouter()

API_KEY_NAME = "X-Chatbot-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_api_key(api_key: str = Security(api_key_header)):
    expected_key = os.getenv("CHATBOT_API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chatbot API key not configured on server."
        )
    if api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Invalid Chatbot API Key"
        )
    return api_key

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, api_key: str = Depends(get_api_key)):
    if not request.message or not request.message.strip():
        return ChatResponse(
            success=False,
            response="Message cannot be empty."
        )
        
    try:
        response_data = await process_chat(
            request.message, 
            request.history,
            request.userState,
            request.preferredLanguage
        )
        return ChatResponse(**response_data)
    except Exception as e:
        # Secure error handling - do not expose internals
        print(f"Chat route error: {e}")
        return ChatResponse(
            success=False,
            response="YOJANA AI is temporarily unavailable. Please try again shortly."
        )
