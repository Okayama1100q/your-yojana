import os
import json

from dotenv import load_dotenv
from groq import BadRequestError, Groq

from agents.schemas import ComplaintAnalysis


load_dotenv()


client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


def warmup() -> None:
    """Opens the Groq connection ahead of the first complaint.

    The TLS handshake costs roughly 0.9s, which would otherwise be paid by
    whichever citizen submits first. Failures are ignored — this is purely
    an optimisation.
    """
    try:
        client.models.list()
    except Exception:
        pass


def understand_complaint(complaint: str) -> ComplaintAnalysis:

    response = _analyze(complaint)

    content = response.choices[0].message.content

    data = json.loads(content)

    return ComplaintAnalysis.model_validate(data)


def _analyze(complaint: str):

    request = dict(
        model="openai/gpt-oss-120b",

        # Extraction is a fact-reading task, not an open reasoning problem.
        # Low effort returns the same fields far sooner, and temperature 0
        # keeps the same complaint from being categorised differently twice.
        reasoning_effort="low",

        temperature=0,

        max_completion_tokens=1024,

        messages=[
            {
                "role": "system",
                "content": """
You are the Complaint Understanding Agent for Your Yojana.

Analyze the citizen's civic complaint and extract factual information.

Rules:

1. Do not invent information.
2. If affected count is unknown, return 0.
3. If duration is unknown, return 0.
4. Mark health_risk true only when there is an actual or potential
   health consequence.
5. Mark safety_risk true only when there is a safety hazard.
6. Mark essential_service true for services such as water,
   electricity, sanitation and healthcare.
7. Mark vulnerable_population true when children, elderly people,
   disabled people, pregnant women, etc. are mentioned.
8. If the complaint says "500 families", return:
   affected_count = 500
   affected_unit = "families".
9. Do not convert families into people.
10. Extract the location only if it is explicitly mentioned.

Return ONLY the requested structured JSON object.
"""
            },
            {
                "role": "user",
                "content": complaint
            }
        ],

        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "complaint_analysis",
                "strict": True,
                "schema": ComplaintAnalysis.model_json_schema()
            }
        }
    )

    try:
        return client.chat.completions.create(**request)
    except BadRequestError:
        # A model that rejects the speed hints must still be able to run.
        request.pop("reasoning_effort", None)
        request.pop("max_completion_tokens", None)
        return client.chat.completions.create(**request)