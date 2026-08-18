class VerificationAgent:
    """
    Mock AI Agent for document verification.
    This simulates an LLM/OCR pipeline that checks if a document meets scheme criteria.
    """

    @staticmethod
    def verify_document(enrollment_id: str, document_url: str) -> dict:
        """
        Simulates verifying a document. 
        In a real scenario, this would download the document, run OCR,
        extract text, and use an LLM to evaluate if it satisfies the criteria.
        
        For now, if the document URL contains the word 'invalid', it rejects.
        Otherwise, it approves.
        """
        if "invalid" in document_url.lower():
            return {
                "is_valid": False,
                "confidence": 0.99,
                "reason": "The uploaded certificate appears to be blurry or tampered with. Please re-upload a clear copy."
            }
            
        return {
            "is_valid": True,
            "confidence": 0.95,
            "reason": "The certificate is authentic and matches the scheme requirements."
        }
