from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
from typing import Dict, Any, List

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

# Pydantic models
class APIOutput(BaseModel):
    response: str
    session_id: str

class ProcessingRequest(BaseModel):
    api_output: APIOutput
    generate_image: bool = True

class ProcessingResponse(BaseModel):
    original_query: str
    session_id: str
    formatted_content: Dict[str, str]
    generated_media: Dict[str, Any]
    proof: List[str]
    processing_timestamp: float
    status: str

class GeminiProcessor:
    def __init__(self, gemini_api_key: str):
        """
        Initialize the Gemini Processor service
        
        Args:
            gemini_api_key: Gemini API key for authentication
        """
        self.gemini_api_key = gemini_api_key
        
        # Initialize Gemini client with API key
        self.client = genai.Client(api_key=gemini_api_key)
        
        # Create output directories
        os.makedirs("outputs", exist_ok=True)
        os.makedirs("outputs/images", exist_ok=True)
    
    def extract_hyperlinks(self, text: str) -> List[str]:
        """
        Extract hyperlinks from text using regex
        
        Args:
            text: The text to extract hyperlinks from
            
        Returns:
            List of hyperlinks found in the text
        """
        # Regex pattern to match URLs
        url_pattern = r'https?://[^\s\)]+'
        urls = re.findall(url_pattern, text)
        
        # Remove duplicates while preserving order
        unique_urls = []
        for url in urls:
            if url not in unique_urls:
                unique_urls.append(url)
        
        return unique_urls
        
    def generate_formatted_content(self, content: str, style: str = "detailed") -> str:
        """
        Generate formatted content using Gemini API
        
        Args:
            content: Raw content to format
            style: Either "concise" or "detailed"
            
        Returns:
            Formatted content string
        """
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
            
            # Use the Gemini API
            response = self.client.models.generate_content(
                model="gemini-1.5-flash",
                contents=[prompt]
            )
            
            return response.candidates[0].content.parts[0].text
            
        except Exception as e:
            logger.error(f"Error generating formatted content: {e}")
            raise
    
    def generate_image(self, prompt: str, num_images: int = 1) -> List[Dict[str, str]]:
        """
        Generate images using Gemini API and return as base64 data
        
        Args:
            prompt: Text description for image generation
            num_images: Number of images to generate
            
        Returns:
            List of dictionaries containing image data and metadata
        """
        try:
            logger.info(f"Generating {num_images} image(s) with prompt: {prompt}")
            
            image_data_list = []
            for i in range(num_images):
                try:
                    # Generate image using the correct API
                    response = self.client.models.generate_content(
                        model="gemini-2.5-flash-image-preview",
                        contents=[prompt],
                    )
                    
                    # Extract image data
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
                                "prompt": prompt
                            }
                            
                            image_data_list.append(image_data)
                            logger.info(f"Image generated and saved to: {filename}")
                            break
                    
                    # If no image was generated, create error entry
                    if len(image_data_list) <= i:
                        error_data = {
                            "id": f"error_image_{int(time.time())}_{i}",
                            "filename": f"outputs/images/error_image_{int(time.time())}_{i}.txt",
                            "base64_data": "",
                            "format": "error",
                            "size_bytes": 0,
                            "prompt": prompt,
                            "error": "Image generation failed"
                        }
                        image_data_list.append(error_data)
                        
                        # Save error placeholder
                        with open(error_data["filename"], 'w') as f:
                            f.write(f"Image generation failed for prompt: {prompt}\n")
                            f.write(f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                        
                        logger.warning(f"Image generation failed, error entry created")
                
                except Exception as e:
                    logger.error(f"Error generating image {i}: {e}")
                    error_data = {
                        "id": f"error_image_{int(time.time())}_{i}",
                        "filename": f"outputs/images/error_image_{int(time.time())}_{i}.txt",
                        "base64_data": "",
                        "format": "error",
                        "size_bytes": 0,
                        "prompt": prompt,
                        "error": str(e)
                    }
                    image_data_list.append(error_data)
                    
                    # Save error details
                    with open(error_data["filename"], 'w') as f:
                        f.write(f"Image generation error: {str(e)}\n")
                        f.write(f"Prompt: {prompt}\n")
                        f.write(f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            
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
                "error": str(e)
            }]
    
    def process_api_output(self, api_output: APIOutput, generate_image: bool = True) -> Dict[str, Any]:
        """
        Main processing function that processes the API output
        
        Args:
            api_output: The API output to process
            generate_image: Whether to generate an image
            
        Returns:
            Dictionary containing all processed outputs
        """
        try:
            logger.info(f"Starting processing for session: {api_output.session_id}")
            
            # Step 1: Extract hyperlinks from the input
            hyperlinks = self.extract_hyperlinks(api_output.response)
            logger.info(f"Extracted {len(hyperlinks)} hyperlinks from input")
            
            # Step 2: Generate formatted content (both versions)
            concise_content = self.generate_formatted_content(api_output.response, "concise")
            detailed_content = self.generate_formatted_content(api_output.response, "detailed")
            logger.info("Successfully generated formatted content")
            
            # Step 3: Generate image if requested
            image_data_list = []
            if generate_image:
                # Create a prompt based on the content for image generation
                image_prompt = f"Create a visual representation of: {api_output.response[:100]}..."
                image_data_list = self.generate_image(image_prompt, num_images=2)
                logger.info("Successfully generated images")
            
            # Step 4: Compile results
            results = {
                "original_query": api_output.response[:100] + "...",
                "session_id": api_output.session_id,
                "formatted_content": {
                    "concise": concise_content,
                    "detailed": detailed_content
                },
                "generated_media": {
                    "images": image_data_list
                },
                "proof": hyperlinks,
                "processing_timestamp": time.time(),
                "status": "success"
            }
            
            # Save results to file
            output_file = f"outputs/processing_results_{api_output.session_id}_{int(time.time())}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Processing completed successfully. Results saved to: {output_file}")
            return results
            
        except Exception as e:
            logger.error(f"Error in processing API output: {e}")
            return {
                "original_query": api_output.response[:100] + "...",
                "session_id": api_output.session_id,
                "status": "error",
                "error_message": str(e),
                "processing_timestamp": time.time()
            }

# Initialize the processor
GEMINI_API_KEY = "AIzaSyBjBCD1XXOBXrmAOBJ-SdtebCTx7OHswf8"
processor = GeminiProcessor(GEMINI_API_KEY)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Gemini Processor API",
        "version": "1.0.0",
        "endpoints": {
            "/process": "POST - Process API output with Gemini",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": time.time()}

@app.post("/process", response_model=ProcessingResponse)
async def process_api_output(request: ProcessingRequest):
    """
    Process API output with Gemini AI
    
    Args:
        request: ProcessingRequest containing API output and options
        
    Returns:
        ProcessingResponse with formatted content and generated media
    """
    try:
        logger.info(f"Received processing request for session: {request.api_output.session_id}")
        
        # Process the API output
        results = processor.process_api_output(
            api_output=request.api_output,
            generate_image=request.generate_image
        )
        
        if results.get("status") == "success":
            return ProcessingResponse(**results)
        else:
            raise HTTPException(status_code=500, detail=results.get("error_message", "Processing failed"))
            
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process-simple")
async def process_simple(api_output: APIOutput):
    """
    Simple processing endpoint that just returns formatted content
    
    Args:
        api_output: The API output to process
        
    Returns:
        Formatted content (concise and detailed) with proof links
    """
    try:
        logger.info(f"Processing simple request for session: {api_output.session_id}")
        
        # Extract hyperlinks
        hyperlinks = processor.extract_hyperlinks(api_output.response)
        
        # Generate formatted content
        concise_content = processor.generate_formatted_content(api_output.response, "concise")
        detailed_content = processor.generate_formatted_content(api_output.response, "detailed")
        
        return {
            "session_id": api_output.session_id,
            "formatted_content": {
                "concise": concise_content,
                "detailed": detailed_content
            },
            "proof": hyperlinks,
            "processing_timestamp": time.time(),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error in simple processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
