'use client';

import { Button } from "@/components/ui/button"
import {
  Star,
  CheckCircle,
  ArrowRight,
  Phone,
} from "lucide-react"
import Link from "next/link"
import DotGrid from '@/components/DotGrid'

export default function PricingPage() {
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

      {/* Pricing Section - Premium Presentation */}
      <section className="py-24 relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
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
              Your{" "}
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

            {/* Pricing Details */}
            <div className="glass rounded-2xl p-8 max-w-2xl mx-auto animate-fade-in-up" style={{animationDelay: '0.7s'}}>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">$4,000</div>
                <div className="text-lg text-gray-300 mb-4">upfront investment</div>
                <div className="text-2xl font-bold text-cyan-400 mb-2">+ $1,000</div>
                <div className="text-lg text-gray-300">monthly retainer</div>
                <div className="mt-6 pt-6 border-t border-gray-600">
                  <p className="text-sm text-gray-400">Includes complete implementation, training, and ongoing support</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center animate-fade-in-up" style={{animationDelay: '0.8s'}}>
            <Button className="btn-premium text-xl px-12 py-6 font-bold rounded-2xl" asChild>
              <Link href="/auth/sign-up">
                Contact Sales
                <ArrowRight className="ml-3 h-6 w-6" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}