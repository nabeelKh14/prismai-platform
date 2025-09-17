import asyncio
import structlog
from typing import List, AsyncGenerator
import whisper
import requests  # For VAPI TTS
from dotenv import load_dotenv
import os
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

logger = structlog.get_logger("services")

# Streaming STT Engine with Whisper
class StreamingSTTEngine:
    def __init__(self, tenant_id: str = None):
        self.tenant_id = tenant_id
        self.model = whisper.load_model("base")  # Load the Whisper model (can choose base, small, medium, large)
    
    async def initialize(self):
        logger.debug("STT initialize", tenant_id=self.tenant_id)
    
    async def transcribe_stream(self, audio_bytes: bytes, call_id: str = None) -> str:
        # Process audio using Whisper to transcribe it
        await asyncio.sleep(0.05)  # Simulate some processing delay

        # We assume the audio bytes are in a format Whisper can process (e.g., WAV or MP3)
        result = self.model.transcribe(audio_bytes)  # Transcribe the audio bytes
        logger.debug(f"STT Result: {result['text']}")
        return result['text']  # Return the transcribed text

    async def cleanup(self):
        logger.debug("STT cleanup", tenant_id=self.tenant_id)


# Streaming TTS Engine with VAPI
class StreamingTTSEngine:
    def __init__(self, tenant_id: str = None):
        self.tenant_id = tenant_id
        self._stop = False
        self.api_key = os.getenv("VAPI_API_KEY")  # Get the API key from the environment variable

    async def initialize(self):
        logger.debug("TTS initialize", tenant_id=self.tenant_id)
    
    async def warm_up(self):
        # Optional: Pre-load TTS settings to reduce delay
        logger.debug("TTS warm up", tenant_id=self.tenant_id)

    async def synthesize_stream(self, text: str, voice_id: str = None, tenant_id: str = None) -> AsyncGenerator[bytes, None]:
        # Use VAPI to convert the text into speech
        url = "https://api.vapi.ai/v1/text-to-speech"  # Ensure this URL is correct based on VAPI docs

        # Set up the request data for VAPI
        data = {
            "text": text,
            "voice": voice_id or "en_us_male",  # Default to en_us_male if no voice_id provided
            "format": "mp3",  # Output audio format
        }

        # Set up headers with the API Key for authentication
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        # Send POST request to VAPI TTS API
        response = requests.post(url, json=data, headers=headers)

        if response.status_code == 200:
            # Simulate streaming by yielding chunks progressively
            audio_content = response.content
            chunk_size = 1024  # Adjust the chunk size as needed
            for i in range(0, len(audio_content), chunk_size):
                if self._stop:
                    break
                await asyncio.sleep(0.02)  # Simulate network delay
                yield audio_content[i:i + chunk_size]

            # Final silence chunk (end of audio)
            await asyncio.sleep(0.01)
            yield b""
        else:
            logger.error(f"Failed to synthesize speech: {response.status_code} - {response.text}")

    async def stop_current_synthesis(self):
        self._stop = True

    async def cleanup(self):
        logger.debug("TTS cleanup", tenant_id=self.tenant_id)


# VAD (Voice Activity Detection) Processor for detecting speech
class VADProcessor:
    def __init__(self, frame_duration_ms: int = 20, silence_threshold_ms: int = 1500, speech_threshold_ms: int = 300):
        self._buf = []
        self._speech_ready = False
    
    async def process_frame(self, frame):
        # Simple heuristic: any frame means speech
        self._buf.append(frame)
        self._speech_ready = True
    
    def has_speech_segment(self) -> bool:
        return self._speech_ready
    
    def get_speech_segment(self) -> List:
        seg = list(self._buf)
        self._buf.clear()
        self._speech_ready = False
        return seg
    
    async def update(self):
        await asyncio.sleep(0.01)
    
    async def cleanup(self):
        self._buf.clear()

# Audio Processor for combining and analyzing audio frames
class AudioProcessor:
    def combine_frames(self, frames):
        # Naive merge: Combine frames into one byte string
        return b"".join([f.payload for f in frames])
    
    def calculate_rms_level(self, audio_bytes: bytes) -> float:
        if not audio_bytes:
            return 0.0
        # Naive RMS calculation
        val = sum(b for b in audio_bytes) / (len(audio_bytes) * 255)
        return min(1.0, max(0.0, val))
