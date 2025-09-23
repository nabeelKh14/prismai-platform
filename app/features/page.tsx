'use client';

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import TiltedCard from "@/components/TiltedCard"
import {
  Star,
  CheckCircle,
  ArrowRight,
  PhoneCall,
  Target,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import DotGrid from '@/components/DotGrid'

export default function FeaturesPage() {
  return (
    <div className="min-h-screen" style={{backgroundColor: '#0B0B0D'}}>
      {/* Navigation */}
      <nav className="border-b border-cyan-500/20 backdrop-blur supports-[backdrop-filter]:bg-[#0B0B0D]/60 sticky top-0 z-50" style={{backgroundColor: '#0B0B0D'}}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <PhoneCall className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">PrismAI</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <Link href="/features" className="text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                Features
              </Link>
              <Link href="/demo" className="text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                Demo
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-cyan-400 transition-colors duration-200">
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

      {/* Interactive dot-grid background */}
      <DotGrid
        dotSize={2}
        gap={24}
        baseColor="#00ffff"
        activeColor="#ffffff"
        proximity={120}
        speedTrigger={50}
        shockRadius={200}
        shockStrength={3}
        className="fixed inset-0 z-0"
        style={{ opacity: 0.6 }}
      />

      {/* Features Section - Premium Capabilities */}
      <section className="py-24 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
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
              AI Voice Agent{" "}
              <span className="text-gradient">Capabilities</span>
            </h2>
            <p className="premium-subheading text-xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              Advanced voice technology that handles receptionist duties, customer service, and intelligent conversations across all channels
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <TiltedCard
              imageSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiMwMGFmZmYiIHN0b3Atb3BhY2l0eT0iMC4yIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iIzAwZmZmZiIgc3RvcC1vcGFjaXR5PSIwLjEiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
              altText="AI Receptionist"
              captionText="AI Receptionist"
              containerHeight="350px"
              containerWidth="100%"
              scaleOnHover={1.05}
              overlayContent={
                <div className="p-8 text-center h-full flex flex-col justify-center">
                  <div className="flex items-center justify-center w-16 h-16 bg-cyan-500/20 rounded-2xl mb-6 mx-auto">
                    <PhoneCall className="h-8 w-8 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">AI Receptionist</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Professional voice receptionist that handles calls 24/7, schedules appointments, takes messages, and provides instant responses to customer inquiries
                  </p>
                </div>
              }
              displayOverlayContent={true}
            />

            <TiltedCard
              imageSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiMwMGFmZmYiIHN0b3Atb3BhY2l0eT0iMC4yIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iIzAwZmZmZiIgc3RvcC1vcGFjaXR5PSIwLjEiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
              altText="Lead Generation Engine"
              captionText="Lead Generation Engine - $8K Value"
              containerHeight="350px"
              containerWidth="100%"
              scaleOnHover={1.05}
              overlayContent={
                <div className="p-8 text-center h-full flex flex-col justify-center relative">
                  <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                    <span className="text-xs font-bold text-cyan-300">$8K Value</span>
                  </div>
                  <div className="flex items-center justify-center w-16 h-16 bg-cyan-500/20 rounded-2xl mb-6 mx-auto">
                    <Target className="h-8 w-8 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">Lead Generation Engine</h3>
                  <p className="text-gray-300 leading-relaxed">
                    AI-powered scoring + qualification + BANT analysis + automatic lead routing to your best closers with predictive insights
                  </p>
                </div>
              }
              displayOverlayContent={true}
            />

            <TiltedCard
              imageSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiNmZjAwZmYiIHN0b3Atb3BhY2l0eT0iMC4yIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iI2ZmMDBmZiIgc3RvcC1vcGFjaXR5PSIwLjEiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
              altText="Customer Management CRM"
              captionText="Customer Management CRM - $12K Value"
              containerHeight="350px"
              containerWidth="100%"
              scaleOnHover={1.05}
              overlayContent={
                <div className="p-8 text-center h-full flex flex-col justify-center relative">
                  <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                    <span className="text-xs font-bold text-pink-300">$12K Value</span>
                  </div>
                  <div className="flex items-center justify-center w-16 h-16 bg-pink-500/20 rounded-2xl mb-6 mx-auto">
                    <Users className="h-8 w-8 text-pink-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">Customer Management CRM</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Complete relationship management + interaction tracking + lifetime value analysis + VIP routing with personalized service
                  </p>
                </div>
              }
              displayOverlayContent={true}
            />

            <TiltedCard
              imageSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiM4MDAwZmYiIHN0b3Atb3BhY2l0eT0iMC4yIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iIzgwMDBmZiIgc3RvcC1vcGFjaXR5PSIwLjEiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
              altText="Analytics Dashboard"
              captionText="Analytics Dashboard - $10K Value"
              containerHeight="350px"
              containerWidth="100%"
              scaleOnHover={1.05}
              overlayContent={
                <div className="p-8 text-center h-full flex flex-col justify-center relative">
                  <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                    <span className="text-xs font-bold text-purple-300">$10K Value</span>
                  </div>
                  <div className="flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-2xl mb-6 mx-auto">
                    <BarChart3 className="h-8 w-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">Analytics Dashboard</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Business intelligence + predictive analytics + ROI tracking + executive reporting + trend analysis with real-time insights
                  </p>
                </div>
              }
              displayOverlayContent={true}
            />

            <TiltedCard
              imageSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiNmZjgwMDAiIHN0b3Atb3BhY2l0eT0iMC4yIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iI2ZmODAwMCIgc3RvcC1vcGFjaXR5PSIwLjEiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
              altText="Marketing Automation"
              captionText="Marketing Automation - $7K Value"
              containerHeight="350px"
              containerWidth="100%"
              scaleOnHover={1.05}
              overlayContent={
                <div className="p-8 text-center h-full flex flex-col justify-center relative">
                  <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                    <span className="text-xs font-bold text-orange-300">$7K Value</span>
                  </div>
                  <div className="flex items-center justify-center w-16 h-16 bg-orange-500/20 rounded-2xl mb-6 mx-auto">
                    <MessageSquare className="h-8 w-8 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">Marketing Automation</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Email campaigns + social media automation + content generation + nurture sequences + A/B testing with AI optimization
                  </p>
                </div>
              }
              displayOverlayContent={true}
            />

            <TiltedCard
              imageSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiMwMDgwZmYiIHN0b3Atb3BhY2l0eT0iMC4yIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iIzAwODBmZiIgc3RvcC1vcGFjaXR5PSIwLjEiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
              altText="Intelligent Chatbot Suite"
              captionText="Intelligent Chatbot Suite - FREE"
              containerHeight="350px"
              containerWidth="100%"
              scaleOnHover={1.05}
              overlayContent={
                <div className="p-8 text-center h-full flex flex-col justify-center relative">
                  <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                    <span className="text-xs font-bold text-blue-300">FREE</span>
                  </div>
                  <div className="flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-2xl mb-6 mx-auto">
                    <MessageSquare className="h-8 w-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">Intelligent Chatbot Suite</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Voice and text chatbots for customer service, FAQ handling, lead qualification, and seamless escalation to human agents when needed
                  </p>
                </div>
              }
              displayOverlayContent={true}
            />

            <TiltedCard
              imageSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiMwMGZmZmYiIHN0b3Atb3BhY2l0eT0iMC4yIiBvZmZzZXQ9IjAlIi8+PHN0b3Agc3RvcC1jb2xvcj0iIzAwZmZmZiIgc3RvcC1vcGFjaXR5PSIwLjEiIG9mZnNldD0iMTAwJSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
              altText="Settings Management"
              captionText="Settings Management - $5K Value"
              containerHeight="350px"
              containerWidth="100%"
              scaleOnHover={1.05}
              overlayContent={
                <div className="p-8 text-center h-full flex flex-col justify-center relative">
                  <div className="absolute -top-3 -right-3 glass rounded-full px-3 py-1">
                    <span className="text-xs font-bold text-teal-300">$5K Value</span>
                  </div>
                  <div className="flex items-center justify-center w-16 h-16 bg-teal-500/20 rounded-2xl mb-6 mx-auto">
                    <Settings className="h-8 w-8 text-teal-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">Settings Management</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Complete configuration interface + user management + security controls + integration settings with enterprise-grade security
                  </p>
                </div>
              }
              displayOverlayContent={true}
            />
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
    </div>
  )
}