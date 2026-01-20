'use client';

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building, Users, Target, TrendingUp, Star } from 'lucide-react'
import DotGrid from '@/components/DotGrid'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0D] relative overflow-hidden">
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

      <div className="relative z-10 container mx-auto py-24 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="flex items-center justify-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-white/10 glass shadow-lg">
              <Building className="h-10 w-10 text-cyan-400" />
            </div>
          </div>
          <h1 className="premium-heading text-5xl md:text-6xl font-bold mb-6 text-white">About PrismAI</h1>
          <p className="premium-subheading text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            We're on a mission to democratize AI-powered business automation, making enterprise-grade intelligence accessible to businesses of all sizes.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 mb-20 text-white">
          <Card className="card-premium p-4">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
                  <Target className="h-6 w-6 text-cyan-400" />
                </div>
                <CardTitle className="text-2xl">Our Mission</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 leading-relaxed text-lg">
                To refract the potential of every business through intelligent automation, delivering AI-powered solutions that transform operations, enhance customer experiences, and drive unprecedented growth.
              </p>
            </CardContent>
          </Card>

          <Card className="card-premium p-4">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center border border-pink-500/30">
                  <Star className="h-6 w-6 text-pink-400" />
                </div>
                <CardTitle className="text-2xl">Our Vision</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 leading-relaxed text-lg">
                A world where every business, regardless of size, has access to the same level of AI intelligence and automation that was once reserved for Fortune 500 companies.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <Card className="card-premium-strong mb-20 py-12">
          <CardHeader>
            <CardTitle className="text-3xl text-center text-white mb-8">By the Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-12">
              <div className="text-center">
                <div className="text-5xl font-extrabold text-gradient mb-3">$47M+</div>
                <p className="text-gray-400 font-medium">Revenue Generated</p>
              </div>
              <div className="text-center">
                <div className="text-5xl font-extrabold text-gradient-pink mb-3">500+</div>
                <p className="text-gray-400 font-medium">Businesses Automated</p>
              </div>
              <div className="text-center">
                <div className="text-5xl font-extrabold text-gradient mb-3">847%</div>
                <p className="text-gray-400 font-medium">Average ROI</p>
              </div>
              <div className="text-center">
                <div className="text-5xl font-extrabold text-gradient-pink mb-3">99.9%</div>
                <p className="text-gray-400 font-medium">Uptime Guarantee</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Our Story */}
        <div className="mb-24 text-center">
          <h2 className="premium-heading text-4xl font-bold mb-12 text-white">Our Story</h2>
          <div className="max-w-4xl mx-auto space-y-8">
            <p className="text-xl text-gray-300 leading-relaxed text-pretty">
              PrismAI was born from a simple observation: the most successful businesses weren't necessarily the biggest, but they were the most efficient. They had systems that worked tirelessly, processes that optimized themselves, and customer experiences that felt personal and premium.
            </p>
            <p className="text-xl text-gray-300 leading-relaxed text-pretty">
              We realized that the gap between enterprise-grade automation and small business capabilities was artificial. AI had advanced to the point where sophisticated automation could be made accessible, affordable, and easy to implement.
            </p>
            <p className="text-xl text-gray-300 leading-relaxed text-pretty font-semibold text-gradient-cyan">
              Today, PrismAI serves businesses from startups to enterprises, providing the same level of intelligent automation that was once the exclusive domain of tech giants.
            </p>
          </div>
        </div>

        {/* Leadership Team */}
        <div className="mb-24">
          <h2 className="premium-heading text-4xl font-bold mb-12 text-center text-white">Leadership Team</h2>
          <div className="grid md:grid-cols-3 gap-8 text-white">
            <Card className="card-premium">
              <CardHeader className="text-center py-10">
                <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-cyan-500/20">
                  <Users className="h-12 w-12 text-white" />
                </div>
                <CardTitle className="text-xl">CEO & Founder</CardTitle>
                <p className="text-gray-400 mt-4 leading-relaxed px-4">Former enterprise AI consultant with 10+ years in business automation</p>
              </CardHeader>
            </Card>

            <Card className="card-premium">
              <CardHeader className="text-center py-10">
                <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-pink-500/20">
                  <Users className="h-12 w-12 text-white" />
                </div>
                <CardTitle className="text-xl">CTO</CardTitle>
                <p className="text-gray-400 mt-4 leading-relaxed px-4">AI/ML expert with experience at leading tech companies</p>
              </CardHeader>
            </Card>

            <Card className="card-premium">
              <CardHeader className="text-center py-10">
                <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/20">
                  <Users className="h-12 w-12 text-white" />
                </div>
                <CardTitle className="text-xl">Head of Success</CardTitle>
                <p className="text-gray-400 mt-4 leading-relaxed px-4">Customer experience leader focused on delivering exceptional results</p>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="text-center">
          <Card className="card-premium-strong max-w-2xl mx-auto py-12 px-8">
            <CardContent>
              <h3 className="text-3xl font-bold mb-4 text-white">Ready to Transform Your Business?</h3>
              <p className="text-gray-400 mb-8 text-lg">
                Join hundreds of businesses already using PrismAI to automate operations and drive growth.
              </p>
              <Button size="lg" className="btn-premium px-12 py-7 h-auto rounded-2xl font-bold text-xl" asChild>
                <Link href="/demo">
                  <TrendingUp className="mr-3 h-6 w-6" />
                  Schedule a Consultation
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}