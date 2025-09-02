from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import json
import time
import os
import logging
import re
import base64
import asyncio
from typing import Dict, Any, List, Optional
import uuid
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Gemini Processor API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration constants
GEMINI_TIMEOUT = 120
IMAGE_TIMEOUT = 300  # 5 minutes timeout for image generation
MAX_RETRIES = 3
RETRY_DELAY = 2
BACKOFF_MULTIPLIER = 2

# Image generation model (using only the most reliable one)
IMAGE_MODEL = "gemini-2.5-flash-image-preview"

# Store for tracking request status
request_store = {}

def retry_on_server_error(max_retries=MAX_RETRIES, base_delay=RETRY_DELAY):
    """Decorator to retry functions on server errors"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    error_msg = str(e).lower()
                    
                    if any(code in error_msg for code in ['502', '503', '504', '500', 'server error', 'bad gateway']):
                        if attempt < max_retries - 1:
                            delay = base_delay * (BACKOFF_MULTIPLIER ** attempt)
                            logger.warning(f"Server error on attempt {attempt + 1}/{max_retries}, retrying in {delay}s: {e}")
                            time.sleep(delay)
                            continue
                    break
            
            logger.error(f"All {max_retries} attempts failed. Last error: {last_exception}")
            raise last_exception
        return wrapper
    return decorator

# Pydantic models
class APIOutput(BaseModel):
    response: str
    session_id: str

class StreamingProcessingRequest(BaseModel):
    api_output: APIOutput
    generate_image: bool = True
    webhook_url: Optional[str] = None  # Optional webhook for image completion

class FormattedContentResponse(BaseModel):
    request_id: str
    session_id: str
    formatted_content: Dict[str, str]
    proof: List[str]
    processing_timestamp: float
    status: str
    type: str = "formatted_content"

class ImageResponse(BaseModel):
    request_id: str
    session_id: str
    generated_media: Dict[str, Any]
    processing_timestamp: float
    status: str
    type: str = "generated_image"

class GeminiProcessor:
    def __init__(self, gemini_api_key: str):
        self.gemini_api_key = gemini_api_key
        self.client = genai.Client(api_key=gemini_api_key)
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Create output directories
        os.makedirs("outputs", exist_ok=True)
        os.makedirs("outputs/images", exist_ok=True)
    
    def extract_hyperlinks(self, text: str) -> List[str]:
        """Extract hyperlinks from text using regex"""
        url_pattern = r'https?://[^\s\)]+'
        urls = re.findall(url_pattern, text)
        
        unique_urls = []
        for url in urls:
            if url not in unique_urls:
                unique_urls.append(url)
        
        return unique_urls
        
    @retry_on_server_error()
    def generate_formatted_content(self, content: str, style: str = "detailed") -> str:
        """Generate formatted content using Gemini API"""
        try:
            if style == "concise":
                prompt = f"""Please provide a concise, well-structured summary of the following content. 
                Focus on key points and main insights. Keep it brief but informative (max 200 words):
                
                {content}"""
            else:  # detailed
                prompt = f"""Please provide a comprehensive, detailed analysis of the following content. 
                Include thorough explanations, examples, and insights. Structure it clearly with sections and bullet points.
                Make it easy to read and understand:
                
                {content}"""
            
            response = self.client.models.generate_content(
                model="gemini-1.5-flash",
                contents=[prompt]
            )
            
            return response.candidates[0].content.parts[0].text
            
        except Exception as e:
            logger.error(f"Error generating formatted content: {e}")
            raise

    @retry_on_server_error()
    def generate_image_fast(self, prompt: str, num_images: int = 1) -> List[Dict[str, str]]:
        """
        Generate images using gemini-2.5-flash-image-preview model only
        
        Args:
            prompt: Text description for image generation
            num_images: Number of images to generate
            
        Returns:
            List of dictionaries containing image data and metadata
        """
        try:
            logger.info(f"Generating {num_images} image(s) with {IMAGE_MODEL}, prompt: {prompt}")
            
            image_data_list = []
            for i in range(num_images):
                try:
                    logger.info(f"Generating image {i+1}/{num_images} with {IMAGE_MODEL}...")
                    
                    # Generate image with the specified model
                    response = self.client.models.generate_content(
                        model=IMAGE_MODEL,
                        contents=[prompt],
                        timeout=IMAGE_TIMEOUT  # 5 minutes
                    )
                    
                    # Extract image data
                    image_found = False
                    for part in response.candidates[0].content.parts:
                        if part.inline_data is not None:
                            # Convert to base64
                            image_bytes = part.inline_data.data
                            base64_data = base64.b64encode(image_bytes).decode('utf-8')
                            
                            # Save to file as backup
                            filename = f"outputs/images/generated_image_{int(time.time())}_{i}.png"
                            image = Image.open(BytesIO(image_bytes))
                            image.save(filename)
                            
                            # Create image data object
                            image_data = {
                                "id": f"image_{int(time.time())}_{i}",
                                "filename": filename,
                                "base64_data": base64_data,
                                "format": "png",
                                "size_bytes": len(image_bytes),
                                "prompt": prompt,
                                "model_used": IMAGE_MODEL
                            }
                            
                            image_data_list.append(image_data)
                            logger.info(f"Image {i+1} generated successfully with {IMAGE_MODEL} and saved to: {filename}")
                            image_found = True
                            break
                    
                    # If no image was generated, create error entry
                    if not image_found:
                        error_data = {
                            "id": f"error_image_{int(time.time())}_{i}",
                            "filename": f"outputs/images/error_image_{int(time.time())}_{i}.txt",
                            "base64_data": "",
                            "format": "error",
                            "size_bytes": 0,
                            "prompt": prompt,
                            "error": f"No image generated by {IMAGE_MODEL}",
                            "model_used": IMAGE_MODEL
                        }
                        image_data_list.append(error_data)
                        
                        # Save error placeholder
                        with open(error_data["filename"], 'w') as f:
                            f.write(f"Image generation failed for prompt: {prompt}\n")
                            f.write(f"Model used: {IMAGE_MODEL}\n")
                            f.write(f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                        
                        logger.warning(f"Image {i+1} generation failed with {IMAGE_MODEL}")
                        
                except Exception as e:
                    logger.error(f"Error generating image {i}: {e}")
                    error_data = {
                        "id": f"error_image_{int(time.time())}_{i}",
                        "filename": f"outputs/images/error_image_{int(time.time())}_{i}.txt",
                        "base64_data": "",
                        "format": "error",
                        "size_bytes": 0,
                        "prompt": prompt,
                        "error": str(e),
                        "model_used": IMAGE_MODEL
                    }
                    image_data_list.append(error_data)
                    
                    # Save error details
                    with open(error_data["filename"], 'w') as f:
                        f.write(f"Image generation error: {str(e)}\n")
                        f.write(f"Prompt: {prompt}\n")
                        f.write(f"Model used: {IMAGE_MODEL}\n")
                        f.write(f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            
            logger.info(f"Image generation completed. Generated {len([img for img in image_data_list if img.get('format') != 'error'])} successful images")
            return image_data_list
            
        except Exception as e:
            logger.error(f"Error in image generation: {e}")
            return [{
                "id": f"error_image_{int(time.time())}",
                "filename": f"outputs/images/error_image_{int(time.time())}.txt",
                "base64_data": "",
                "format": "error",
                "size_bytes": 0,
                "prompt": prompt,
                "error": str(e),
                "model_used": IMAGE_MODEL
            }]

    async def process_formatted_content_async(self, api_output: APIOutput, request_id: str):
        """Process formatted content asynchronously"""
        try:
            # Extract hyperlinks
            hyperlinks = self.extract_hyperlinks(api_output.response)
            
            # Generate formatted content
            loop = asyncio.get_event_loop()
            concise_content = await loop.run_in_executor(
                self.executor, 
                self.generate_formatted_content, 
                api_output.response, 
                "concise"
            )
            detailed_content = await loop.run_in_executor(
                self.executor, 
                self.generate_formatted_content, 
                api_output.response, 
                "detailed"
            )
            
            return FormattedContentResponse(
                request_id=request_id,
                session_id=api_output.session_id,
                formatted_content={
                    "concise": concise_content,
                    "detailed": detailed_content
                },
                proof=hyperlinks,
                processing_timestamp=time.time(),
                status="success"
            )
            
        except Exception as e:
            logger.error(f"Error processing formatted content: {e}")
            raise

    async def process_image_async(self, api_output: APIOutput, request_id: str):
        """Process image generation asynchronously"""
        try:
            # Create image prompt
            image_prompt = f"Create a visual representation of: {api_output.response[:100]}..."
            
            # Generate image
            loop = asyncio.get_event_loop()
            image_data_list = await loop.run_in_executor(
                self.executor, 
                self.generate_image_fast, 
                image_prompt, 
                1
            )
            
            return ImageResponse(
                request_id=request_id,
                session_id=api_output.session_id,
                generated_media={"images": image_data_list},
                processing_timestamp=time.time(),
                status="success"
            )
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            return ImageResponse(
                request_id=request_id,
                session_id=api_output.session_id,
                generated_media={"images": []},
                processing_timestamp=time.time(),
                status="error"
            )

# Initialize the processor
GEMINI_API_KEY = "AIzaSyBjBCD1XXOBXrmAOBJ-SdtebCTx7OHswf8"
processor = GeminiProcessor(GEMINI_API_KEY)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Streaming Gemini Processor API",
        "version": "1.0.0",
        "endpoints": {
            "/process-streaming": "POST - Stream formatted content first, then image",
            "/process-webhook": "POST - Send formatted content immediately, image via webhook",
            "/health": "GET - Health check"
        },
        "timeouts": {
            "text_processing": f"{GEMINI_TIMEOUT}s",
            "image_generation": f"{IMAGE_TIMEOUT}s (5 minutes)",
            "image_model": IMAGE_MODEL
        }
    }

@app.post("/process-streaming")
async def process_streaming(request: StreamingProcessingRequest):
    """
    Stream processing endpoint - sends formatted content first, then image
    
    Returns Server-Sent Events stream with two payloads
    """
    async def generate_stream():
        request_id = str(uuid.uuid4())
        
        try:
            # First: Send formatted content
            formatted_response = await processor.process_formatted_content_async(
                request.api_output, request_id
            )
            
            # Send first payload (formatted content)
            yield f"data: {formatted_response.json()}\n\n"
            
            # Second: Generate and send image if requested
            if request.generate_image:
                image_response = await processor.process_image_async(
                    request.api_output, request_id
                )
                
                # Send second payload (image)
                yield f"data: {image_response.json()}\n\n"
            
            # Send completion signal
            yield f"data: {json.dumps({'type': 'complete', 'request_id': request_id})}\n\n"
            
        except Exception as e:
            logger.error(f"Error in streaming process: {e}")
            error_payload = {
                "type": "error",
                "request_id": request_id,
                "error": str(e),
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(error_payload)}\n\n"
    
    return StreamingResponse(
        generate_stream(), 
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

async def send_image_to_webhook(webhook_url: str, image_response: ImageResponse):
    """Send image response to webhook URL"""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=image_response.dict()) as response:
                logger.info(f"Webhook sent successfully to {webhook_url}, status: {response.status}")
    except Exception as e:
        logger.error(f"Failed to send webhook to {webhook_url}: {e}")

@app.post("/process-webhook")
async def process_webhook(request: StreamingProcessingRequest, background_tasks: BackgroundTasks):
    """
    Webhook processing endpoint - sends formatted content immediately, 
    then processes image in background and sends to webhook
    """
    request_id = str(uuid.uuid4())
    
    try:
        # Process formatted content immediately
        formatted_response = await processor.process_formatted_content_async(
            request.api_output, request_id
        )
        
        # If image generation is requested and webhook URL is provided
        if request.generate_image and request.webhook_url:
            # Add image processing to background tasks
            async def process_and_send_image():
                image_response = await processor.process_image_async(
                    request.api_output, request_id
                )
                await send_image_to_webhook(request.webhook_url, image_response)
            
            background_tasks.add_task(process_and_send_image)
        
        # Return formatted content immediately
        return formatted_response
        
    except Exception as e:
        logger.error(f"Error in webhook process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": time.time()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)