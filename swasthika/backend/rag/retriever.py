"""
BM25Retriever — ranks already-ELIGIBLE schemes only.

This module receives the output of the deterministic rule engine.
It does NOT determine eligibility. It only ranks/retrieves from
the pre-filtered eligible pool using BM25 (lexical matching).
"""

from rank_bm25 import BM25Okapi
from typing import List


class BM25Retriever:
    def __init__(self):
        self.bm25 = None
        self.documents: List[dict] = []
        self.tokenized_corpus: List[List[str]] = []

    def index(self, eligible_schemes: List[dict]) -> None:
        """
        Build a BM25 index over the eligible-scheme pool.
        Must only be called with schemes already classified ELIGIBLE
        by the deterministic engine.
        """
        self.documents = []
        self.tokenized_corpus = []

        for scheme in eligible_schemes:
            name = str(scheme.get("name", ""))
            description = str(scheme.get("description", ""))
            category = str(scheme.get("category", ""))
            beneficiary_type = str(scheme.get("beneficiary_type", ""))
            eligibility_text = str(scheme.get("eligibility_text", ""))

            # Rich text representation for BM25 — purely for relevance ranking.
            # Eligibility was already determined before this point.
            text = f"{name} {description} {category} {beneficiary_type} {eligibility_text}"
            tokens = text.lower().split()

            self.documents.append(scheme)
            self.tokenized_corpus.append(tokens)

        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)

    def retrieve(self, query: str, top_n: int = 10) -> List[dict]:
        """
        Retrieve top_n schemes from the eligible pool using BM25 scoring.

        If all BM25 scores are zero (e.g. query terms not present in corpus),
        fall back to returning the first top_n schemes — all are already ELIGIBLE.
        Order of fallback is insertion order (i.e. dataset order).
        """
        if not self.documents:
            return []

        # If no BM25 index (only 0 docs were indexed, handled above), return empty.
        if self.bm25 is None:
            return self.documents[:top_n]

        tokens = query.lower().split()
        if not tokens:
            return self.documents[:top_n]

        scores = self.bm25.get_scores(tokens)

        # Pair each document with its score
        scored = sorted(
            zip(scores, self.documents),
            key=lambda x: x[0],
            reverse=True,
        )

        # If every score is zero (all identical content or query has no overlap),
        # return the first top_n — they are all eligible so any ordering is valid.
        if scored and scored[0][0] == 0.0:
            return self.documents[:top_n]

        return [doc for score, doc in scored[:top_n]]
