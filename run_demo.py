#!/usr/bin/env python3
"""
AI Receptionist Backend Demo
Run this script to start the backend and interact with the AI agent directly.
"""

import os
import sys
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import uuid

# Third party imports
try:
    import httpx
    import google.generativeai as genai
    from dotenv import load_dotenv
    from supabase import create_client, Client
    from rich.console import Console
    from rich.prompt import Prompt
    from rich.panel import Panel
    from rich.text import Text
    from rich.markdown import Markdown
    from rich.table import Table
except ImportError as e:
    print(f"Missing required packages. Please install: pip install {e.name}")
    print("Required packages: httpx google-generativeai python-dotenv supabase rich")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Rich console
console = Console()

class AIReceptionistDemo:
    def __init__(self):
        self.load_environment()
        self.setup_clients()
        self.session_id = str(uuid.uuid4())
        self.conversation_history = []
        
    def load_environment(self):
        """Load environment variables from .env.local"""
        env_files = ['.env.local', '.env']
        loaded = False
        
        for env_file in env_files:
            if os.path.exists(env_file):
                load_dotenv(env_file)
                loaded = True
                console.print(f"✅ Loaded environment from {env_file}", style="green")
                break
                
        if not loaded:
            console.print("❌ No .env file found. Please create .env.local with your API keys.", style="red")
            self.show_env_template()
            sys.exit(1)
            
        # Validate required environment variables
        required_vars = [
            'GEMINI_API_KEY',
            'VAPI_API_KEY',
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY'
        ]
        
        missing_vars = []
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)
                
        if missing_vars:
            console.print("❌ Missing required environment variables:", style="red")
            for var in missing_vars:
                console.print(f"   - {var}", style="red")
            self.show_env_template()
            sys.exit(1)
            
    def show_env_template(self):
        """Show environment variable template"""
        template = """
Create a .env.local file with the following variables:

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
VAPI_API_KEY=your_vapi_api_key

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
        """
        console.print(Panel(template, title="Environment Template", border_style="yellow"))
        
    def setup_clients(self):
        """Initialize API clients"""
        try:
            # Initialize Gemini
            genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Initialize Supabase
            supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            self.supabase = create_client(supabase_url, supabase_key)
            
            # Initialize HTTP client for VAPI
            self.http_client = httpx.AsyncClient()
            
            console.print("✅ All clients initialized successfully", style="green")
            
        except Exception as e:
            console.print(f"❌ Failed to initialize clients: {e}", style="red")
            sys.exit(1)
            
    async def test_connections(self):
        """Test all service connections"""
        console.print("\n🔍 Testing service connections...", style="blue")
        
        # Test Gemini
        try:
            response = await asyncio.to_thread(
                self.gemini_model.generate_content, 
                "Hello, this is a test. Please respond with 'Connection successful.'"
            )
            console.print("✅ Gemini AI: Connected", style="green")
        except Exception as e:
            console.print(f"❌ Gemini AI: {e}", style="red")
            
        # Test Supabase
        try:
            result = self.supabase.table('profiles').select('id').limit(1).execute()
            console.print("✅ Supabase: Connected", style="green")
        except Exception as e:
            console.print(f"❌ Supabase: {e}", style="red")
            
        # Test VAPI
        try:
            headers = {
                'Authorization': f"Bearer {os.getenv('VAPI_API_KEY')}",
                'Content-Type': 'application/json'
            }
            response = await self.http_client.get('https://api.vapi.ai/assistant', headers=headers)
            if response.status_code == 200:
                console.print("✅ VAPI: Connected", style="green")
            else:
                console.print(f"❌ VAPI: HTTP {response.status_code}", style="red")
        except Exception as e:
            console.print(f"❌ VAPI: {e}", style="red")
            
    async def create_demo_assistant(self):
        """Create a demo AI assistant configuration"""
        console.print("\n🤖 Creating demo AI assistant...", style="blue")
        
        system_prompt = """
You are a professional AI receptionist for a demo business. Your role is to:

1. Greet callers warmly and professionally
2. Answer questions about our services: General Consultation, Appointment Booking, Information Request
3. Schedule appointments when requested
4. Provide business hours: Monday-Friday 9AM-5PM, Saturday 10AM-2PM, Sunday Closed
5. Handle inquiries with empathy and efficiency

IMPORTANT GUIDELINES:
- Always be polite, professional, and helpful
- Speak naturally and conversationally
- If you need to schedule an appointment, collect: name, phone, email, preferred service, and preferred date/time
- For complex issues, offer to have someone call them back
- Keep responses concise but complete

When scheduling appointments, respond with:
BOOKING_REQUEST: {
  "customer_name": "Name",
  "customer_phone": "Phone", 
  "customer_email": "Email",
  "service_type": "Service",
  "appointment_date": "YYYY-MM-DD HH:MM"
}
        """.strip()
        
        self.system_prompt = system_prompt
        console.print("✅ Demo assistant configured", style="green")
        
    async def chat_with_agent(self, user_message: str) -> str:
        """Send a message to the AI agent and get response"""
        try:
            # Add user message to conversation history
            self.conversation_history.append({
                "role": "user",
                "content": user_message,
                "timestamp": datetime.now().isoformat()
            })
            
            # Prepare conversation for Gemini
            conversation_text = f"System: {self.system_prompt}\n\n"
            for msg in self.conversation_history[-10:]:  # Keep last 10 messages
                role = "Human" if msg["role"] == "user" else "Assistant"
                conversation_text += f"{role}: {msg['content']}\n"
            conversation_text += "Assistant: "
            
            # Get response from Gemini
            response = await asyncio.to_thread(
                self.gemini_model.generate_content,
                conversation_text
            )
            
            agent_response = response.text
            
            # Add agent response to conversation history
            self.conversation_history.append({
                "role": "assistant", 
                "content": agent_response,
                "timestamp": datetime.now().isoformat()
            })
            
            # Check for booking requests
            if "BOOKING_REQUEST:" in agent_response:
                await self.handle_booking_request(agent_response)
            
            return agent_response
            
        except Exception as e:
            error_msg = f"Error communicating with AI agent: {e}"
            logger.error(error_msg)
            return error_msg
            
    async def handle_booking_request(self, response: str):
        """Handle booking requests from the AI agent"""
        try:
            # Extract booking data from response
            booking_start = response.find("BOOKING_REQUEST:") + len("BOOKING_REQUEST:")
            booking_json = response[booking_start:].strip()
            
            # Try to parse the JSON
            booking_data = json.loads(booking_json)
            
            # Save to database (demo - would normally validate user)
            booking_record = {
                "customer_name": booking_data.get("customer_name"),
                "customer_phone": booking_data.get("customer_phone"),
                "customer_email": booking_data.get("customer_email"),
                "service_type": booking_data.get("service_type"),
                "appointment_date": booking_data.get("appointment_date"),
                "status": "scheduled",
                "notes": "Demo booking from run_demo.py",
                "created_at": datetime.now().isoformat()
            }
            
            console.print("\n📅 Booking Request Detected:", style="yellow")
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("Field")
            table.add_column("Value")
            
            for key, value in booking_record.items():
                if value and key != "created_at":
                    table.add_row(key.replace("_", " ").title(), str(value))
                    
            console.print(table)
            
        except json.JSONDecodeError:
            console.print("⚠️ Could not parse booking request JSON", style="yellow")
        except Exception as e:
            console.print(f"❌ Error handling booking: {e}", style="red")
            
    async def show_conversation_history(self):
        """Display conversation history"""
        if not self.conversation_history:
            console.print("No conversation history yet.", style="yellow")
            return
            
        console.print("\n📜 Conversation History:", style="blue")
        for i, msg in enumerate(self.conversation_history[-10:], 1):
            role_style = "blue" if msg["role"] == "user" else "green"
            role_name = "You" if msg["role"] == "user" else "AI Agent"
            timestamp = msg["timestamp"][:19]  # Remove microseconds
            
            console.print(f"[{i}] {timestamp} - {role_name}:", style=role_style)
            console.print(f"    {msg['content']}\n")
            
    def show_commands(self):
        """Show available commands"""
        commands = """
Available Commands:
- Type a message to chat with the AI agent
- /history - Show conversation history
- /clear - Clear conversation history
- /test - Test service connections
- /help - Show this help message
- /quit or /exit - Exit the demo
        """
        console.print(Panel(commands, title="Help", border_style="blue"))
        
    async def run_interactive_demo(self):
        """Run interactive demo session"""
        # Welcome message
        welcome = """
🤖 AI Receptionist Backend Demo

This demo allows you to interact directly with your AI receptionist agent.
The agent is configured with demo business information and can handle:
- General inquiries
- Appointment scheduling
- Business hours questions
- Service information

Type /help for available commands.
        """
        console.print(Panel(welcome, title="Welcome", border_style="green"))
        
        # Test connections
        await self.test_connections()
        
        # Create demo assistant
        await self.create_demo_assistant()
        
        console.print("\n💬 Start chatting with your AI agent (type /quit to exit):", style="blue")
        
        while True:
            try:
                user_input = Prompt.ask("\n[bold blue]You[/bold blue]")
                
                if user_input.lower() in ['/quit', '/exit']:
                    console.print("👋 Goodbye!", style="green")
                    break
                elif user_input.lower() == '/help':
                    self.show_commands()
                elif user_input.lower() == '/history':
                    await self.show_conversation_history()
                elif user_input.lower() == '/clear':
                    self.conversation_history = []
                    console.print("🗑️ Conversation history cleared", style="yellow")
                elif user_input.lower() == '/test':
                    await self.test_connections()
                elif user_input.strip():
                    # Send message to AI agent
                    console.print("\n[bold green]AI Agent[/bold green]:")
                    
                    with console.status("🤔 Thinking...", spinner="dots"):
                        response = await self.chat_with_agent(user_input)
                    
                    # Display response as markdown for better formatting
                    console.print(Markdown(response))
                    
            except KeyboardInterrupt:
                console.print("\n👋 Goodbye!", style="green")
                break
            except Exception as e:
                console.print(f"❌ Error: {e}", style="red")
                
    async def cleanup(self):
        """Cleanup resources"""
        if hasattr(self, 'http_client'):
            await self.http_client.aclose()

async def main():
    """Main entry point"""
    demo = AIReceptionistDemo()
    
    try:
        await demo.run_interactive_demo()
    finally:
        await demo.cleanup()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Demo interrupted by user")
    except Exception as e:
        print(f"❌ Demo failed: {e}")