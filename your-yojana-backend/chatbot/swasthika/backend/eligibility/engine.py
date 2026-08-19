"""
DeterministicEngine — evaluates all normalised schemes against a CitizenProfile.

This module contains NO machine learning, NO LLM calls, NO embeddings,
NO semantic similarity. Eligibility is determined exclusively by the
Python rule evaluator in evaluator.py.

The engine loads the preprocessed CSV produced by scripts/preprocess_schemes.py.
It does NOT read the raw Schemes.csv at runtime.
"""

import json
import os
from pathlib import Path
import pandas as pd
from typing import List, Tuple

from swasthika.backend.schemas import CitizenProfile
from swasthika.backend.eligibility.evaluator import evaluate_scheme


class DeterministicEngine:
    def __init__(
        self,
        processed_csv_path: str = "data/processed/Swasthika_Eligibility_Normalized.csv",
    ):
        self.processed_csv_path = processed_csv_path
        self._records: List[dict] = []
        self._total_mandatory_rules: int = 0
        self._total_preference_rules: int = 0

    def load(self) -> None:
        """Load the normalised scheme records from the preprocessed CSV."""
        candidates = [
            Path(self.processed_csv_path),
            Path(__file__).resolve().parent.parent.parent / self.processed_csv_path,
            Path(__file__).resolve().parent.parent.parent.parent / self.processed_csv_path,
            Path.cwd() / self.processed_csv_path,
            Path.cwd() / "swasthika" / self.processed_csv_path,
        ]
        resolved_path = next((p for p in candidates if p.is_file()), None)
        if not resolved_path:
            resolved_path = Path(__file__).resolve().parent.parent.parent / self.processed_csv_path

        try:
            df = pd.read_csv(resolved_path)
            # Replace all pandas NaN / float('nan') with Python None
            df = df.where(pd.notnull(df), None)
            self._records = df.to_dict(orient="records")
            
            # Count loaded rules for verification and observability
            mand_count = 0
            pref_count = 0
            for r in self._records:
                raw_m = r.get("mandatory_rules", "[]")
                raw_p = r.get("preference_rules", "[]")
                if isinstance(raw_m, str):
                    try:
                        mand_count += len(json.loads(raw_m))
                    except Exception:
                        pass
                elif isinstance(raw_m, list):
                    mand_count += len(raw_m)
                if isinstance(raw_p, str):
                    try:
                        pref_count += len(json.loads(raw_p))
                    except Exception:
                        pass
                elif isinstance(raw_p, list):
                    pref_count += len(raw_p)

            self._total_mandatory_rules = mand_count
            self._total_preference_rules = pref_count
            print(f"[engine] Successfully loaded {len(self._records)} schemes ({mand_count} mandatory rules, {pref_count} preference rules) from {resolved_path}")
        except Exception as e:
            print(f"[engine] Warning: could not load {resolved_path}: {e}")
            self._records = []


    def evaluate_all(
        self, profile: CitizenProfile
    ) -> Tuple[List[dict], List[dict], int]:
        """
        Evaluate every scheme against the CitizenProfile using the deterministic rule engine.

        Returns:
            eligible_schemes        — list of scheme records that passed all mandatory rules
            needs_more_info_schemes — list of scheme records with ≥1 missing required field
            ineligible_count        — number of schemes that failed at least one mandatory rule

        NOTE: Gemini is never called here. No LLM is involved in this method.
        """
        if not self._records:
            self.load()

        eligible_schemes: List[dict] = []
        needs_more_info_schemes: List[dict] = []
        ineligible_count = 0

        for record in self._records:
            # evaluate_scheme is a pure Python function — no LLM, no ML.
            status, checks, missing, failed = evaluate_scheme(record, profile)

            # Attach audit metadata to the record so downstream components
            # (RAG, Gemini explainer) can access it without re-evaluating.
            record["_audit_checks"] = checks
            record["_status"] = status
            record["_missing"] = missing

            if status == "ELIGIBLE":
                eligible_schemes.append(record)
            elif status == "NEEDS_MORE_INFORMATION":
                needs_more_info_schemes.append(record)
            else:  # INELIGIBLE
                ineligible_count += 1

        return eligible_schemes, needs_more_info_schemes, ineligible_count
