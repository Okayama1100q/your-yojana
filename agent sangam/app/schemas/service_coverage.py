from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.utils.enums import EstimatedDurationUnit


class NGOServiceCreate(BaseModel):
    service_category: str = Field(..., description="Standardized service category code, e.g. FISHERIES")
    requirement: str = Field(..., description="Standardized requirement code, e.g. FISHING_NET")
    available_quantity: int = Field(..., gt=0, description="Available stock/capacity quantity")
    unit: str = Field(..., min_length=1, description="Unit of measurement, e.g. nets, units, kits")
    estimated_duration_value: int = Field(default=1, gt=0, description="Estimated duration quantity")
    estimated_duration_unit: EstimatedDurationUnit = Field(
        default=EstimatedDurationUnit.DAYS,
        description="Duration unit: HOURS, DAYS, WEEKS, MONTHS"
    )


class NGOServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ngo_id: int
    service_category_code: str
    service_category_name: str
    requirement_code: str
    requirement_name: str
    available_quantity: int
    unit: str
    estimated_duration_value: int
    estimated_duration_unit: EstimatedDurationUnit
    estimated_display: str
    active: bool
    created_at: datetime
    updated_at: datetime


class NGOCoverageCreate(BaseModel):
    state: str = Field(..., min_length=2, description="State covered")
    district: str = Field(..., min_length=2, description="District covered")
    area: Optional[str] = Field(None, description="Optional specific area/block/village covered")


class NGOCoverageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ngo_id: int
    state: str
    district: str
    area: Optional[str] = None
    active: bool
