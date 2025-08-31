import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

class Config:
    """Configuration class for the Gemini Processor service"""
    
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBjBCD1XXOBXrmAOBJ-SdtebCTx7OHswf8")
    
    # API Endpoints
    LLM_AUDITOR_ENDPOINT = os.getenv(
        "LLM_AUDITOR_ENDPOINT", 
        "https://llm-auditor-api-281695378046.us-central1.run.app/query"
    )
    
    # Gemini Models
    GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.0-flash")
    GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "imagen-4.0-generate-001")
    GEMINI_VIDEO_MODEL = os.getenv("GEMINI_VIDEO_MODEL", "veo-3.0-generate-preview")
    
    # Default settings
    DEFAULT_IMAGE_COUNT = int(os.getenv("DEFAULT_IMAGE_COUNT", "2"))
    DEFAULT_TIMEOUT = int(os.getenv("DEFAULT_TIMEOUT", "30"))
    VIDEO_POLL_INTERVAL = int(os.getenv("VIDEO_POLL_INTERVAL", "10"))
    
    # Output settings
    OUTPUT_DIR = os.getenv("OUTPUT_DIR", "outputs")
    IMAGE_DIR = os.getenv("IMAGE_DIR", "outputs/images")
    VIDEO_DIR = os.getenv("VIDEO_DIR", "outputs/videos")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
