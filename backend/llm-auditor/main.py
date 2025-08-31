from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from vertexai import agent_engines
import os
import json
import tempfile
from google.oauth2 import service_account

app = FastAPI(title="LLM Auditor API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Vertex AI
agent_engine = None

def initialize_vertex_ai():
    """Initialize Vertex AI with proper credentials"""
    global agent_engine
    
    try:
        # Check if we have Google credentials in environment variable
        google_credentials = os.getenv("GOOGLE_CREDENTIALS")
        
        if not google_credentials:
            print("❌ GOOGLE_CREDENTIALS environment variable not found")
            return False
        
        # Parse the JSON credentials
        credentials_info = json.loads(google_credentials)
        
        # Create temporary credential file (Google libraries expect file path)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(credentials_info, temp_file)
            temp_file_path = temp_file.name
        
        # Set the environment variable to point to the temporary file
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_file_path
        
        print("✅ Google credentials loaded successfully")
        
        # Now initialize Vertex AI
        REASONING_ENGINE_ID = "projects/281695378046/locations/us-central1/reasoningEngines/8216892286928158720"
        agent_engine = agent_engines.get(REASONING_ENGINE_ID)
        print("✅ Connected to Vertex AI Reasoning Engine")
        
        # Clean up temporary file (optional - it will be deleted when app restarts)
        try:
            os.unlink(temp_file_path)
        except:
            pass
            
        return True
        
    except json.JSONDecodeError:
        print("❌ Invalid JSON in GOOGLE_CREDENTIALS")
        return False
    except Exception as e:
        print(f"❌ Failed to initialize Vertex AI: {e}")
        return False

# Initialize on startup
initialize_vertex_ai()

class QueryRequest(BaseModel):
    message: str
    user_id: str = "default_user"

class QueryResponse(BaseModel):
    response: str
    session_id: str

user_sessions = {}

def get_or_create_session(user_id: str):
    """Get existing session or create a new one"""
    if user_id not in user_sessions:
        if agent_engine is None:
            raise HTTPException(status_code=500, detail="Agent engine not initialized - check GCP credentials")
        session = agent_engine.create_session(user_id=user_id)
        user_sessions[user_id] = session["id"]
    return user_sessions[user_id]

@app.post("/query", response_model=QueryResponse)
async def query_agent(request: QueryRequest):
    """Query your deployed Reasoning Engine agent"""
    if agent_engine is None:
        raise HTTPException(status_code=500, detail="Vertex AI agent not initialized. Please check GCP credentials.")
    
    try:
        session_id = get_or_create_session(request.user_id)
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy" if agent_engine else "unhealthy",
        "agent_available": agent_engine is not None,
        "service": "LLM Auditor API on Render"
    }

@app.get("/")
async def root():
    return {
        "message": "LLM Auditor API is running on Render 🚀", 
        "docs": "/docs",
        "health_check": "/health",
        "agent_initialized": agent_engine is not None
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)