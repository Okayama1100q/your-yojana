from pydantic import BaseModel, Field
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    history: List[ChatMessage] = []
    userState: Optional[str] = None
    preferredLanguage: Optional[str] = None

class ChatResponse(BaseModel):
    success: bool
    in_scope: Optional[bool] = None
    response: str
    preferredLanguage: Optional[str] = None
    userState: Optional[str] = None
    suggestedLanguages: Optional[List[str]] = None
    options: Optional[List[str]] = None
