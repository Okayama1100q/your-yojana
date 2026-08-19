from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.ngo import NGO
from app.models.contribution import Contribution
from app.schemas.ranking import NGORankingResponse, LeaderboardResponse
from app.utils.enums import RegistrationStatus
from app.utils.exceptions import EntityNotFoundException


class RankingService:
    @staticmethod
    def calculate_all_rankings(db: Session) -> List[NGORankingResponse]:
        """
        Dynamically computes ranking metrics and normalized scores for all approved NGOs
        from real database records.
        """
        approved_ngos = (
            db.query(NGO)
            .filter(
                NGO.registration_status == RegistrationStatus.APPROVED,
                NGO.active == True,
            )
            .all()
        )

        if not approved_ngos:
            return []

        # Gather raw stats per NGO
        raw_stats = []
        for ngo in approved_ngos:
            contributions = db.query(Contribution).filter(Contribution.ngo_id == ngo.id).all()
            completed_count = len(contributions)
            beneficiaries = sum(c.beneficiaries_helped for c in contributions)
            quantity = sum(c.quantity_provided for c in contributions)
            on_time_count = sum(1 for c in contributions if c.completed_on_time)
            on_time_rate = round((on_time_count / completed_count * 100.0), 1) if completed_count > 0 else 0.0

            raw_stats.append({
                "ngo_id": ngo.id,
                "ngo_code": ngo.ngo_code,
                "ngo_name": ngo.ngo_name,
                "completed_requests": completed_count,
                "beneficiaries_helped": beneficiaries,
                "total_quantity_provided": quantity,
                "on_time_completion_rate": on_time_rate,
            })

        # Calculate max metrics for normalization
        max_completed = max((s["completed_requests"] for s in raw_stats), default=0)
        max_beneficiaries = max((s["beneficiaries_helped"] for s in raw_stats), default=0)
        max_quantity = max((s["total_quantity_provided"] for s in raw_stats), default=0)

        # Compute weighted normalized scores
        # Formula: 35% Completed + 30% Beneficiaries + 20% Quantity + 15% On-Time Rate
        ranked_list = []
        for item in raw_stats:
            norm_completed = (item["completed_requests"] / max_completed * 100.0) if max_completed > 0 else 0.0
            norm_ben = (item["beneficiaries_helped"] / max_beneficiaries * 100.0) if max_beneficiaries > 0 else 0.0
            norm_qty = (item["total_quantity_provided"] / max_quantity * 100.0) if max_quantity > 0 else 0.0
            norm_ontime = item["on_time_completion_rate"]

            score = (
                0.35 * norm_completed
                + 0.30 * norm_ben
                + 0.20 * norm_qty
                + 0.15 * norm_ontime
            )

            ranked_list.append({
                **item,
                "ranking_score": round(score, 1),
            })

        # Sort descending by ranking_score, secondary by completed_requests
        ranked_list.sort(key=lambda x: (x["ranking_score"], x["completed_requests"], x["beneficiaries_helped"]), reverse=True)

        # Assign integer ranks
        results = []
        for rank_idx, item in enumerate(ranked_list, start=1):
            results.append(
                NGORankingResponse(
                    ngo_id=item["ngo_id"],
                    ngo_code=item["ngo_code"],
                    ngo_name=item["ngo_name"],
                    current_rank=rank_idx,
                    ranking_score=item["ranking_score"],
                    completed_requests=item["completed_requests"],
                    beneficiaries_helped=item["beneficiaries_helped"],
                    total_quantity_provided=item["total_quantity_provided"],
                    on_time_completion_rate=item["on_time_completion_rate"],
                )
            )

        return results

    @staticmethod
    def get_leaderboard(db: Session) -> LeaderboardResponse:
        rankings = RankingService.calculate_all_rankings(db)
        return LeaderboardResponse(
            total_ngos=len(rankings),
            leaderboard=rankings,
        )

    @staticmethod
    def get_ngo_ranking(db: Session, ngo_id: int) -> NGORankingResponse:
        rankings = RankingService.calculate_all_rankings(db)
        for r in rankings:
            if r.ngo_id == ngo_id:
                return r

        ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
        if not ngo:
            raise EntityNotFoundException("NGO", ngo_id)

        # If NGO is not approved or active, return zero rank stats
        return NGORankingResponse(
            ngo_id=ngo.id,
            ngo_code=ngo.ngo_code,
            ngo_name=ngo.ngo_name,
            current_rank=len(rankings) + 1,
            ranking_score=0.0,
            completed_requests=0,
            beneficiaries_helped=0,
            total_quantity_provided=0,
            on_time_completion_rate=0.0,
        )
