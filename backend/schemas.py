from pydantic import BaseModel, Field
from typing import List, Dict

# --- New Request Schema ---
# This defines the exact structure we expect from the new frontend.
# It must contain a dictionary for the MCQ answers and a string for the idea text.
class IdeaInput(BaseModel):
    mcq_answers: Dict[str, str]
    idea_text: str = Field(..., max_length=8000)


# --- New Response Schema ---
# This defines the data we send back. It's simplified to match the
# new results dashboard (scores, pros, cons).
class EvaluationOutput(BaseModel):
    overall_rating: float = Field(..., ge=0.0, le=10.0)
    success_probability: int = Field(..., ge=0, le=100)
    pros: List[str]
    cons: List[str]
    founder_fit_score: int = Field(..., ge=0, le=100)