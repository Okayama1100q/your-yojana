import os
import re
import math
import pandas as pd
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Okapi
from rapidfuzz import process, fuzz

class SchemeRetriever:
    _instance = None

    def __init__(self, csv_path: Optional[str] = None):
        self.schemes: List[Dict[str, Any]] = []
        self.tokenized_corpus: List[List[str]] = []
        self.bm25: Optional[BM25Okapi] = None
        self.scheme_names: List[str] = []
        
        if csv_path is None:
            # Look in swasthika processed data folder
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            possible_paths = [
                os.path.join(base_dir, "..", "swasthika", "data", "processed", "Swasthika_Eligibility_Normalized.csv"),
                os.path.join(base_dir, "swasthika", "data", "processed", "Swasthika_Eligibility_Normalized.csv"),
                os.path.join(os.path.dirname(base_dir), "swasthika", "data", "processed", "Swasthika_Eligibility_Normalized.csv"),
                os.path.join(base_dir, "..", "swasthika", "data", "raw", "Schemes.csv"),
            ]
            for p in possible_paths:
                norm_p = os.path.normpath(p)
                if os.path.exists(norm_p):
                    csv_path = norm_p
                    break

        self.csv_path = csv_path
        if self.csv_path and os.path.exists(self.csv_path):
            self._load_and_index()
        else:
            print(f"Warning: Scheme dataset not found at paths checked.")

    @classmethod
    def get_instance(cls) -> "SchemeRetriever":
        if cls._instance is None:
            cls._instance = SchemeRetriever()
        return cls._instance

    def _clean_str(self, val: Any) -> str:
        if val is None:
            return ""
        if isinstance(val, float) and math.isnan(val):
            return ""
        s = str(val).strip()
        if s.lower() == "nan" or s.lower() == "null":
            return ""
        return s

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\w+', text.lower())

    def _load_and_index(self):
        try:
            print(f"Loading schemes from {self.csv_path}...")
            df = pd.read_csv(self.csv_path, low_memory=False)
            print(f"Loaded {len(df)} schemes.")

            self.schemes = []
            self.tokenized_corpus = []
            self.scheme_names = []

            for _, row in df.iterrows():
                name = self._clean_str(row.get("name"))
                desc = self._clean_str(row.get("description"))
                cat = self._clean_str(row.get("category"))
                state = self._clean_str(row.get("state"))
                beneficiary = self._clean_str(row.get("beneficiary_type"))
                benefits = self._clean_str(row.get("benefits"))
                elig_text = self._clean_str(row.get("eligibility_text"))
                docs = self._clean_str(row.get("documents_required"))
                proc = self._clean_str(row.get("application_process"))
                dept = self._clean_str(row.get("department"))
                ministry = self._clean_str(row.get("ministry"))
                apply_url = self._clean_str(row.get("apply_url"))
                official_url = self._clean_str(row.get("official_url"))

                record = {
                    "slug": self._clean_str(row.get("slug")),
                    "name": name,
                    "description": desc,
                    "category": cat,
                    "state": state,
                    "beneficiary_type": beneficiary,
                    "benefits": benefits,
                    "eligibility_text": elig_text,
                    "documents_required": docs,
                    "application_process": proc,
                    "department": dept,
                    "ministry": ministry,
                    "apply_url": apply_url,
                    "official_url": official_url
                }
                self.schemes.append(record)
                self.scheme_names.append(name)

                # Build search document for BM25
                search_text = f"{name} {desc} {cat} {state} {beneficiary} {benefits} {elig_text} {dept} {ministry}"
                tokens = self._tokenize(search_text)
                self.tokenized_corpus.append(tokens)

            if self.tokenized_corpus:
                self.bm25 = BM25Okapi(self.tokenized_corpus)
                print(f"BM25 index built successfully with {len(self.schemes)} schemes.")
        except Exception as e:
            print(f"Error loading scheme dataset: {e}")

    def retrieve(self, query: str, user_state: Optional[str] = None, top_n: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieve the most relevant schemes using BM25 ranking + fuzzy matching.
        """
        if not self.schemes or not self.bm25:
            return []

        clean_query = query.strip()
        if not clean_query:
            return self.schemes[:top_n]

        tokens = self._tokenize(clean_query)
        if not tokens:
            return self.schemes[:top_n]

        # 1. Check for fuzzy scheme name match
        fuzzy_matches = []
        try:
            fuzzy_results = process.extract(
                clean_query, 
                self.scheme_names, 
                scorer=fuzz.token_set_ratio, 
                limit=3
            )
            for match_name, score, idx in fuzzy_results:
                if score >= 65:
                    fuzzy_matches.append((score, self.schemes[idx]))
        except Exception as e:
            pass

        # 2. BM25 score calculation
        bm25_scores = self.bm25.get_scores(tokens)

        # 3. Combine scores with state weighting
        scored_schemes = []
        for idx, (score, scheme) in enumerate(zip(bm25_scores, self.schemes)):
            final_score = float(score)
            scheme_state = scheme.get("state", "").lower()
            if user_state:
                u_state = user_state.lower()
                if scheme_state == u_state:
                    final_score *= 1.3
                elif "central" in scheme_state or "all india" in scheme_state or not scheme_state:
                    final_score *= 1.05
            scored_schemes.append((final_score, scheme))

        scored_schemes.sort(key=lambda x: x[0], reverse=True)

        results = []
        seen_slugs = set()

        for score, scheme in fuzzy_matches:
            slug = scheme.get("slug") or scheme.get("name")
            if slug not in seen_slugs:
                seen_slugs.add(slug)
                results.append(scheme)
                if len(results) >= top_n:
                    return results

        for score, scheme in scored_schemes:
            if score <= 0.0 and len(results) >= 2:
                break
            slug = scheme.get("slug") or scheme.get("name")
            if slug not in seen_slugs:
                seen_slugs.add(slug)
                results.append(scheme)
                if len(results) >= top_n:
                    break

        return results

    def format_for_context(self, schemes: List[Dict[str, Any]]) -> str:
        """
        Format retrieved schemes into a clean, concise knowledge block for Gemini prompt.
        """
        if not schemes:
            return "No specific schemes matched in the database."

        formatted_blocks = []
        for i, s in enumerate(schemes, 1):
            block = [
                f"### SCHEME {i}: {s.get('name', 'N/A')}",
                f"- State/Coverage: {s.get('state') or 'All India / Central'}",
                f"- Category: {s.get('category') or 'General'}",
                f"- Beneficiary Type: {s.get('beneficiary_type') or 'All Citizens'}",
                f"- Department/Ministry: {s.get('department') or s.get('ministry') or 'Government of India'}",
            ]
            if s.get("description"):
                desc = s.get("description").replace("\n", " ").strip()
                if len(desc) > 300:
                    desc = desc[:300] + "..."
                block.append(f"- Purpose/Overview: {desc}")
            if s.get("benefits"):
                ben = s.get("benefits").replace("\n", " ").strip()
                if len(ben) > 300:
                    ben = ben[:300] + "..."
                block.append(f"- Key Benefits: {ben}")
            if s.get("eligibility_text"):
                elig = s.get("eligibility_text").replace("\n", " ").strip()
                if len(elig) > 300:
                    elig = elig[:300] + "..."
                block.append(f"- Eligibility Criteria: {elig}")
            if s.get("documents_required"):
                docs = s.get("documents_required").replace("\n", " ").strip()
                if len(docs) > 250:
                    docs = docs[:250] + "..."
                block.append(f"- Documents Required: {docs}")
            if s.get("application_process"):
                proc = s.get("application_process").replace("\n", " ").strip()
                if len(proc) > 250:
                    proc = proc[:250] + "..."
                block.append(f"- How to Apply: {proc}")
            if s.get("apply_url") or s.get("official_url"):
                block.append(f"- Official Links: Apply URL: {s.get('apply_url') or 'N/A'} | Portal: {s.get('official_url') or 'N/A'}")

            formatted_blocks.append("\n".join(block))

        return "\n\n".join(formatted_blocks)
