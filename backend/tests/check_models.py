import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

print("Attempting to configure Gemini API...")
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("🔴 ERROR: GEMINI_API_KEY not found in .env file.")
else:
    try:
        genai.configure(api_key=API_KEY)
        print("✅ Gemini API configured successfully.")
        print("\n--- Available Models for 'generateContent' ---")
        
        found_model = False
        for m in genai.list_models():
            # Check if the model supports the 'generateContent' method
            if 'generateContent' in m.supported_generation_methods:
                print(f"🔹 {m.name}")
                found_model = True
        
        if not found_model:
            print("\n🔴 WARNING: No models supporting 'generateContent' were found for your API key.")
            print("This is likely due to one of the following:")
            print("1. The 'Vertex AI API' is not enabled in your Google Cloud project.")
            print("2. Your Google Cloud project does not have a billing account attached.")
            print("3. You may be in a region where Gemini models are not yet available.")

    except Exception as e:
        print(f"\n🔴 An error occurred while trying to list models: {e}")