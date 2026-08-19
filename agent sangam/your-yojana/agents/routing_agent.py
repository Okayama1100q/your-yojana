from pydantic import BaseModel, ConfigDict

from agents.schemas import ComplaintAnalysis


class RoutingResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    department: str
    reason: str
    confidence: float


# Keywords → Government department
DEPARTMENT_RULES = {
    # Water
    "water": "Water Supply Department",
    "drinking water": "Water Supply Department",
    "water supply": "Water Supply Department",

    # Sanitation
    "garbage": "Sanitation Department",
    "sanitation": "Sanitation Department",
    "sewage": "Sanitation Department",
    "waste": "Sanitation Department",
    "drain": "Sanitation Department",
    "drainage": "Sanitation Department",

    # Roads
    "pothole": "Roads & Highways Department",
    "road": "Roads & Highways Department",
    "street": "Roads & Highways Department",
    "footpath": "Roads & Highways Department",

    # Electricity
    "streetlight": "Electrical Department",
    "street light": "Electrical Department",
    "electricity": "Electrical Department",
    "power": "Electrical Department",

    # Traffic
    "traffic": "Traffic Department",
    "traffic signal": "Traffic Department",
    "signal": "Traffic Department",
    "congestion": "Traffic Department",

    # Health
    "hospital": "Public Health Department",
    "health": "Public Health Department",
    "clinic": "Public Health Department",
    "medical": "Public Health Department",
    "disease": "Public Health Department",

    # Education
    "school": "Education Department",
    "education": "Education Department",
    "teacher": "Education Department",
    "college": "Education Department",

    # Welfare
    "pension": "Social Welfare Department",
    "welfare": "Social Welfare Department",
    "ration": "Social Welfare Department",
    "subsidy": "Social Welfare Department",
    
    "violence": "Law Enforcement Department",
    "armed": "Law Enforcement Department",
    "weapon": "Law Enforcement Department",
    "crime": "Law Enforcement Department",
    "assault": "Law Enforcement Department",
    "threat": "Law Enforcement Department",
    "murder": "Law Enforcement Department",
    "robbery": "Law Enforcement Department",
}


def route_complaint(
    complaint: ComplaintAnalysis
) -> RoutingResult:

    # Combine the information extracted by Agent 1
    text = (
        complaint.category + " " +
        complaint.issue
    ).lower()

    # Check the complaint against department keywords
    for keyword, department in DEPARTMENT_RULES.items():

        if keyword in text:

            return RoutingResult(
                department=department,
                reason=(
                    f"The complaint is related to "
                    f"{keyword}, so it should be handled "
                    f"by the {department}."
                ),
                confidence=0.95
            )

    # If no department matches
    return RoutingResult(
        department="Municipal Grievance Cell",
        reason=(
            "The complaint could not be confidently "
            "matched to a specific government department."
        ),
        confidence=0.50
    )