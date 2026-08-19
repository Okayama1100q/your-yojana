from typing import List, Dict
from sqlalchemy.orm import Session

from app.core.models.ngo import NGO
from app.core.models.contribution import Contribution
from app.core.enums import RegistrationStatus


class DynamicRankingService:
    """
    Computes dynamic leaderboard and rankings on-demand from source verified contributions.
    Formula:
    Ranking Score = (0.35 * NormCompleted) + (0.30 * NormBeneficiaries) + (0.20 * NormQuantity) + (0.15 * OnTimeRate)
    """

    @classmethod
    def calculate_leaderboard(cls, db: Session) -> List[Dict]:
        approved_ngos = (
            db.query(NGO)
            .filter(NGO.registration_status == RegistrationStatus.APPROVED, NGO.active == True)
            .all()
        )

        ngo_stats = []
        for ngo in approved_ngos:
            contribs = (
                db.query(Contribution)
                .filter(Contribution.ngo_id == ngo.id)
                .all()
            )
            completed_requests = len(contribs)
            beneficiaries_helped = sum(c.beneficiaries_helped for c in contribs)
            total_quantity_provided = sum(c.quantity_provided for c in contribs)
            on_time_count = sum(1 for c in contribs if c.completed_on_time)
            on_time_rate = (on_time_count / completed_requests * 100.0) if completed_requests > 0 else 0.0

            ngo_stats.append({
                "ngo_id": ngo.id,
                "ngo_code": ngo.ngo_code,
                "ngo_name": ngo.ngo_name,
                "completed_requests": completed_requests,
                "beneficiaries_helped": beneficiaries_helped,
                "total_quantity_provided": total_quantity_provided,
                "on_time_completion_rate": round(on_time_rate, 2),
            })

        if not ngo_stats:
            return []

        # Find maximums across all NGOs for normalization (avoid division by zero)
        max_completed = max([s["completed_requests"] for s in ngo_stats] or [1])
        max_beneficiaries = max([s["beneficiaries_helped"] for s in ngo_stats] or [1])
        max_quantity = max([s["total_quantity_provided"] for s in ngo_stats] or [1])

        max_completed = max_completed if max_completed > 0 else 1
        max_beneficiaries = max_beneficiaries if max_beneficiaries > 0 else 1
        max_quantity = max_quantity if max_quantity > 0 else 1

        for s in ngo_stats:
            norm_completed = (s["completed_requests"] / max_completed) * 100.0
            norm_beneficiaries = (s["beneficiaries_helped"] / max_beneficiaries) * 100.0
            norm_quantity = (s["total_quantity_provided"] / max_quantity) * 100.0
            on_time_rate = s["on_time_completion_rate"]

            score = (
                (0.35 * norm_completed)
                + (0.30 * norm_beneficiaries)
                + (0.20 * norm_quantity)
                + (0.15 * on_time_rate)
            )
            s["ranking_score"] = round(score, 2)

        # Sort descending by ranking_score, then completed_requests, then beneficiaries_helped
        ngo_stats.sort(
            key=lambda x: (x["ranking_score"], x["completed_requests"], x["beneficiaries_helped"]),
            reverse=True,
        )

        # Assign ranks 1..N
        for idx, item in enumerate(ngo_stats, start=1):
            item["current_rank"] = idx

        return ngo_stats

    @classmethod
    def get_ngo_ranking_metrics(cls, db: Session, ngo_id: int) -> Dict:
        leaderboard = cls.calculate_leaderboard(db)
        for item in leaderboard:
            if item["ngo_id"] == ngo_id:
                return item

        # If NGO has 0 contributions or is not in leaderboard, fetch basic info
        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            return None

        return {
            "ngo_id": ngo.id,
            "ngo_code": ngo.ngo_code,
            "ngo_name": ngo.ngo_name,
            "current_rank": len(leaderboard) + 1 if leaderboard else 1,
            "ranking_score": 0.0,
            "completed_requests": 0,
            "beneficiaries_helped": 0,
            "total_quantity_provided": 0,
            "on_time_completion_rate": 0.0,
        }
