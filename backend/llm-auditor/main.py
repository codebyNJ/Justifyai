from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import dotenv
dotenv.load_dotenv()
from vertexai import agent_engines
import asyncio
import json
import uuid

app = FastAPI(title="Vertex AI Agent API")

# Initialize the agent engine
agent_engine = agent_engines.get('projects/281695378046/locations/us-central1/reasoningEngines/8216892286928158720')

# In-memory session storage (use Redis or database in production)
user_sessions = {}

class QueryRequest(BaseModel):
    message: str
    user_id: str = "default_user"

class QueryResponse(BaseModel):
    response: str
    session_id: str

def get_or_create_session(user_id: str):
    """Get existing session or create a new one for the user"""
    if user_id not in user_sessions:
        session = agent_engine.create_session(user_id=user_id)
        user_sessions[user_id] = session["id"]
    return user_sessions[user_id]

@app.post("/query", response_model=QueryResponse)
async def query_agent(request: QueryRequest):
    """Send a query to the agent and get response (auto-manages session)"""
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

@app.post("/query-stream")
async def query_agent_stream(request: QueryRequest):
    """Stream the agent response in real-time (auto-manages session)"""
    async def generate_stream():
        try:
            session_id = get_or_create_session(request.user_id)
            
            for event in agent_engine.stream_query(
                user_id=request.user_id, 
                session_id=session_id, 
                message=request.message
            ):
                for part in event["content"]["parts"]:
                    yield f"data: {json.dumps({'text': part['text'], 'session_id': session_id})}\n\n"
                await asyncio.sleep(0.1)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@app.post("/reset-session")
async def reset_session(user_id: str = "default_user"):
    """Reset the session for a user"""
    try:
        if user_id in user_sessions:
            del user_sessions[user_id]
        return {"message": f"Session reset for user: {user_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset session: {str(e)}")

@app.get("/sessions")
async def list_sessions():
    """List all active sessions"""
    return {"sessions": user_sessions}

@app.get("/")
async def root():
    return {"message": "Vertex AI Agent API is running", "usage": "POST to /query or /query-stream with JSON body"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)