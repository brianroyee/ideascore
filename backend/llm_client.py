import os
import logging
import json
from typing import Dict, Optional

from pydantic import ValidationError
import google.generativeai as genai
from google.generativeai import types

from schemas import EvaluationOutput


# -----------------------------------------------------------
# Logging Configuration
# -----------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------
# Utility to clean Pydantic JSON Schema for Gemini
# -----------------------------------------------------------
def clean_schema(schema: Dict) -> Dict:
    """
    Recursively removes fields ('title', 'maximum', 'minimum', 'default')
    that Gemini API does not accept in the response_schema.
    """
    if isinstance(schema, dict):
        for key in list(schema.keys()):
            if key in ("title", "maximum", "minimum", "default"):
                del schema[key]
            else:
                schema[key] = clean_schema(schema[key])
    elif isinstance(schema, list):
        schema = [clean_schema(item) for item in schema]

    return schema


# -----------------------------------------------------------
# Gemini API Setup
# -----------------------------------------------------------
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    logger.error("GEMINI_API_KEY not found in environment.")
else:
    genai.configure(api_key=API_KEY)
    logger.info("Gemini API configured successfully.")

MODEL = None

if API_KEY:
    model_options = [
        "gemini-pro-latest"
    ]

    for model_name in model_options:
        try:
            raw_schema = EvaluationOutput.model_json_schema()
            cleaned_schema = clean_schema(raw_schema)

            # Typed GenerationConfig (fix for Pylance and runtime)
            generation_config = types.GenerationConfig(
                response_mime_type="application/json",
                response_schema=cleaned_schema,
            )

            MODEL = genai.GenerativeModel(
                model_name=model_name,
                generation_config=generation_config
            )

            logger.info(f"Initialized Gemini model: {model_name}")
            break

        except Exception as e:
            logger.warning(f"Failed to initialize {model_name}: {e}")
            MODEL = None

    if not MODEL:
        logger.error("Failed to initialize any Gemini model.")


# -----------------------------------------------------------
# System Prompt (LLM Persona)
# -----------------------------------------------------------
SYSTEM_PROMPT = """
You are "IdeaScore", an expert evaluator for startup and project ideas.
The user will provide MCQ answers and a free-text description.

RULES:
- Respond STRICTLY using the provided JSON schema.
- Do NOT include explanations, markdown, or text outside JSON.

You must output:
1. Overall Rating (0.0–10.0)
2. Success Probability (0–100)
3. Founder-Fit Score (0–100)
4. Pros (3–5 strings)
5. Cons (3–5 strings)
"""


# -----------------------------------------------------------
# Main Evaluation Function (Async)
# -----------------------------------------------------------
async def get_idea_evaluation(payload: Dict) -> Optional[EvaluationOutput]:
    """
    Sends the user's idea packet to Gemini and returns
    a validated EvaluationOutput object.
    """

    if not API_KEY or not MODEL:
        logger.error("Gemini model not initialized.")
        return None

    try:
        # Format user data
        mcq_summary = "\n".join(
            f"- {k}: {v}"
            for k, v in payload.get("mcq_answers", {}).items()
        )
        idea_text = payload.get("idea_text", "")

        user_prompt = f"""
        MCQ Selections:
        {mcq_summary}

        Detailed Idea Description:
        {idea_text}

        Provide the evaluation as JSON only.
        """

        logger.info("Sending request to Gemini...")

        # Call the API asynchronously
        response = await MODEL.generate_content_async(
            [SYSTEM_PROMPT, user_prompt]
        )

        response_text = response.text
        logger.debug(f"Raw Gemini Response: {response_text}")

        # Parse JSON from the model output
        json_data = json.loads(response_text)

        # Validate JSON with Pydantic schema
        evaluation = EvaluationOutput(**json_data)
        return evaluation

    except json.JSONDecodeError:
        logger.error(f"Failed to parse JSON from Gemini:\n{response_text}")
        return None

    except ValidationError as e:
        logger.error(f"Gemini output failed schema validation: {e}")
        return None

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return None
