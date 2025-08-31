# LLM Auditor FastAPI

A FastAPI-based REST API for LLM auditing using Google Vertex AI Agent Engines.

## Features

- **JSON Input/Output**: All endpoints accept and return JSON data
- **Health Check**: Monitor API status and agent engine availability
- **Flexible Querying**: Support for both structured and flexible JSON input
- **Error Handling**: Comprehensive error handling with meaningful responses
- **Async Support**: Built with FastAPI for high performance

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables (create a `.env` file):
```env
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
AGENT_ENGINE_ID=projects/your-project/locations/us-central1/reasoningEngines/your-engine-id
```

## Running the API

```bash
python main.py
```

The API will start on `http://localhost:8000`

## API Endpoints

### 1. Health Check

**GET** `/health`

Returns the health status of the API and agent engine availability.

**Response:**
```json
{
  "status": "healthy",
  "message": "LLM Auditor API is running",
  "available": true
}
```

### 2. Simple Query

**POST** `/query-simple`

Accepts any JSON input and returns a response. This endpoint is flexible and doesn't require specific field validation.

**Request:**
```json
{
  "message": "Your question here",
  "user_id": "optional_user_id",
  "any_custom_field": "will be accepted"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Query received (mock response)",
  "response": "Mock response to: Your question here",
  "user_id": "optional_user_id",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 3. Agent Query

**POST** `/query`

Structured endpoint for querying the agent engine with proper validation.

**Request:**
```json
{
  "message": "Your question here",
  "user_id": "user_identifier",
  "agent_engine_id": "projects/project/locations/location/reasoningEngines/engine-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Query successful",
  "response": "Agent response text",
  "session_id": "session_identifier"
}
```

## Testing the API

Use the provided test script:

```bash
python test_api.py
```

Or test manually with curl:

```bash
# Health check
curl http://localhost:8000/health

# Simple query
curl -X POST http://localhost:8000/query-simple \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello world", "user_id": "test_user"}'

# Agent query
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"message": "What is AI?", "user_id": "test_user"}'
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **200**: Success
- **422**: Validation error (invalid JSON structure)
- **503**: Service unavailable (agent engine not available)

## Example Usage

### Python Client

```python
import requests

# Health check
response = requests.get("http://localhost:8000/health")
print(response.json())

# Query the agent
query_data = {
    "message": "Explain machine learning",
    "user_id": "student_123"
}

response = requests.post("http://localhost:8000/query-simple", json=query_data)
result = response.json()
print(f"Response: {result['response']}")
```

### JavaScript/Node.js Client

```javascript
// Health check
fetch('http://localhost:8000/health')
  .then(response => response.json())
  .then(data => console.log(data));

// Query the agent
const queryData = {
  message: "What is artificial intelligence?",
  user_id: "user_456"
};

fetch('http://localhost:8000/query-simple', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(queryData)
})
.then(response => response.json())
.then(data => console.log(data.response));
```

## Troubleshooting

1. **Agent Engine Not Available**: Make sure you have the correct Google Cloud credentials and the agent engine is properly configured.

2. **Import Errors**: Install the required packages:
   ```bash
   pip install google-cloud-aiplatform[agent-engines]
   ```

3. **Port Already in Use**: Change the port in `main.py` or stop other services using port 8000.

## Development

The API is built with:
- **FastAPI**: Modern, fast web framework
- **Pydantic**: Data validation using Python type annotations
- **Uvicorn**: ASGI server for running the application
- **Google Cloud AI Platform**: For agent engine integration
