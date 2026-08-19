import json
from dataclasses import dataclass
from typing import List
from sqlalchemy.orm import Session

from app.core.models.ngo import NGO, NGOService, NGOCoverage
from app.core.models.contribution import Contribution
from app.core.enums import RegistrationStatus


@dataclass
class NGOMatchResult:
    ngo_id: int
    ngo_code: str
    ngo_name: str
    matched_score: float
    matched_reasons: List[str]
    available_quantity: int
    estimated_duration_value: int
    estimated_duration_unit: str

    @property
    def score(self) -> float:
        return self.matched_score

    @property
    def reasons(self) -> List[str]:
        return self.matched_reasons


# Alias for backward compatibility
MatchCandidate = NGOMatchResult


class DeterministicMatchingEngine:
    """
    100% Rule-Based, Explainable, Deterministic Matching & 100-Point Scoring Engine.
    ZERO AI / ML / LLMs / Vector Embeddings.
    """

    @classmethod
    def match_ngos_for_request(
        cls,
        db: Session,
        service_category_id: int,
        requirement_id: int,
        requested_quantity: int,
        state: str = None,
        district: str = None,
        area: str = None,
        req_state: str = None,
        req_district: str = None,
        req_area: str = None,
    ) -> List[NGOMatchResult]:
        target_state = state if state is not None else req_state
        target_district = district if district is not None else req_district
        target_area = area if area is not None else req_area

        # HARD FILTER 1: Approved & Active NGOs only
        # HARD FILTER 2: NGO has registered service for exact category & requirement
        # HARD FILTER 3: NGO has available_quantity > 0
        candidate_services = (
            db.query(NGOService)
            .join(NGO, NGOService.ngo_id == NGO.id)
            .filter(
                NGO.registration_status == RegistrationStatus.APPROVED,
                NGO.active == True,
                NGOService.active == True,
                NGOService.service_category_id == service_category_id,
                NGOService.requirement_id == requirement_id,
                NGOService.available_quantity > 0,
            )
            .all()
        )

        match_results: List[NGOMatchResult] = []

        for service in candidate_services:
            ngo: NGO = service.ngo
            score = 0.0
            reasons: List[str] = []

            # 1. Exact Service & Requirement Match (40 Points)
            score += 40.0
            reasons.append("Exact service and requirement match (40/40 pts)")

            # Fetch active coverage records for this NGO
            coverage_records = (
                db.query(NGOCoverage)
                .filter(NGOCoverage.ngo_id == ngo.id, NGOCoverage.active == True)
                .all()
            )

            # Normalize user inputs for matching
            u_state = (target_state or "").strip().lower()
            u_district = (target_district or "").strip().lower()
            u_area = (target_area or "").strip().lower()

            ngo_registered_state = (ngo.state or "").strip().lower()
            ngo_registered_district = (ngo.district or "").strip().lower()

            # Check state match: registered headquarters state OR coverage state
            state_matched = (ngo_registered_state == u_state) or any(
                (c.state or "").strip().lower() == u_state for c in coverage_records
            )

            # Check district match: registered headquarters district OR coverage district in that state
            district_matched = False
            if ngo_registered_state == u_state and ngo_registered_district == u_district:
                district_matched = True
            elif any(
                (c.state or "").strip().lower() == u_state and (c.district or "").strip().lower() == u_district
                for c in coverage_records
            ):
                district_matched = True

            # Check area match: specific coverage area in that state and district
            area_matched = False
            if u_area:
                area_matched = any(
                    (c.state or "").strip().lower() == u_state
                    and (c.district or "").strip().lower() == u_district
                    and (c.area or "").strip().lower() == u_area
                    for c in coverage_records
                )

            # 2. State Match (20 Points)
            if state_matched:
                score += 20.0
                reasons.append(f"State match: {target_state} (20/20 pts)")
            else:
                reasons.append(f"Interstate capability (0/20 pts for state match, NGO HQ: {ngo.state})")

            # 3. District Match (20 Points)
            if district_matched:
                score += 20.0
                reasons.append(f"District match: {target_district} (20/20 pts)")
            else:
                reasons.append(f"District mismatch (0/20 pts, target district: {target_district})")

            # 4. Area Match (10 Points)
            if area_matched:
                score += 10.0
                reasons.append(f"Area match: {target_area} (10/10 pts)")
            elif u_area:
                reasons.append(f"Area not specifically covered (0/10 pts, target area: {target_area})")

            # 5. Capacity / Availability (5 Points)
            if service.available_quantity >= requested_quantity:
                score += 5.0
                reasons.append(f"Full requested capacity available ({service.available_quantity} >= {requested_quantity}) (5/5 pts)")
            else:
                partial_capacity_pts = round((service.available_quantity / requested_quantity) * 5.0, 2)
                score += partial_capacity_pts
                reasons.append(f"Partial capacity available ({service.available_quantity}/{requested_quantity}) ({partial_capacity_pts}/5 pts)")

            # 6. Historical Performance & On-Time Rate (5 Points)
            completed_contribs = (
                db.query(Contribution)
                .filter(Contribution.ngo_id == ngo.id)
                .all()
            )
            if completed_contribs:
                on_time_count = sum(1 for c in completed_contribs if c.completed_on_time)
                on_time_rate = (on_time_count / len(completed_contribs)) * 100.0
                perf_pts = round((on_time_rate / 100.0) * 5.0, 2)
                score += perf_pts
                reasons.append(f"Historical on-time delivery rate: {on_time_rate:.1f}% ({perf_pts}/5 pts)")
            else:
                # Base points for newly approved NGO with no history
                score += 3.0
                reasons.append("Base rating for newly approved NGO (3.0/5 pts)")

            match_results.append(
                NGOMatchResult(
                    ngo_id=ngo.id,
                    ngo_code=ngo.ngo_code,
                    ngo_name=ngo.ngo_name,
                    matched_score=round(score, 2),
                    matched_reasons=reasons,
                    available_quantity=service.available_quantity,
                    estimated_duration_value=service.estimated_duration_value,
                    estimated_duration_unit=service.estimated_duration_unit.value if hasattr(service.estimated_duration_unit, "value") else str(service.estimated_duration_unit),
                )
            )

        # Sort descending by matched_score
        match_results.sort(key=lambda x: x.matched_score, reverse=True)
        return match_results
