#!/usr/bin/env python3
"""
AI Business Suite Demo - Business Owner Roleplay
A simplified demo that simulates the AI assistant interaction without requiring API keys.
"""

import os
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
import uuid
import random

try:
    from rich.console import Console
    from rich.prompt import Prompt, Confirm
    from rich.panel import Panel
    from rich.text import Text
    from rich.table import Table
    from rich.layout import Layout
    from rich.columns import Columns
    from rich import box
except ImportError:
    print("Installing required package: rich")
    os.system("pip install rich")
    from rich.console import Console
    from rich.prompt import Prompt, Confirm
    from rich.panel import Panel
    from rich.text import Text
    from rich.table import Table

console = Console()

class BusinessOwnerDemo:
    def __init__(self):
        self.business_info = {
            "name": "TechFlow Solutions",
            "type": "Technology & Software",
            "owner": "Alex Johnson",
            "services": [
                "Software Development",
                "AI Integration",
                "Cloud Solutions", 
                "Technical Consulting"
            ],
            "hours": "Monday-Friday 9AM-6PM, Saturday 10AM-3PM",
            "phone": "+1 (555) 123-4567",
            "email": "info@techflowsolutions.com"
        }
        
        self.bookings = []
        self.leads = []
        self.analytics = {
            "calls_today": random.randint(15, 35),
            "appointments_scheduled": random.randint(3, 8),
            "leads_generated": random.randint(5, 12),
            "revenue_potential": random.randint(15000, 45000)
        }
        
        # Sample AI responses for different scenarios
        self.ai_responses = {
            "greeting": [
                "Hello! Thank you for calling TechFlow Solutions. This is your AI assistant. How can I help you today?",
                "Good day! You've reached TechFlow Solutions. I'm here to assist you with any questions about our services. What can I do for you?",
                "Welcome to TechFlow Solutions! I'm your AI assistant ready to help with software development, AI integration, and more. How may I assist you?"
            ],
            "services_inquiry": [
                "We offer comprehensive technology solutions including software development, AI integration, cloud solutions, and technical consulting. Which area interests you most?",
                "TechFlow Solutions specializes in cutting-edge technology services. We can help with custom software, AI implementation, cloud migration, or technical strategy. What's your primary need?",
                "Our core services include building custom software applications, integrating AI into existing systems, cloud infrastructure setup, and providing technical consulting. Which service would benefit your business most?"
            ],
            "booking": [
                "I'd be happy to schedule a consultation for you. May I have your name, phone number, and preferred service? I can check our availability for this week.",
                "Let me get you scheduled for a consultation. Could you provide your contact information and tell me which service you're interested in?",
                "Perfect! I can schedule that appointment for you. I'll need your name, phone, email, and preferred date. We have openings this week and next."
            ],
            "pricing": [
                "Our pricing varies based on project scope and complexity. For software development, we start at $5,000 for basic applications. AI integration projects typically range from $10,000-$50,000. Would you like to schedule a consultation for a detailed quote?",
                "We provide custom quotes based on your specific needs. Basic consulting starts at $200/hour, while full project implementations range from $5,000-$100,000+. Let me schedule you for a free initial consultation to discuss your requirements.",
                "Pricing depends on the project complexity. We offer both hourly consulting ($200-$300/hr) and fixed-price projects. Most of our clients invest between $15,000-$75,000 for complete solutions. Shall I schedule a consultation to provide you with a detailed estimate?"
            ]
        }
        
    def show_welcome(self):
        """Display welcome screen for business owner demo"""
        
        layout = Layout()
        
        welcome_text = f"""
🎭 [bold cyan]AI Business Suite - Business Owner Roleplay Demo[/bold cyan]

Welcome! You are now [bold green]{self.business_info['owner']}[/bold green], owner of [bold blue]{self.business_info['name']}[/bold blue].

Your business specializes in: [yellow]{self.business_info['type']}[/yellow]

[bold white]📋 Today's Business Overview:[/bold white]
• Calls handled by AI: [green]{self.analytics['calls_today']}[/green]
• Appointments scheduled: [blue]{self.analytics['appointments_scheduled']}[/blue]  
• New leads generated: [yellow]{self.analytics['leads_generated']}[/yellow]
• Revenue potential: [green]${self.analytics['revenue_potential']:,}[/green]

[bold white]🎯 Demo Scenarios Available:[/bold white]
1. [cyan]Incoming Customer Call[/cyan] - Experience how your AI handles customer inquiries
2. [purple]Dashboard Review[/purple] - Check your business metrics and recent activity  
3. [yellow]Lead Management[/yellow] - Review and follow up on new leads
4. [green]Appointment Scheduling[/green] - See scheduled appointments and manage calendar
5. [blue]AI Training[/blue] - Customize how your AI assistant responds

[italic]This demo simulates real AI interactions and business scenarios you'll experience.[/italic]
        """
        
        console.print(Panel(welcome_text, border_style="green", title="🏢 Business Owner Demo", title_align="center"))
        
    def simulate_customer_call(self):
        """Simulate an incoming customer call scenario"""
        
        # Random customer scenarios
        scenarios = [
            {
                "customer": "Sarah Chen",
                "company": "FinanceForward Inc", 
                "inquiry": "AI integration for financial analytics",
                "budget": "$25,000-$40,000",
                "urgency": "High - needed by Q1"
            },
            {
                "customer": "Mike Rodriguez", 
                "company": "RetailMax Solutions",
                "inquiry": "Custom e-commerce platform development",
                "budget": "$15,000-$30,000", 
                "urgency": "Medium - 3-4 month timeline"
            },
            {
                "customer": "Jennifer Wu",
                "company": "HealthTech Innovations",
                "inquiry": "Cloud migration and consulting", 
                "budget": "$10,000-$20,000",
                "urgency": "Low - planning for next year"
            }
        ]
        
        scenario = random.choice(scenarios)
        
        console.print(f"\n📞 [bold yellow]Incoming Call[/bold yellow]")
        console.print(f"[blue]Customer:[/blue] {scenario['customer']} from {scenario['company']}")
        console.print(f"[blue]Inquiry:[/blue] {scenario['inquiry']}")
        console.print(f"[blue]Budget Range:[/blue] {scenario['budget']}")
        console.print(f"[blue]Urgency:[/blue] {scenario['urgency']}")
        
        console.print(f"\n🤖 [bold green]Your AI Assistant responds:[/bold green]")
        
        # Simulate conversation flow
        messages = [
            ("AI", random.choice(self.ai_responses["greeting"])),
            ("Customer", f"Hi, I'm {scenario['customer']} from {scenario['company']}. I'm interested in {scenario['inquiry']}."),
            ("AI", random.choice(self.ai_responses["services_inquiry"])),
            ("Customer", f"We're looking at a budget of {scenario['budget']} and this is {scenario['urgency'].lower()} priority."),
            ("AI", random.choice(self.ai_responses["pricing"])),
        ]
        
        for speaker, message in messages:
            if speaker == "AI":
                console.print(f"[green]🤖 AI Assistant:[/green] {message}\n")
            else:
                console.print(f"[blue]👤 {scenario['customer']}:[/blue] {message}\n")
                
        # Booking attempt
        if Confirm.ask("🎯 Customer wants to schedule a consultation. Should the AI proceed with booking?"):
            self.simulate_booking(scenario)
        else:
            console.print("[yellow]📝 AI will follow up with an email containing more information.[/yellow]")
            
    def simulate_booking(self, customer_info):
        """Simulate the booking process"""
        
        console.print(f"\n📅 [bold blue]Booking Process Started[/bold blue]")
        
        # AI collects information
        booking_data = {
            "customer_name": customer_info["customer"],
            "company": customer_info["company"],
            "phone": f"+1 (555) {random.randint(100,999)}-{random.randint(1000,9999)}",
            "email": f"{customer_info['customer'].split()[0].lower()}@{customer_info['company'].replace(' ', '').lower()}.com",
            "service": customer_info["inquiry"],
            "preferred_date": (datetime.now() + timedelta(days=random.randint(1, 7))).strftime("%Y-%m-%d"),
            "preferred_time": random.choice(["10:00 AM", "2:00 PM", "4:00 PM"]),
            "notes": f"Budget: {customer_info['budget']}, Urgency: {customer_info['urgency']}"
        }
        
        console.print(f"[green]🤖 AI Assistant:[/green] Perfect! I have all the information I need. Let me schedule that for you.")
        
        # Display booking summary
        table = Table(title="📋 Booking Summary", show_header=True, header_style="bold magenta", box=box.ROUNDED)
        table.add_column("Field", style="cyan")
        table.add_column("Information", style="white")
        
        table.add_row("Customer Name", booking_data["customer_name"])
        table.add_row("Company", booking_data["company"])
        table.add_row("Phone", booking_data["phone"])
        table.add_row("Email", booking_data["email"])
        table.add_row("Service", booking_data["service"])
        table.add_row("Date", booking_data["preferred_date"])
        table.add_row("Time", booking_data["preferred_time"])
        table.add_row("Notes", booking_data["notes"])
        
        console.print(table)
        
        # Add to bookings
        self.bookings.append(booking_data)
        self.analytics["appointments_scheduled"] += 1
        
        console.print(f"\n[green]✅ Appointment successfully scheduled![/green]")
        console.print(f"[blue]📧 Confirmation email sent to {booking_data['email']}[/blue]")
        console.print(f"[yellow]📱 SMS reminder sent to {booking_data['phone']}[/yellow]")
        
    def show_dashboard(self):
        """Display business dashboard"""
        
        console.print(f"\n📊 [bold blue]Business Dashboard - {self.business_info['name']}[/bold blue]")
        
        # Create metrics table
        metrics_table = Table(title="📈 Today's Performance", box=box.DOUBLE_EDGE)
        metrics_table.add_column("Metric", style="cyan", justify="left")
        metrics_table.add_column("Value", style="green", justify="center")
        metrics_table.add_column("Status", justify="center")
        
        metrics_table.add_row("Calls Handled", str(self.analytics["calls_today"]), "🟢 Active")
        metrics_table.add_row("Appointments Scheduled", str(self.analytics["appointments_scheduled"]), "📅 Confirmed") 
        metrics_table.add_row("Leads Generated", str(self.analytics["leads_generated"]), "🎯 Qualified")
        metrics_table.add_row("Revenue Potential", f"${self.analytics['revenue_potential']:,}", "💰 Estimated")
        
        console.print(metrics_table)
        
        # Recent activity
        console.print(f"\n📋 [bold yellow]Recent Activity[/bold yellow]")
        
        activities = [
            f"🤖 AI handled inquiry from Global Tech Corp about cloud migration",
            f"📅 Scheduled consultation with DataDriven LLC for next Tuesday",
            f"📧 Follow-up email sent to previous lead about software development",
            f"🎯 New lead qualified: Manufacturing Solutions Inc - AI integration",
            f"📞 Incoming call answered in 0.8 seconds average response time"
        ]
        
        for activity in activities:
            console.print(f"• {activity}")
            
    def show_lead_management(self):
        """Show lead management interface"""
        
        console.print(f"\n🎯 [bold yellow]Lead Management System[/bold yellow]")
        
        # Generate sample leads
        sample_leads = [
            {
                "name": "Global Manufacturing Co",
                "contact": "David Kim", 
                "interest": "AI-powered quality control system",
                "value": "$35,000",
                "probability": "85%",
                "next_action": "Send proposal"
            },
            {
                "name": "StartupBoost Inc",
                "contact": "Lisa Zhang",
                "interest": "Custom web application",
                "value": "$18,000", 
                "probability": "65%",
                "next_action": "Schedule demo"
            },
            {
                "name": "Enterprise Solutions Ltd",
                "contact": "Robert Taylor",
                "interest": "Cloud infrastructure consulting",
                "value": "$22,000",
                "probability": "45%", 
                "next_action": "Follow-up call"
            }
        ]
        
        leads_table = Table(title="🚀 Active Leads Pipeline", box=box.HEAVY)
        leads_table.add_column("Company", style="cyan")
        leads_table.add_column("Contact", style="white")
        leads_table.add_column("Interest", style="yellow")
        leads_table.add_column("Value", style="green")
        leads_table.add_column("Probability", style="blue")
        leads_table.add_column("Next Action", style="magenta")
        
        for lead in sample_leads:
            leads_table.add_row(
                lead["name"],
                lead["contact"], 
                lead["interest"],
                lead["value"],
                lead["probability"],
                lead["next_action"]
            )
            
        console.print(leads_table)
        
        total_value = sum([int(lead["value"].replace("$", "").replace(",", "")) for lead in sample_leads])
        console.print(f"\n💰 [bold green]Total Pipeline Value: ${total_value:,}[/bold green]")
        
    def show_appointments(self):
        """Show scheduled appointments"""
        
        console.print(f"\n📅 [bold blue]Appointment Schedule[/bold blue]")
        
        # Show existing bookings plus sample upcoming appointments
        appointments = self.bookings + [
            {
                "customer_name": "Tech Innovations Ltd",
                "service": "AI Strategy Consultation",
                "preferred_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
                "preferred_time": "10:00 AM",
                "phone": "+1 (555) 987-6543"
            },
            {
                "customer_name": "Digital Transform Corp", 
                "service": "Cloud Migration Planning",
                "preferred_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
                "preferred_time": "2:00 PM",
                "phone": "+1 (555) 456-7890"
            }
        ]
        
        if not appointments:
            console.print("[yellow]No appointments scheduled yet.[/yellow]")
            return
            
        appt_table = Table(title="📋 Upcoming Appointments", box=box.SQUARE)
        appt_table.add_column("Date", style="cyan")
        appt_table.add_column("Time", style="blue")
        appt_table.add_column("Customer", style="white")
        appt_table.add_column("Service", style="yellow")
        appt_table.add_column("Phone", style="green")
        
        for appt in appointments:
            appt_table.add_row(
                appt["preferred_date"],
                appt["preferred_time"],
                appt["customer_name"],
                appt["service"],
                appt["phone"]
            )
            
        console.print(appt_table)
        
    def ai_training_demo(self):
        """Show AI training and customization options"""
        
        console.print(f"\n🧠 [bold purple]AI Assistant Training[/bold purple]")
        
        console.print("""
[bold white]Your AI assistant can be trained to:[/bold white]

🎯 [cyan]Custom Responses[/cyan]
   • Tailor greeting messages to your brand voice
   • Add specific product/service information  
   • Include pricing and promotion details

📋 [yellow]Business Rules[/yellow]
   • Set availability windows for appointments
   • Define qualification criteria for leads
   • Customize call routing and escalation

🎨 [green]Personality & Tone[/green]
   • Professional, friendly, or casual tone
   • Industry-specific terminology
   • Multilingual support

📊 [blue]Integration Settings[/blue]
   • CRM system connections
   • Calendar synchronization
   • Email marketing automation
        """)
        
        # Show current AI configuration
        config_table = Table(title="🔧 Current AI Configuration", box=box.ROUNDED)
        config_table.add_column("Setting", style="cyan")
        config_table.add_column("Current Value", style="white")
        config_table.add_column("Status", style="green")
        
        config_table.add_row("Response Time", "< 1 second", "✅ Optimal")
        config_table.add_row("Accuracy Rate", "94.2%", "✅ Excellent") 
        config_table.add_row("Booking Success", "78%", "✅ High")
        config_table.add_row("Customer Satisfaction", "4.8/5", "✅ Outstanding")
        
        console.print(config_table)
        
    def run_demo(self):
        """Main demo loop"""
        
        self.show_welcome()
        
        while True:
            console.print(f"\n[bold white]What would you like to do?[/bold white]")
            
            choice = Prompt.ask(
                "Choose an option",
                choices=["call", "dashboard", "leads", "appointments", "training", "help", "quit"],
                default="call"
            )
            
            if choice == "call":
                self.simulate_customer_call()
            elif choice == "dashboard":
                self.show_dashboard()
            elif choice == "leads":
                self.show_lead_management() 
            elif choice == "appointments":
                self.show_appointments()
            elif choice == "training":
                self.ai_training_demo()
            elif choice == "help":
                self.show_help()
            elif choice == "quit":
                console.print("\n👋 [bold green]Thank you for using AI Business Suite Demo![/bold green]")
                console.print("[cyan]Ready to transform your business with AI? Contact us to get started![/cyan]")
                break
                
    def show_help(self):
        """Show help information"""
        
        help_text = """
[bold white]🆘 Demo Commands:[/bold white]

• [cyan]call[/cyan] - Simulate an incoming customer call
• [purple]dashboard[/purple] - View your business metrics and activity
• [yellow]leads[/yellow] - Manage and review lead pipeline
• [green]appointments[/green] - Check scheduled appointments 
• [blue]training[/blue] - AI assistant configuration options
• [white]help[/white] - Show this help message
• [red]quit[/red] - Exit the demo

[bold yellow]💡 Tips:[/bold yellow]
- Each call simulation shows different customer scenarios
- Metrics update in real-time as you interact
- Try different options to see the full business impact
        """
        
        console.print(Panel(help_text, title="Help", border_style="blue"))

def main():
    """Run the business owner demo"""
    try:
        demo = BusinessOwnerDemo()
        demo.run_demo()
    except KeyboardInterrupt:
        console.print("\n👋 [bold yellow]Demo interrupted. Goodbye![/bold yellow]")
    except Exception as e:
        console.print(f"❌ [bold red]Demo error: {e}[/bold red]")

if __name__ == "__main__":
    main()