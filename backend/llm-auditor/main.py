from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from vertexai import agent_engines
import vertexai
import os

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

class QueryResponse(BaseModel):
    response: str
    session_id: str

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

@app.post("/query", response_model=QueryResponse)
async def query_agent(request: QueryRequest):
    """Query your deployed Reasoning Engine agent"""
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
        
        return QueryResponse(
            response=" ".join(responses),
            session_id=session_id
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
        "status": "Container started successfully"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)