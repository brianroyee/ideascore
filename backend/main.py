import logging
import os  # Import os to get environment variables
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables (now including PROD_URL and GEMINI_API_KEY)
load_dotenv()

# Import our updated, streamlined schemas and client
from schemas import IdeaInput, EvaluationOutput
from llm_client import get_idea_evaluation
# IMPORTANT: Import the sanitization function
from security import sanitize_text

# --- App Initialization ---
app = FastAPI(
    title="IdeaScore API (Live Gemini)",
    description="A focused API for the MCQ-based idea evaluation flow.",
    version="2.1.0"
)

# --- CORS Configuration ---
# Updated to include a production URL from environment variables
PROD_URL = os.getenv("PROD_URL", "http://localhost:8000")  # Default for local

origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    PROD_URL,  # Add your production frontend URL here
]
# You can also use "https://*.yourdomain.com"
# or allow_origin_regex for more flexibility

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- THE UPDATED API ENDPOINT ---
@app.post("/api/evaluate", response_model=EvaluationOutput)
async def evaluate_idea(idea_input: IdeaInput):
    """
    Receives an idea with MCQ answers and text, passes it to the
    LIVE evaluation client, and returns the structured report.
    """
    # --- SECURITY ---
    # We must sanitize user input before sending it to an LLM
    sanitized_text, logs = sanitize_text(idea_input.idea_text, 8000)
    
    if logs:
        logger.info(f"Sanitization actions taken: {logs}")
    
    # Create the payload with the *sanitized* text
    payload = {
        "mcq_answers": idea_input.mcq_answers,
        "idea_text": sanitized_text
    }
    
    evaluation_result = await get_idea_evaluation(payload)

    if not evaluation_result:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The evaluation service is currently unavailable or failed to process the request."
        )
    
    return evaluation_result


# --- Static Files Mount ---
# This serves our frontend (index.html, app.css, app.js).
# Assumes a directory structure like:
# project_root/
#  ├── backend/ (this file is here)
#  └── frontend/ (html/css/js are here)
app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")