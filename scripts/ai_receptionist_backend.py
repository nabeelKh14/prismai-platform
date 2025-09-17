"""
AI Receptionist Backend Service
Integrates with VAPI for call handling and provides human-like conversation
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import uuid

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="AI Receptionist Backend", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize Gemini AI
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# VAPI Configuration
VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_BASE_URL = "https://api.vapi.ai"

class CallRequest(BaseModel):
    phone_number: str
    user_id: str
    business_name: str
    greeting_message: Optional[str] = None

class BookingRequest(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    service_type: str
    appointment_date: str
    user_id: str
    call_log_id: Optional[str] = None

class VAPIManager:
    """Manages VAPI integration for call handling"""
    
    def __init__(self):
        self.api_key = VAPI_API_KEY
        self.base_url = VAPI_BASE_URL
        
    async def create_assistant(self, user_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a VAPI assistant for a user"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        assistant_config = {
            "name": config.get("assistant_name", "AI Receptionist"),
            "model": {
                "provider": "openai",
                "model": "gpt-4",
                "temperature": 0.7,
                "systemMessage": self._generate_system_message(config)
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "21m00Tcm4TlvDq8ikWAM",  # Professional female voice
                "stability": 0.5,
                "similarityBoost": 0.8
            },
            "firstMessage": config.get("greeting_message", "Hello! Thank you for calling. How can I assist you today?"),
            "endCallMessage": "Thank you for calling. Have a great day!",
            "recordingEnabled": True,
            "silenceTimeoutSeconds": 30,
            "maxDurationSeconds": 600,
            "backgroundSound": "office",
            "backchannelingEnabled": True,
            "backgroundDenoisingEnabled": True,
            "modelOutputInMessagesEnabled": True
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/assistant",
                headers=headers,
                json=assistant_config
            )
            
            if response.status_code == 201:
                return response.json()
            else:
                logger.error(f"Failed to create assistant: {response.text}")
                raise HTTPException(status_code=500, detail="Failed to create assistant")
    
    def _generate_system_message(self, config: Dict[str, Any]) -> str:
        """Generate system message for the AI assistant"""
        business_name = config.get("business_name", "our business")
        services = config.get("services", ["General Consultation"])
        business_hours = config.get("business_hours", {})
        
        system_message = f"""
        You are a professional AI receptionist for {business_name}. Your role is to:
        
        1. Greet callers warmly and professionally
        2. Answer questions about our services: {', '.join(services)}
        3. Schedule appointments when requested
        4. Provide business hours and location information
        5. Handle inquiries with empathy and efficiency
        
        Business Hours: {json.dumps(business_hours, indent=2)}
        
        IMPORTANT GUIDELINES:
        - Always be polite, professional, and helpful
        - Speak naturally and conversationally, like a human receptionist
        - If you need to schedule an appointment, collect: name, phone, email, preferred service, and preferred date/time
        - If asked about services not in our list, politely explain what we do offer
        - For complex issues, offer to have someone call them back
        - Keep responses concise but complete
        - Use natural speech patterns with appropriate pauses
        
        When scheduling appointments, use this format:
        BOOKING_REQUEST: {{
            "customer_name": "Name",
            "customer_phone": "Phone",
            "customer_email": "Email",
            "service_type": "Service",
            "appointment_date": "YYYY-MM-DD HH:MM"
        }}
        """
        
        return system_message.strip()

    async def make_call(self, phone_number: str, assistant_id: str) -> Dict[str, Any]:
        """Initiate a call using VAPI"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        call_config = {
            "assistantId": assistant_id,
            "phoneNumberId": phone_number,
            "customer": {
                "number": phone_number
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/call",
                headers=headers,
                json=call_config
            )
            
            if response.status_code == 201:
                return response.json()
            else:
                logger.error(f"Failed to make call: {response.text}")
                raise HTTPException(status_code=500, detail="Failed to initiate call")

class AIReceptionistService:
    """Core AI Receptionist service"""
    
    def __init__(self):
        self.vapi_manager = VAPIManager()
    
    async def process_call_transcript(self, transcript: str, user_id: str) -> Dict[str, Any]:
        """Process call transcript and extract booking information"""
        try:
            # Use Gemini to analyze the transcript
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            prompt = """
            Analyze this call transcript and extract:
            1. Sentiment score (-1.0 to 1.0)
            2. Any booking requests with details
            3. Customer satisfaction indicators
            4. Key topics discussed
            
            Return JSON format:
            {
                "sentiment_score": float,
                "booking_request": {
                    "customer_name": str,
                    "customer_phone": str,
                    "service_type": str,
                    "appointment_date": str
                } or null,
                "topics": [str],
                "satisfaction": str
            }
            
            Transcript: """ + transcript
            
            response = model.generate_content(prompt)
            analysis = json.loads(response.text)
            return analysis
            
        except Exception as e:
            logger.error(f"Error processing transcript: {e}")
            return {
                "sentiment_score": 0.0,
                "booking_request": None,
                "topics": [],
                "satisfaction": "unknown"
            }

# Initialize services
ai_service = AIReceptionistService()

@app.post("/api/calls/initiate")
async def initiate_call(request: CallRequest):
    """Initiate a call using VAPI"""
    try:
        # Get user's AI configuration
        config_response = supabase.table("ai_configs").select("*").eq("user_id", request.user_id).single().execute()
        
        if not config_response.data:
            raise HTTPException(status_code=404, detail="AI configuration not found")
        
        config = config_response.data
        
        # Create or get assistant
        if not config.get("vapi_assistant_id"):
            assistant = await ai_service.vapi_manager.create_assistant(request.user_id, {
                **config,
                "business_name": request.business_name
            })
            
            # Update config with assistant ID
            supabase.table("ai_configs").update({
                "vapi_assistant_id": assistant["id"]
            }).eq("user_id", request.user_id).execute()
            
            assistant_id = assistant["id"]
        else:
            assistant_id = config["vapi_assistant_id"]
        
        # Initiate call
        call_result = await ai_service.vapi_manager.make_call(request.phone_number, assistant_id)
        
        # Log the call
        call_log = {
            "user_id": request.user_id,
            "caller_phone": request.phone_number,
            "call_status": "initiated",
            "created_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("call_logs").insert(call_log).execute()
        
        return {"success": True, "call_id": call_result["id"]}
        
    except Exception as e:
        logger.error(f"Error initiating call: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bookings/create")
async def create_booking(request: BookingRequest):
    """Create a new booking"""
    try:
        booking_data = {
            "user_id": request.user_id,
            "customer_name": request.customer_name,
            "customer_phone": request.customer_phone,
            "customer_email": request.customer_email,
            "service_type": request.service_type,
            "appointment_date": request.appointment_date,
            "status": "scheduled",
            "created_at": datetime.utcnow().isoformat()
        }
        
        if request.call_log_id:
            booking_data["call_log_id"] = request.call_log_id
        
        result = supabase.table("bookings").insert(booking_data).execute()
        
        return {"success": True, "booking_id": result.data[0]["id"]}
        
    except Exception as e:
        logger.error(f"Error creating booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/{user_id}")
async def get_analytics(user_id: str):
    """Get analytics data for a user"""
    try:
        # Get call statistics
        calls_response = supabase.table("call_logs").select("*").eq("user_id", user_id).execute()
        calls = calls_response.data
        
        # Get booking statistics
        bookings_response = supabase.table("bookings").select("*").eq("user_id", user_id).execute()
        bookings = bookings_response.data
        
        # Calculate metrics
        total_calls = len(calls)
        total_bookings = len(bookings)
        conversion_rate = (total_bookings / total_calls * 100) if total_calls > 0 else 0
        
        # Average sentiment
        sentiments = [call.get("sentiment_score", 0) for call in calls if call.get("sentiment_score")]
        avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0
        
        # Recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_calls = [call for call in calls if datetime.fromisoformat(call["created_at"].replace("Z", "+00:00")) > thirty_days_ago]
        recent_bookings = [booking for booking in bookings if datetime.fromisoformat(booking["created_at"].replace("Z", "+00:00")) > thirty_days_ago]
        
        return {
            "total_calls": total_calls,
            "total_bookings": total_bookings,
            "conversion_rate": round(conversion_rate, 2),
            "average_sentiment": round(avg_sentiment, 2),
            "recent_calls": len(recent_calls),
            "recent_bookings": len(recent_bookings),
            "call_history": calls[-10:],  # Last 10 calls
            "booking_history": bookings[-10:]  # Last 10 bookings
        }
        
    except Exception as e:
        logger.error(f"Error getting analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/call-updates/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time call updates"""
    await websocket.accept()
    
    try:
        while True:
            # In a real implementation, you would listen for VAPI webhooks
            # and push updates to connected clients
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
