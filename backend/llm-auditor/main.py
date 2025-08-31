from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from vertexai import agent_engines
import vertexai
import os
import requests
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LLM Auditor API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, restrict to your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Vertex AI - Cloud Run handles authentication automatically
# Only initialize the basic Vertex AI, not the specific agent engine
try:
    vertexai.init(project="genaiexchange-470403", location="us-central1")
    print("Vertex AI initialized successfully")
except Exception as e:
    print(f"Warning: Vertex AI initialization failed: {e}")

class QueryRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    generate_image: bool = True

class QueryResponse(BaseModel):
    response: str
    session_id: str
    justifyai_response: dict = None

user_sessions = {}

def get_agent_engine():
    """Get the agent engine with proper error handling"""
    try:
        # Get agent engine ID from environment variable or use default
        agent_engine_id = os.getenv(
            "AGENT_ENGINE_ID", 
            "projects/281695378046/locations/us-central1/reasoningEngines/8216892286928158720"
        )
        
        # Initialize agent engine only when needed
        agent_engine = agent_engines.get(agent_engine_id)
        return agent_engine, None
    except Exception as e:
        return None, str(e)

async def send_to_justifyai(response: str, session_id: str, generate_image: bool = True) -> dict:
    """
    Send the LLM Auditor response to JustifyAI API for processing
    
    Args:
        response: The response from LLM Auditor
        session_id: The session ID
        generate_image: Whether to generate images
        
    Returns:
        JustifyAI API response
    """
    try:
        justifyai_url = "https://justifyai.onrender.com/process"
        
        payload = {
            "api_output": {
                "response": response,
                "session_id": session_id
            },
            "generate_image": generate_image
        }
        
        headers = {"Content-Type": "application/json"}
        
        logger.info(f"Sending response to JustifyAI API: {justifyai_url}")
        logger.info(f"Payload: {json.dumps(payload, indent=2)}")
        
        # Send request to JustifyAI API
        justifyai_response = requests.post(
            justifyai_url,
            json=payload,
            headers=headers,
            timeout=60  # Increased timeout for image generation
        )
        
        if justifyai_response.status_code == 200:
            result = justifyai_response.json()
            logger.info("Successfully received response from JustifyAI API")
            return result
        else:
            logger.error(f"JustifyAI API returned error: {justifyai_response.status_code}")
            logger.error(f"Error details: {justifyai_response.text}")
            return {
                "error": f"JustifyAI API error: {justifyai_response.status_code}",
                "details": justifyai_response.text
            }
            
    except requests.exceptions.Timeout:
        logger.error("Timeout while calling JustifyAI API")
        return {"error": "Timeout while calling JustifyAI API"}
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error while calling JustifyAI API: {e}")
        return {"error": f"Request error: {str(e)}"}
    except Exception as e:
        logger.error(f"Unexpected error while calling JustifyAI API: {e}")
        return {"error": f"Unexpected error: {str(e)}"}

@app.post("/query", response_model=QueryResponse)
async def query_agent(request: QueryRequest):
    """Query your deployed Reasoning Engine agent and send to JustifyAI"""
    try:
        # Get agent engine with error handling
        agent_engine, error = get_agent_engine()
        if agent_engine is None:
            raise HTTPException(
                status_code=503, 
                detail=f"Agent engine not available: {error}"
            )
        
        # Get or create session
        if request.user_id not in user_sessions:
            session = agent_engine.create_session(user_id=request.user_id)
            user_sessions[request.user_id] = session["id"]
        
        session_id = user_sessions[request.user_id]
        
        # Execute query
        responses = []
        for event in agent_engine.stream_query(
            user_id=request.user_id, 
            session_id=session_id, 
            message=request.message
        ):
            for part in event["content"]["parts"]:
                responses.append(part["text"])
        
        # Combine all responses
        combined_response = " ".join(responses)
        
        # Send to JustifyAI API
        justifyai_response = await send_to_justifyai(
            response=combined_response,
            session_id=session_id,
            generate_image=request.generate_image
        )
        
        return QueryResponse(
            response=combined_response,
            session_id=session_id,
            justifyai_response=justifyai_response
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint that doesn't require agent engine"""
    try:
        # Check if agent engine is available
        agent_engine, error = get_agent_engine()
        agent_status = "available" if agent_engine else "unavailable"
        
        return {
            "status": "healthy",
            "service": "LLM Auditor API on Cloud Run",
            "project": "genaiexchange-470403",
            "agent_engine": agent_status,
            "error": error if error else None
        }
    except Exception as e:
        return {
            "status": "degraded",
            "service": "LLM Auditor API on Cloud Run",
            "project": "genaiexchange-470403",
            "agent_engine": "error",
            "error": str(e)
        }

@app.get("/")
async def root():
    return {
        "message": "LLM Auditor API is running on Cloud Run 🚀", 
        "docs": "/docs",
        "health_check": "/health",
        "status": "Container started successfully",
        "features": [
            "LLM Auditor processing",
            "JustifyAI integration for content formatting and image generation"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)