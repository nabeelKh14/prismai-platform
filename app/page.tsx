import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CallDemo } from "@/components/ai/call-demo"
import {
  Phone,
  Brain,
  Clock,
  BarChart3,
  Shield,
  CheckCircle,
  Star,
  ArrowRight,
  Zap,
  MessageSquare,
  Calendar,
  Users,
  Globe,
  Headphones,
  FileText,
  Settings,
  TrendingUp,
  Award,
  Lock,
  PhoneCall,
  X,
  ChevronDown,
  Play,
  Building,
  Target,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{backgroundColor: '#0B0B0D'}}>
      {/* Navigation */}
      <nav className="border-b border-cyan-500/20 backdrop-blur supports-[backdrop-filter]:bg-[#0B0B0D]/60 sticky top-0 z-50" style={{backgroundColor: '#0B0B0D'}}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Phone className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">PrismAI</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                Features
              </Link>
              <Link href="/demo" className="text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                Demo
              </Link>
              <Link href="#pricing" className="text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                Pricing
              </Link>
              <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors duration-200">
                Login
              </Link>
              <Button 
                className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                asChild
              >
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 lg:py-40 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background Effects */}
        <div className="absolute inset-0 gradient-premium" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-pink-500/8" />
        <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/6 via-transparent to-cyan-500/6" />

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-xl animate-float" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink-500/8 rounded-full blur-2xl animate-float" style={{animationDelay: '2s'}} />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-cyan-500/5 rounded-full blur-lg animate-float" style={{animationDelay: '4s'}} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-6xl mx-auto">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3 mb-8 animate-fade-in-up">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-cyan-300">Intelligent Business Automation Platform</span>
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
            </div>

            {/* Main Headline */}
            <h1 className="premium-heading text-5xl md:text-7xl lg:text-8xl text-balance leading-tight mb-8 text-white animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              <span className="text-gradient">
                PrismAI
              </span>
              {" "}Intelligent Business Automation Platform
            </h1>

            {/* Subheadline */}
            <p className="premium-subheading text-xl md:text-2xl text-gray-300 text-pretty leading-relaxed max-w-4xl mx-auto mb-10 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              Refract your business potential through AI with comprehensive automation, intelligent customer service, and seamless integrations.
            </p>

            {/* Supporting line */}
            <p className="text-lg text-gray-400 mb-16 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              Transform your business operations with AI-powered automation that delivers precision, efficiency, and exceptional customer experiences.
            </p>

            {/* Premium CTAs */}
            <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-20 animate-fade-in-up" style={{animationDelay: '0.8s'}}>
              <Button
                size="lg"
                className="btn-premium text-lg px-12 py-5 h-auto text-white font-semibold rounded-2xl group animate-fade-in-left"
                asChild
              >
                <Link href="/demo">
                  <Calendar className="mr-3 h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
                  Schedule Private Consultation
                  <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="glass-strong text-lg px-12 py-5 h-auto border-2 border-pink-500/50 text-pink-400 hover:bg-pink-500/10 hover:text-pink-300 hover:border-pink-400 shadow-premium hover:shadow-premium-lg transition-all duration-300 transform hover:scale-105 group rounded-2xl animate-fade-in-right"
                asChild
              >
                <Link href="#pricing">
                  <Target className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
                  View Investment Options
                </Link>
              </Button>
            </div>

            {/* Premium Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto animate-fade-in-up" style={{animationDelay: '1s'}}>
              <div className="glass rounded-2xl p-6 hover-glow transition-all duration-300">
                <div className="text-3xl font-bold text-gradient-cyan mb-2">99.9%</div>
                <div className="text-gray-300 font-medium">Uptime Guarantee</div>
                <div className="text-sm text-gray-400 mt-1">Always available for your clients</div>
              </div>
              <div className="glass rounded-2xl p-6 hover-glow transition-all duration-300">
                <div className="text-3xl font-bold text-gradient-pink mb-2">2.3s</div>
                <div className="text-gray-300 font-medium">Response Time</div>
                <div className="text-sm text-gray-400 mt-1">Lightning-fast interactions</div>
              </div>
              <div className="glass rounded-2xl p-6 hover-glow transition-all duration-300">
                <div className="text-3xl font-bold text-gradient-cyan mb-2">24/7</div>
                <div className="text-gray-300 font-medium">Availability</div>
                <div className="text-sm text-gray-400 mt-1">Round-the-clock service</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background */}
        <div className="absolute inset-0 gradient-premium opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-orange-500/5" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3 mb-6 animate-fade-in-up">
              <X className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-red-300">The Hidden Costs</span>
            </div>
            <h2 className="premium-heading text-4xl md:text-5xl mb-6 text-white animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              The True Cost of{" "}
              <span className="text-gradient">Compromised Client Experience</span>
            </h2>
            <p className="premium-subheading text-xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              Every missed call represents more than lost revenue — it's a breach of the exceptional service your clients expect
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card-premium p-8 text-center animate-fade-in-up hover-lift" style={{animationDelay: '0.6s'}}>
              <div className="flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-2xl mx-auto mb-6">
                <X className="h-10 w-10 text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-red-300">Compromised Brand Reputation</h3>
              <p className="text-gray-300 leading-relaxed">
                Unanswered calls damage the premium image you've worked years to build, eroding client trust and loyalty
              </p>
            </div>

            <div className="card-premium p-8 text-center animate-fade-in-up hover-lift" style={{animationDelay: '0.8s'}}>
              <div className="flex items-center justify-center w-20 h-20 bg-orange-500/20 rounded-2xl mx-auto mb-6">
                <Clock className="h-10 w-10 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-orange-300">Executive Time Wasted</h3>
              <p className="text-gray-300 leading-relaxed">
                Your valuable time diverted from strategic decisions to basic scheduling and inquiries, reducing productivity
              </p>
            </div>

            <div className="card-premium p-8 text-center animate-fade-in-up hover-lift" style={{animationDelay: '1s'}}>
              <div className="flex items-center justify-center w-20 h-20 bg-yellow-500/20 rounded-2xl mx-auto mb-6">
                <TrendingUp className="h-10 w-10 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-yellow-300">Inconsistent Client Experience</h3>
              <p className="text-gray-300 leading-relaxed">
                Without standardized excellence, your premium service quality varies with each interaction, creating uncertainty
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background */}
        <div className="absolute inset-0 gradient-premium opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3 mb-6 animate-fade-in-up">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-green-300">The Solution</span>
            </div>
            <h2 className="premium-heading text-4xl md:text-5xl lg:text-6xl mb-6 text-white animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              Your Dedicated{" "}
              <span className="text-gradient">AI Executive Assistant</span>
            </h2>
            <p className="premium-subheading text-xl text-gray-300 max-w-4xl mx-auto mb-8 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              Our bespoke AI concierge service delivers the sophistication and attention to detail your discerning clients expect — with the reliability and precision only AI can provide.
            </p>

            <div className="glass rounded-2xl p-4 max-w-2xl mx-auto animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              <div className="flex items-center justify-center gap-3">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                <span className="text-cyan-300 font-medium">Premium clients report 40% improvement in service satisfaction within 30 days</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card-premium p-8 text-center animate-fade-in-up hover-lift" style={{animationDelay: '0.8s'}}>
              <div className="flex items-center justify-center w-20 h-20 bg-cyan-500/20 rounded-2xl mx-auto mb-6">
                <BarChart3 className="h-10 w-10 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Reduce Overhead by 60%</h3>
              <p className="text-gray-300 leading-relaxed">
                Eliminate the cost and complexity of managing multiple reception staff while elevating service quality to unmatched standards
              </p>
            </div>

            <div className="card-premium p-8 text-center animate-fade-in-up hover-lift" style={{animationDelay: '1s'}}>
              <div className="flex items-center justify-center w-20 h-20 bg-pink-500/20 rounded-2xl mx-auto mb-6">
                <Calendar className="h-10 w-10 text-pink-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Capture 100% of Opportunities</h3>
              <p className="text-gray-300 leading-relaxed">
                Never miss a high-value client interaction with round-the-clock availability and instant, intelligent responses that convert
              </p>
            </div>

            <div className="card-premium p-8 text-center animate-fade-in-up hover-lift" style={{animationDelay: '1.2s'}}>
              <div className="flex items-center justify-center w-20 h-20 bg-cyan-500/20 rounded-2xl mx-auto mb-6">
                <Globe className="h-10 w-10 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Global Presence, Personal Touch</h3>
              <p className="text-gray-300 leading-relaxed">
                Serve elite clientele across time zones with culturally-aware communication in their preferred language, maintaining premium service worldwide
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Premium Capabilities */}
      <section id="features" className="py-24 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background */}
        <div className="absolute inset-0 gradient-premium opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3 mb-6 animate-fade-in-up">
              <Star className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium text-cyan-300">Premium Suite Features</span>
              <Star className="h-4 w-4 text-yellow-400" />
            </div>
            <h2 className="premium-heading text-4xl md:text-5xl lg:text-6xl mb-6 text-white animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              Concierge-Level Service{" "}
              <span className="text-gradient">Capabilities</span>
            </h2>
            <p className="premium-subheading text-xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              Every feature meticulously crafted to deliver the exceptional experience your premium clients deserve
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="card-premium p-8 animate-fade-in-up group" style={{animationDelay: '0.6s'}}>
              <div className="flex items-center justify-center w-16 h-16 bg-cyan-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <PhoneCall className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Bespoke Conversational Intelligence</h3>
              <p className="text-gray-300 leading-relaxed">
                Custom-trained voice that perfectly embodies your brand's tone, personality, and expertise with natural conversation flow
              </p>
            </div>

            <div className="card-premium p-8 animate-fade-in-up group relative" style={{animationDelay: '0.8s'}}>
              <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                <span className="text-xs font-bold text-cyan-300">$8K Value</span>
              </div>
              <div className="flex items-center justify-center w-16 h-16 bg-cyan-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Target className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Lead Generation Engine</h3>
              <p className="text-gray-300 leading-relaxed">
                AI-powered scoring + qualification + BANT analysis + automatic lead routing to your best closers with predictive insights
              </p>
            </div>

            <div className="card-premium p-8 animate-fade-in-up group relative" style={{animationDelay: '1s'}}>
              <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                <span className="text-xs font-bold text-pink-300">$12K Value</span>
              </div>
              <div className="flex items-center justify-center w-16 h-16 bg-pink-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-8 w-8 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Customer Management CRM</h3>
              <p className="text-gray-300 leading-relaxed">
                Complete relationship management + interaction tracking + lifetime value analysis + VIP routing with personalized service
              </p>
            </div>

            <div className="card-premium p-8 animate-fade-in-up group relative" style={{animationDelay: '1.2s'}}>
              <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                <span className="text-xs font-bold text-purple-300">$10K Value</span>
              </div>
              <div className="flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Analytics Dashboard</h3>
              <p className="text-gray-300 leading-relaxed">
                Business intelligence + predictive analytics + ROI tracking + executive reporting + trend analysis with real-time insights
              </p>
            </div>

            <div className="card-premium p-8 animate-fade-in-up group relative" style={{animationDelay: '1.4s'}}>
              <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                <span className="text-xs font-bold text-orange-300">$7K Value</span>
              </div>
              <div className="flex items-center justify-center w-16 h-16 bg-orange-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Marketing Automation</h3>
              <p className="text-gray-300 leading-relaxed">
                Email campaigns + social media automation + content generation + nurture sequences + A/B testing with AI optimization
              </p>
            </div>

            <div className="card-premium p-8 animate-fade-in-up group relative" style={{animationDelay: '1.6s'}}>
              <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                <span className="text-xs font-bold text-blue-300">$9K Value</span>
              </div>
              <div className="flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Headphones className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">24/7 AI Chatbot</h3>
              <p className="text-gray-300 leading-relaxed">
                Intelligent customer service + instant responses + escalation handling + multilingual support with context awareness
              </p>
            </div>

            <div className="card-premium p-8 animate-fade-in-up group relative md:col-span-2 lg:col-span-1" style={{animationDelay: '1.8s'}}>
              <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                <span className="text-xs font-bold text-teal-300">$5K Value</span>
              </div>
              <div className="flex items-center justify-center w-16 h-16 bg-teal-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Settings className="h-8 w-8 text-teal-400" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">Settings Management</h3>
              <p className="text-gray-300 leading-relaxed">
                Complete configuration interface + user management + security controls + integration settings with enterprise-grade security
              </p>
            </div>
          </div>

          <div className="text-center animate-fade-in-up" style={{animationDelay: '2s'}}>
            <div className="card-premium-strong p-8 max-w-2xl mx-auto mb-8">
              <div className="text-4xl font-bold text-gradient-cyan mb-2">$66,000</div>
              <div className="text-lg text-gray-300 mb-4">Complete Suite Value</div>
              <div className="text-2xl font-bold text-white mb-2">Your Investment: $2,997/month</div>
              <div className="text-green-400 font-semibold">You Save: $63,003</div>
            </div>
            <Button className="btn-premium text-lg px-12 py-4 font-semibold rounded-2xl" asChild>
              <Link href="/demo">
                Get Your $66K AI Suite For $2,997/month
                <ArrowRight className="ml-3 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Integrations & Tech Stack */}
      <section className="py-16" style={{backgroundColor: '#0B0B0D'}}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Integrates With Your Existing Tools</h2>
            <p className="text-lg text-gray-300 mb-8">
              Works with your existing tools — integrates via API or Zapier
            </p>
          </div>

          {/* Integration logos */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center justify-items-center mb-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
                <Calendar className="h-6 w-6 text-cyan-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Google Calendar</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg flex items-center justify-center border border-pink-500/30">
                <Users className="h-6 w-6 text-pink-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">HubSpot</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
                <Building className="h-6 w-6 text-cyan-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Salesforce</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg flex items-center justify-center border border-pink-500/30">
                <Headphones className="h-6 w-6 text-pink-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Zendesk</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
                <FileText className="h-6 w-6 text-cyan-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Notion</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg flex items-center justify-center border border-pink-500/30">
                <Settings className="h-6 w-6 text-pink-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Zapier</span>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 text-cyan-300 px-4 py-2 rounded-full text-sm border border-cyan-500/30">
              <Lock className="h-4 w-4" />
              <span>Enterprise-grade security with SOC2 compliance and GDPR readiness</span>
            </div>
          </div>
        </div>
      </section>

      {/* Onboarding / Implementation Flow */}
      <section className="py-20" style={{backgroundColor: '#0B0B0D'}}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Simple Onboarding Process</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Get your AI receptionist up and running in just 48 hours with our guided setup process
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
                <span className="text-2xl font-bold text-cyan-400">1</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Discovery call</h3>
              <p className="text-sm text-gray-400 mb-2">30 minutes</p>
              <p className="text-gray-300">We learn about your business and requirements</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Setup & integrations</h3>
              <p className="text-sm text-muted-foreground mb-2">1-2 days</p>
              <p className="text-muted-foreground">Connect your calendar, CRM, and phone system</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Training & voice tuning</h3>
              <p className="text-sm text-muted-foreground mb-2">1-3 days</p>
              <p className="text-muted-foreground">Customize voice, personality, and scripts</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">4</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Pilot testing</h3>
              <p className="text-sm text-muted-foreground mb-2">2 weeks</p>
              <p className="text-muted-foreground">Test with real calls and fine-tune performance</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">5</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Go live</h3>
              <p className="text-sm text-muted-foreground mb-2">Ongoing</p>
              <p className="text-muted-foreground">Full deployment with ongoing optimization</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm">
              <Shield className="h-4 w-4" />
              <span>We handle all compliance & data security requirements</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-muted-foreground">Everything you need to know about our AI receptionist</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">How do you handle data/privacy?</h3>
                <p className="text-muted-foreground">
                  We encrypt data at rest & in transit, support SOC2/GDPR controls, and can sign an NDA/BAA for healthcare and enterprise clients.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Can it transfer to a human?</h3>
                <p className="text-muted-foreground">
                  Yes — configurable triggers route calls to live agents or on-call phones based on your business rules.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What languages/voices are supported?</h3>
                <p className="text-muted-foreground">
                  We support 20+ languages and can tune voice/personality to match your brand and customer expectations.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">How long to integrate with my CRM?</h3>
                <p className="text-muted-foreground">
                  Most integrations take 1-3 days; custom work typically completed within a week with our technical team.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What happens on failed recognition?</h3>
                <p className="text-muted-foreground">
                  AI asks clarifying questions and flags uncertain leads for human follow-up to ensure no opportunities are missed.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What about uptime and reliability?</h3>
                <p className="text-muted-foreground">
                  We guarantee 99.9% uptime with automatic failover to backup systems and 24/7 monitoring of all services.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Experience the Difference</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Try our AI receptionist now. Enter your phone number below and experience a conversation that feels
              completely natural.
            </p>
          </div>

          <CallDemo />

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This demo uses a sample business configuration. Your AI receptionist will be customized for your specific
              business.
            </p>
            <Button variant="outline" asChild>
              <Link href="/auth/sign-up">
                Set Up Your PrismAI Assistant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Social Proof / Case Studies - Premium Design */}
      <section id="case-studies" className="py-24 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background */}
        <div className="absolute inset-0 gradient-premium opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-cyan-500/5 to-pink-500/5" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3 mb-6 animate-fade-in-up">
              <Award className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-300">Success Stories</span>
            </div>
            <h2 className="premium-heading text-4xl md:text-5xl lg:text-6xl mb-6 text-white animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              $47M+ Generated For{" "}
              <span className="text-gradient">Clients In 12 Months</span>
            </h2>
            <p className="premium-subheading text-xl text-gray-300 mb-8 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              Real Companies, Real Revenue, Real Results
            </p>
            <div className="glass rounded-2xl p-4 max-w-2xl mx-auto animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              <div className="flex items-center justify-center gap-3">
                <Award className="h-5 w-5 text-green-400" />
                <span className="text-green-300 font-medium">98% Client Retention • 847% Average ROI • 90-Day Revenue Guarantee</span>
              </div>
            </div>
          </div>

          {/* Featured Case Studies */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="card-premium-strong p-8 animate-fade-in-up hover-lift" style={{animationDelay: '0.8s'}}>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-3 text-white">TechCorp Solutions</h3>
                <p className="text-green-400 text-lg font-semibold">SaaS Company • $15M ARR</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">$2.8M</div>
                  <div className="text-sm text-gray-300">Additional Revenue</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">340%</div>
                  <div className="text-sm text-gray-300">Lead Increase</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">67 Days</div>
                  <div className="text-sm text-gray-300">To $1M ROI</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">97%</div>
                  <div className="text-sm text-gray-300">Lead Capture Rate</div>
                </div>
              </div>

              <blockquote className="text-center text-lg italic text-gray-300 mb-6 leading-relaxed">
                "We went from losing $50K/month in missed leads to generating $2.8M in additional revenue. This AI suite is insane."
              </blockquote>
              <div className="text-center">
                <div className="font-semibold text-white">Marcus Johnson</div>
                <div className="text-sm text-gray-400">CEO, TechCorp Solutions</div>
              </div>
            </div>

            <div className="card-premium-strong p-8 animate-fade-in-up hover-lift" style={{animationDelay: '1s'}}>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-3 text-white">Elite MedSpa Chain</h3>
                <p className="text-cyan-400 text-lg font-semibold">Healthcare • 47 Locations</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">$4.2M</div>
                  <div className="text-sm text-gray-300">Revenue Increase</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">73%</div>
                  <div className="text-sm text-gray-300">Booking Increase</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">$847K</div>
                  <div className="text-sm text-gray-300">Costs Eliminated</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">24/7</div>
                  <div className="text-sm text-gray-300">Lead Generation</div>
                </div>
              </div>

              <blockquote className="text-center text-lg italic text-gray-300 mb-6 leading-relaxed">
                "Eliminated 3 call centers and increased bookings by 73%. Patients can't tell it's AI. Worth every penny."
              </blockquote>
              <div className="text-center">
                <div className="font-semibold text-white">Dr. Sarah Chen</div>
                <div className="text-sm text-gray-400">Founder, Elite MedSpa Chain</div>
              </div>
            </div>

            <div className="card-premium-strong p-8 animate-fade-in-up hover-lift" style={{animationDelay: '1.2s'}}>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-3 text-white">Platinum Legal Group</h3>
                <p className="text-pink-400 text-lg font-semibold">Law Firm • $8M Revenue</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-pink-400 mb-1">$3.1M</div>
                  <div className="text-sm text-gray-300">New Clients Value</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-pink-400 mb-1">450%</div>
                  <div className="text-sm text-gray-300">Consultation Rate</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-pink-400 mb-1">52 Days</div>
                  <div className="text-sm text-gray-300">ROI Payback</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-pink-400 mb-1">89%</div>
                  <div className="text-sm text-gray-400">Client Satisfaction</div>
                </div>
              </div>

              <blockquote className="text-center text-lg italic text-gray-300 mb-6 leading-relaxed">
                "Never thought AI could handle legal intake. Now it's booking $3.1M worth of clients while we sleep."
              </blockquote>
              <div className="text-center">
                <div className="font-semibold text-white">Lisa Rodriguez</div>
                <div className="text-sm text-gray-400">Managing Partner</div>
              </div>
            </div>
          </div>

          <div className="text-center animate-fade-in-up" style={{animationDelay: '1.4s'}}>
            <div className="card-premium-strong p-8 max-w-2xl mx-auto">
              <div className="text-xl font-bold mb-4 text-white">Total Client Revenue Generated:</div>
              <div className="text-5xl font-extrabold text-gradient-cyan mb-4">$47,300,000+</div>
              <div className="text-lg text-gray-300 mb-4">In Just 12 Months</div>
              <div className="text-green-400 font-semibold">Average Client ROI: 847% • Your Success Is Guaranteed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-primary via-primary/90 to-secondary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div className="group hover:scale-105 transition-transform duration-200">
              <div className="text-4xl font-bold mb-2">99.9%</div>
              <div className="text-primary-foreground/80">Uptime Guarantee</div>
            </div>
            <div className="group hover:scale-105 transition-transform duration-200">
              <div className="text-4xl font-bold mb-2">2.3s</div>
              <div className="text-primary-foreground/80">Average Response Time</div>
            </div>
            <div className="group hover:scale-105 transition-transform duration-200">
              <div className="text-4xl font-bold mb-2">10,000+</div>
              <div className="text-primary-foreground/80">Calls Handled Daily</div>
            </div>
            <div className="group hover:scale-105 transition-transform duration-200">
              <div className="text-4xl font-bold mb-2">95%</div>
              <div className="text-primary-foreground/80">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Premium Presentation */}
      <section id="pricing" className="py-24 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background */}
        <div className="absolute inset-0 gradient-premium opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3 mb-6 animate-fade-in-up">
              <Star className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-300">Premium Investment</span>
            </div>
            <h2 className="premium-heading text-4xl md:text-5xl lg:text-6xl mb-6 text-white animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              Your $66K{" "}
              <span className="text-gradient">AI Revenue Engine</span>
            </h2>
            <p className="premium-subheading text-xl text-gray-300 mb-8 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              Complete Implementation + 90-Day Revenue Guarantee + Dedicated Success Manager
            </p>

            <div className="glass rounded-2xl p-6 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              <div className="flex items-center justify-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-400" />
                <span className="text-green-300 font-medium text-lg">90-Day Revenue Guarantee • If you don't generate $10K+ in new revenue, we work for FREE</span>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto">
            {/* Main Offer */}
            <div className="card-premium-strong p-8 md:p-12 relative animate-fade-in-up hover-lift" style={{animationDelay: '0.8s'}}>
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="glass rounded-full px-8 py-3 shadow-premium">
                  <span className="text-green-300 font-bold text-lg">BEST VALUE - 94% Choose This</span>
                </div>
              </div>

              <div className="text-center mb-8">
                <h3 className="text-4xl font-bold mb-6 text-white">Complete PrismAI Platform</h3>
                <div className="mb-8">
                  <div className="text-7xl font-extrabold text-gradient-cyan mb-4">
                    $2,997<span className="text-3xl text-gray-400">/month</span>
                  </div>
                  <div className="text-gray-300 line-through text-xl mb-2">Value: $66,000</div>
                  <div className="text-green-400 font-bold text-2xl">You Save: $63,003</div>
                </div>
                <p className="text-xl text-gray-300 leading-relaxed">
                  Everything you need to generate $2M+ in additional revenue
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">AI Suite Dashboard ($15K value)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Lead Generation Engine ($8K value)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Customer Management CRM ($12K value)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Analytics Dashboard ($10K value)</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Marketing Automation ($7K value)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">24/7 AI Chatbot ($9K value)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Settings Management ($5K value)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Dedicated Success Manager (Priceless)</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-green-500/30 pt-8 mb-8">
                <h4 className="text-2xl font-bold text-gradient-cyan mb-6 text-center">EXCLUSIVE BONUSES (Limited Time):</h4>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="glass rounded-xl p-4 text-center">
                    <Star className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                    <div className="text-white font-semibold">White-Glove Setup & Training</div>
                    <div className="text-green-400 text-sm">($5K value)</div>
                  </div>
                  <div className="glass rounded-xl p-4 text-center">
                    <Star className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                    <div className="text-white font-semibold">90-Day Revenue Guarantee</div>
                    <div className="text-green-400 text-sm">($10K value)</div>
                  </div>
                  <div className="glass rounded-xl p-4 text-center">
                    <Star className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                    <div className="text-white font-semibold">24/7 Priority Support</div>
                    <div className="text-green-400 text-sm">($3K value)</div>
                  </div>
                </div>
              </div>

              <div className="glass-strong rounded-xl p-6 mb-8 border border-red-500/30">
                <div className="text-center">
                  <div className="text-red-400 font-bold text-xl mb-2">⚠️ URGENT: Price Increases to $4,997 on Jan 31st</div>
                  <div className="text-red-300">Lock in $2,997/month forever (37 spots remaining)</div>
                </div>
              </div>

              <Button className="btn-premium w-full text-xl py-6 font-bold rounded-2xl mb-6" asChild>
                <Link href="/demo">
                  🚀 CLAIM YOUR $66K AI SUITE FOR $2,997/MONTH
                </Link>
              </Button>

              <div className="text-center">
                <div className="text-green-400 font-bold text-lg mb-2">90-Day Money-Back Guarantee</div>
                <div className="text-gray-400">If you don't generate $10K+ in new revenue, we'll refund everything</div>
              </div>
            </div>
          </div>

          <div className="text-center mt-16 animate-fade-in-up" style={{animationDelay: '1s'}}>
            <p className="text-gray-300 mb-6 text-lg">
              Join 500+ companies already generating $2M+ with our AI Suite
            </p>
            <div className="grid md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="glass rounded-xl p-4">
                <div className="text-green-400 font-bold text-lg">✅</div>
                <div className="text-white font-medium">No Setup Fees</div>
              </div>
              <div className="glass rounded-xl p-4">
                <div className="text-green-400 font-bold text-lg">✅</div>
                <div className="text-white font-medium">Cancel Anytime</div>
              </div>
              <div className="glass rounded-xl p-4">
                <div className="text-green-400 font-bold text-lg">✅</div>
                <div className="text-white font-medium">Revenue Guaranteed</div>
              </div>
              <div className="glass rounded-xl p-4">
                <div className="text-green-400 font-bold text-lg">✅</div>
                <div className="text-white font-medium">Done-For-You Implementation</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section - Hormozi Style */}
      <section className="py-20 bg-gradient-to-r from-green-900/20 via-green-800/20 to-cyan-900/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Last Chance: $63,003 Savings Expires Soon</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-4xl mx-auto">
            While your competitors keep losing $500K+ annually to missed opportunities, you could be generating $2M+ in new revenue. But this offer expires Jan 31st.
          </p>
          
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 max-w-2xl mx-auto mb-8">
            <div className="text-red-400 font-bold text-xl mb-2">⚠️ WARNING: Price Increases to $4,997 in:</div>
            <div className="text-red-300 text-lg font-semibold">37 spots remaining at $2,997/month</div>
            <div className="text-red-200 text-sm mt-2">After Jan 31st, new clients pay $4,997/month (current clients grandfathered at $2,997)</div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button
              size="lg"
              className="text-xl px-12 py-6 h-auto bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group pulse"
              asChild
            >
              <Link href="/demo">
                <Calendar className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />
                🚀 SECURE YOUR $66K AI SUITE NOW
                <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6 h-auto border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group" 
              asChild
            >
              <Link href="#case-studies">
                <Target className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                See $47M+ Success Stories
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">90 Days</div>
              <div className="text-gray-300">Revenue Guarantee</div>
              <div className="text-sm text-gray-400 mt-1">Generate $10K+ or we work for FREE</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-2">48 Hours</div>
              <div className="text-gray-300">Complete Setup</div>
              <div className="text-sm text-gray-400 mt-1">Done-for-you implementation</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-400 mb-2">847%</div>
              <div className="text-gray-300">Average ROI</div>
              <div className="text-sm text-gray-400 mt-1">Clients see $8.47 for every $1 invested</div>
            </div>
          </div>

          {/* Contact Form */}
          <div id="contact" className="max-w-2xl mx-auto mt-16">
            <Card className="border-2 border-green-500/30 bg-gray-800/50">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white">Claim Your $66K AI Revenue Engine</CardTitle>
                <CardDescription className="text-gray-300">
                  Fill out the form below and we'll have your AI Suite generating revenue within 48 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-white">Full Name *</label>
                      <input className="w-full mt-1 px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:border-green-500" type="text" placeholder="Your full name" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white">Company *</label>
                      <input className="w-full mt-1 px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:border-green-500" type="text" placeholder="Company name" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-white">Business Email *</label>
                      <input className="w-full mt-1 px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:border-green-500" type="email" placeholder="you@company.com" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white">Phone *</label>
                      <input className="w-full mt-1 px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:border-green-500" type="tel" placeholder="(555) 123-4567" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-white">Current Monthly Revenue</label>
                    <select className="w-full mt-1 px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:border-green-500">
                      <option>Select revenue range</option>
                      <option>$10K - $50K/month</option>
                      <option>$50K - $100K/month</option>
                      <option>$100K - $500K/month</option>
                      <option>$500K+ /month</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-white">Biggest Revenue Challenge</label>
                    <textarea className="w-full mt-1 px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:border-green-500" rows={3} placeholder="What's costing you the most revenue right now?"></textarea>
                  </div>
                  
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white pulse" size="lg">
                    🚀 GET MY $66K AI SUITE FOR $2,997/MONTH
                  </Button>
                </form>
                
                <p className="text-xs text-gray-400 mt-4 text-center">
                  🔒 Your information is 100% secure. We'll call you within 2 hours to set up your AI Suite.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-6 py-3 rounded-full text-sm border border-yellow-500/30">
              <Clock className="h-4 w-4" />
              <span>Limited Time: Lock in $2,997/month before price increases to $4,997</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Premium Design */}
      <footer className="relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background */}
        <div className="absolute inset-0 gradient-premium opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/20 to-transparent" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-pink-500 rounded-xl flex items-center justify-center shadow-premium">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">PrismAI</span>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Intelligent Business Automation Platform that transforms operations through AI. Refract your business potential with comprehensive automation solutions.
              </p>

              {/* Security badges */}
              <div className="flex flex-wrap gap-3">
                <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm text-gray-300">SOC2 Ready</span>
                </div>
                <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-300">GDPR Compliant</span>
                </div>
                <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">HIPAA Available</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-6 text-white text-lg">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="#features" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/demo" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Demo
                  </Link>
                </li>
                <li>
                  <Link href="/developer-portal" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Security
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-6 text-white text-lg">Company</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-gray-300 hover:text-pink-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-pink-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#contact" className="text-gray-300 hover:text-pink-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-pink-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-6 text-white text-lg">Support</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/docs" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 flex items-center gap-2 group">
                    <span className="w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700/50 pt-8 mt-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-400 text-center md:text-left">
                &copy; 2025 PrismAI. All rights reserved. Intelligent Business Automation Platform.
              </p>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
                <span className="text-gray-600">•</span>
                <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link>
                <span className="text-gray-600">•</span>
                <Link href="/security" className="hover:text-cyan-400 transition-colors">Security</Link>
                <span className="text-gray-600">•</span>
                <a href="mailto:contact@prismai.com" className="hover:text-pink-400 transition-colors">contact@prismai.com</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
