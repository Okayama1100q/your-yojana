from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ServiceCategoryBase(BaseModel):
    code: str = Field(..., description="Unique machine-readable category code, e.g. FISHERIES")
    name: str = Field(..., description="Human-readable category name, e.g. Fisheries")


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryResponse(ServiceCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    active: bool
    created_at: datetime


class RequirementBase(BaseModel):
    code: str = Field(..., description="Unique requirement code within category, e.g. FISHING_NET")
    name: str = Field(..., description="Human-readable requirement name, e.g. Fishing Net")


class RequirementCreate(RequirementBase):
    service_category_code: str = Field(..., description="Parent service category code")


class RequirementResponse(RequirementBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_category_id: int
    active: bool
    created_at: datetime


class CategoryWithRequirementsResponse(ServiceCategoryResponse):
    requirements: list[RequirementResponse] = []
