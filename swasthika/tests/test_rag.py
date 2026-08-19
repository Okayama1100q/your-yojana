"""
RAG layer tests.

Verifies that:
  - BM25 retriever returns results from the eligible pool
  - top_n cap is respected
  - fallback works when all BM25 scores are zero
  - ineligible schemes never appear in results (tested via integration)
  - retriever returns all eligible when < 10 available
"""

import pytest
from swasthika.backend.rag.retriever import BM25Retriever


def make_eligible_pool(n: int, description: str = "welfare scheme for citizens") -> list:
    return [
        {
            "slug": f"scheme-{i}",
            "name": f"Test Scheme {i}",
            "description": description,
            "category": "Social Welfare",
            "beneficiary_type": "Individual",
            "eligibility_text": "",
            "_status": "ELIGIBLE",
            "_audit_checks": [],
            "_missing": [],
            "official_url": f"https://example.com/scheme-{i}",
        }
        for i in range(n)
    ]


def test_rag_returns_at_most_10():
    retriever = BM25Retriever()
    pool = make_eligible_pool(25, "farmer agriculture tamil nadu")
    retriever.index(pool)
    results = retriever.retrieve("farmer", top_n=10)
    assert len(results) <= 10


def test_rag_returns_all_when_fewer_than_10():
    retriever = BM25Retriever()
    pool = make_eligible_pool(5, "disability welfare scheme")
    retriever.index(pool)
    results = retriever.retrieve("disability", top_n=10)
    assert len(results) == 5


def test_rag_fallback_all_zero_scores():
    """When query terms have no overlap with corpus, fallback returns first top_n."""
    retriever = BM25Retriever()
    pool = make_eligible_pool(15, "agriculture farmers")
    retriever.index(pool)
    # Query that does not appear in any document
    results = retriever.retrieve("quantum technology xyz123", top_n=10)
    # Fallback: return first 10 (all eligible)
    assert len(results) == 10
    assert results[0]["slug"].startswith("scheme-")


def test_rag_empty_pool():
    retriever = BM25Retriever()
    retriever.index([])
    results = retriever.retrieve("anything", top_n=10)
    assert results == []


def test_rag_empty_query_returns_first_n():
    retriever = BM25Retriever()
    pool = make_eligible_pool(15)
    retriever.index(pool)
    results = retriever.retrieve("", top_n=10)
    assert len(results) <= 10


def test_rag_relevant_scheme_ranked_higher():
    """A scheme whose content matches the query should score higher."""
    retriever = BM25Retriever()
    pool = [
        {
            "slug": "agri-scheme",
            "name": "Farmer Subsidy Scheme",
            "description": "This scheme provides subsidies to farmers who cultivate wheat and rice",
            "category": "Agriculture",
            "beneficiary_type": "Farmer",
            "eligibility_text": "The applicant must be a farmer.",
            "_status": "ELIGIBLE",
            "_audit_checks": [],
            "_missing": [],
            "official_url": "https://example.com/farmer",
        },
        {
            "slug": "education-scheme",
            "name": "Student Scholarship",
            "description": "Scholarship for students pursuing higher education",
            "category": "Education",
            "beneficiary_type": "Student",
            "eligibility_text": "The applicant must be a student.",
            "_status": "ELIGIBLE",
            "_audit_checks": [],
            "_missing": [],
            "official_url": "https://example.com/student",
        },
    ]
    retriever.index(pool)
    results = retriever.retrieve("farmer agriculture wheat", top_n=2)
    assert results[0]["slug"] == "agri-scheme"


def test_rag_only_receives_schemes_in_its_index():
    """
    The RAG layer has no knowledge of ineligible schemes.
    We verify that if only 3 schemes are passed in, only 3 can come out.
    """
    retriever = BM25Retriever()
    eligible_only = make_eligible_pool(3, "SC ST welfare")
    retriever.index(eligible_only)
    results = retriever.retrieve("SC welfare", top_n=10)
    assert len(results) == 3
    for r in results:
        assert r["_status"] == "ELIGIBLE"
