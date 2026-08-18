from datetime import datetime, timezone
from typing import Dict, Any, Optional

def create_disbursement_document(
    disbursement_id: str,
    enrollment_id: str,
    user_id: str,
    scheme_id: str,
    amount: float,
    status: str,
    remarks: Optional[str] = None
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "disbursement_id": disbursement_id,
        "enrollment_id": enrollment_id,
        "user_id": user_id,
        "scheme_id": scheme_id,
        "amount": amount,
        "disbursed_at": now,
        "status": status,
        "remarks": remarks,
        "created_at": now,
        "updated_at": now
    }
