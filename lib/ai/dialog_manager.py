class DialogManager:
    def __init__(self, tenant_manager, google_api_key: Optional[str] = None):
        self.tenant_manager = tenant_manager
        
        # Set up Google APIs for Text-to-Speech and Speech-to-Text
        self.client_tts = tts.TextToSpeechClient()
        self.client_stt = stt.SpeechClient()
        
        api_key = google_api_key or os.getenv("GOOGLE_API_KEY")
        
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel("gemini-1.5-flash")
                structlog.get_logger("dialog_manager").info("DialogManager: Google Gemini client initialized")
            except Exception as e:
                structlog.get_logger("dialog_manager").exception("Failed to init Google Gemini", error=str(e))
                self.model = None
        else:
            self.model = None
            structlog.get_logger("dialog_manager").info("DialogManager: Running with heuristic fallback (no Google AI)")

    async def warmup_models(self):
        structlog.get_logger("dialog_manager").info("Warmup called (no-op)")

    async def get_tenant_config(self, tenant_id: str) -> Dict[str, Any]:
        if self.tenant_manager:
            return await self.tenant_manager.get_tenant_config(tenant_id)
        return {"business_name": "Demo Clinic", "language": "en-US"}

    async def process_turn(self, call_sid: str, tenant_id: str, user_text: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Handle a caller input and return receptionist-style response.
        Uses Google Gemini if available, otherwise keyword heuristics.
        """
        start = asyncio.get_running_loop().time()
        try:
            text = (user_text or "").lower()

            if any(k in text for k in ["book", "appointment", "schedule"]):
                intent = "booking"
                response_text = "Sure — I can help book an appointment. What day/time works for you?"
                actions = [{"type": "log_booking_intent"}]

            elif any(k in text for k in ["price", "cost", "charge"]):
                intent = "pricing"
                response_text = "Our pricing varies — which service are you interested in?"
                actions = []

            elif any(k in text for k in ["bye", "goodbye", "thanks"]):
                intent = "goodbye"
                response_text = "Thanks for calling! Goodbye."
                actions = [{"type": "end_call"}]

            else:
                if self.model:
                    try:
                        prompt = f"""
                        You are a friendly AI receptionist for tenant: {tenant_id}.
                        The caller said: "{user_text}".
                        
                        Answer conversationally in under 50 words. Greet warmly,
                        address the caller’s needs, and if appropriate, schedule
                        or confirm appointments. Keep it professional, concise,
                        and natural — like a real person on the phone.
                        """
                        response = await asyncio.to_thread(
                            self.model.generate_content,
                            prompt
                        )

                        if response.text:
                            response_text = response.text.strip()
                        else:
                            response_text = "Sorry, I didn't get that. Could you repeat?"

                        actions = []
                        intent = "ai_response"

                    except Exception as e:
                        structlog.get_logger("dialog_manager").exception("Google Gemini call failed; falling back", error=str(e))
                        response_text = "Sorry, I couldn't reach the model. Can you repeat?"
                        actions = []
                        intent = "error"
                else:
                    response_text = "Sorry, I didn't understand that. Can you repeat?"
                    actions = []
                    intent = "unknown"

            latency = (asyncio.get_running_loop().time() - start)
            structlog.get_logger("dialog_manager").info("Processed turn", call_sid=call_sid, tenant=tenant_id, intent=intent, latency_ms=latency * 1000)
            
            # Convert the response text to speech (TTS)
            audio_content = await self.generate_tts(response_text)

            return {"text": response_text, "audio": audio_content}

        except Exception as e:
            structlog.get_logger("dialog_manager").exception("process_turn failed", error=str(e))
            return {"text": "I'm having trouble. Please repeat.", "actions": []}

    async def generate_tts(self, text: str) -> bytes:
        """
        Use Google Cloud Text-to-Speech API to convert text into speech.
        """
        input_text = tts.SynthesisInput(text=text)
        voice = tts.VoiceSelectionParams(
            language_code="en-US", name="en-US-Wavenet-D", ssml_gender=tts.SsmlVoiceGender.MALE
        )
        audio_config = tts.AudioConfig(
            audio_encoding=tts.AudioEncoding.LINEAR16
        )

        # Synthesize the speech
        response = self.client_tts.synthesize_speech(input=input_text, voice=voice, audio_config=audio_config)

        # Return the audio content as bytes
        return response.audio_content

    async def process_audio(self, audio_bytes: bytes) -> str:
        """
        Process the audio input (speech-to-text) and return the transcribed text.
        """
        audio = stt.RecognitionAudio(content=audio_bytes)

        config = stt.RecognitionConfig(
            encoding=stt.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="en-US",
        )

        # Send audio to Google STT service
        response = self.client_stt.recognize(config=config, audio=audio)

        # Return the transcribed text
        if response.results:
            return response.results[0].alternatives[0].transcript
        else:
            return "Sorry, I didn't understand that."
