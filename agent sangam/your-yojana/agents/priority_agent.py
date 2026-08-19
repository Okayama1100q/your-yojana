from agents.schemas import ComplaintAnalysis, PriorityResult


def prioritize_complaint(
    complaint: ComplaintAnalysis
) -> PriorityResult:

    score = 0
    reasons = []

    # 1. Safety risk
    if complaint.safety_risk:
        score += 30

        reasons.append({
            "factor": "Public safety risk",
            "points": 30
        })

    # 2. Health risk
    if complaint.health_risk:
        score += 25

        reasons.append({
            "factor": "Health risk",
            "points": 25
        })

    # 3. Essential service
    if complaint.essential_service:
        score += 20

        reasons.append({
            "factor": "Essential service disruption",
            "points": 20
        })

    # 4. Number of people/families affected
    affected = complaint.affected_count

    if affected >= 1000:
        points = 15

    elif affected >= 500:
        points = 12

    elif affected >= 100:
        points = 8

    elif affected > 0:
        points = 3

    else:
        points = 0

    score += points

    if points > 0:
        reasons.append({
            "factor": (
                f"{affected} "
                f"{complaint.affected_unit} affected"
            ),
            "points": points
        })

    # 5. Vulnerable population
    if complaint.vulnerable_population:
        score += 10

        reasons.append({
            "factor": "Vulnerable population affected",
            "points": 10
        })

    # 6. Duration
    duration = complaint.duration_days

    duration_points = min(duration * 2, 10)

    score += duration_points

    if duration_points > 0:
        reasons.append({
            "factor": f"Issue ongoing for {duration} days",
            "points": duration_points
        })

    # Prevent score from exceeding 100
    score = min(score, 100)

    # Determine priority
    if score >= 80:
        level = "CRITICAL"
        response_hours = 24

    elif score >= 60:
        level = "HIGH"
        response_hours = 48

    elif score >= 40:
        level = "MEDIUM"
        response_hours = 72

    else:
        level = "LOW"
        response_hours = 120

    return PriorityResult(
        score=score,
        level=level,
        reasons=reasons,
        recommended_response_hours=response_hours
    )