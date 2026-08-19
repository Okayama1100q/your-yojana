"""
RAG Indexer — offline index builder (optional pre-warm).

The BM25Retriever already handles online indexing at request time.
This module provides a standalone offline index builder for
pre-warming the index during server startup over the full
normalized dataset.

NOTE: The indexer operates ONLY for ranking. Eligibility is never
determined here. The runtime evaluation pipeline always calls
DeterministicEngine first, then passes the eligible-only pool
to BM25Retriever.
"""

import pandas as pd
from typing import List


def load_schemes_for_indexing(processed_csv_path: str) -> List[dict]:
    """
    Load all normalized schemes from the processed CSV.
    Returns raw records. Eligibility evaluation is NOT performed here.
    This is purely for building a retrieval index at startup.
    """
    try:
        df = pd.read_csv(processed_csv_path)
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"[indexer] Warning: could not load {processed_csv_path}: {e}")
        return []
