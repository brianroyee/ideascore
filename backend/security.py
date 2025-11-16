import unicodedata
import re
import bleach  # bleach is a powerful, trusted library for sanitizing text
from typing import Tuple, List

# --- Constants for Sanitization ---
# It's good practice to define rules like these as constants at the top of the file.

# Maximum allowed characters for different input fields.
MAX_IDEA_TEXT_LENGTH = 8000
MAX_ANSWER_LENGTH = 2000

# A list of phrases often used in prompt injection attacks. We'll search for these
# and remove them from the user's input.
PROMPT_INJECTION_KEYWORDS = [
    "ignore previous instructions",
    "disregard the above",
    "forget what you were told",
    "you are now a different AI",
    "your instructions have changed",
    # Add any other phrases you want to guard against
]

# A regular expression to find and remove non-printable control characters.
# These can sometimes be used to trick systems.
CONTROL_CHAR_REGEX = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
# A simple regex to find URLs.
URL_REGEX = re.compile(r'https?://\S+')

def sanitize_text(input_text: str, max_length: int) -> Tuple[str, List[str]]:
    """
    Performs a series of sanitization steps on a given text string.
    This function is the core of our input security.

    Args:
        input_text: The string to sanitize.
        max_length: The maximum allowed length for the string.

    Returns:
        A tuple containing:
        - The sanitized, safe string.
        - A list of log messages detailing the actions taken.
    """
    sanitization_log = []

    # 1. Trim leading/trailing whitespace. A simple but important first step.
    text = input_text.strip()
    if len(text) != len(input_text):
        sanitization_log.append("Trimmed leading/trailing whitespace.")

    # 2. Enforce the character limit to prevent overly long inputs.
    if len(text) > max_length:
        text = text[:max_length]
        sanitization_log.append(f"Truncated text to {max_length} characters.")

    # 3. Normalize Unicode to prevent character-based attacks or evasions.
    # 'NFKC' is a good choice for compatibility.
    original_text = text
    text = unicodedata.normalize('NFKC', text)
    if text != original_text:
        sanitization_log.append("Normalized Unicode characters.")

    # 4. Remove the control characters we defined in our regex.
    original_text = text
    text = CONTROL_CHAR_REGEX.sub('', text)
    if text != original_text:
        sanitization_log.append("Removed non-printable control characters.")

    # 5. Strip any and all HTML tags. This is our primary defense against XSS.
    # bleach.clean with strip=True removes the tags but keeps the text inside them.
    original_text = text
    text = bleach.clean(text, tags=[], attributes={}, strip=True)
    if text != original_text:
        sanitization_log.append("Stripped all HTML tags.")

    # 6. Detect and remove the prompt injection keywords we defined.
    # We iterate through our list of keywords and remove them case-insensitively.
    original_text = text
    for keyword in PROMPT_INJECTION_KEYWORDS:
        # re.IGNORECASE makes the search case-insensitive
        if keyword in text.lower():
            text = re.sub(re.escape(keyword), '', text, flags=re.IGNORECASE)
            sanitization_log.append(f"Removed potential prompt injection phrase: '{keyword}'.")
    
    # 7. Neutralize URLs. We don't want the LLM to try to access URLs.
    # We replace them with a placeholder.
    found_urls = URL_REGEX.findall(text)
    if found_urls:
        text = URL_REGEX.sub('[URL REMOVED]', text)
        sanitization_log.append(f"Removed {len(found_urls)} URL(s) for security.")

    # Return both the cleaned text and the log of what we did.
    return text, sanitization_log