from pydantic import BaseModel, Field

class LifecycleUpdateRequest(BaseModel):
    user_id: str = Field(..., json_schema_extra={"example": "USR-1001"})
    status: str = Field(..., json_schema_extra={"example": "DISCONTINUED"})
