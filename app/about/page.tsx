import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building, Users, Target, Award, TrendingUp, Globe, Heart, Zap, Star, CheckCircle, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About PrismAI - Our Mission & Vision',
  description: 'Learn about PrismAI\'s mission to revolutionize business automation through AI-powered solutions.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Building className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">About PrismAI</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We're on a mission to democratize AI-powered business automation, making enterprise-grade intelligence accessible to businesses of all sizes.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle>Our Mission</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                To refract the potential of every business through intelligent automation, delivering AI-powered solutions that transform operations, enhance customer experiences, and drive unprecedented growth.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Star className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle>Our Vision</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                A world where every business, regardless of size, has access to the same level of AI intelligence and automation that was once reserved for Fortune 500 companies.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-center">By the Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">$47M+</div>
                <p className="text-muted-foreground">Revenue Generated for Clients</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">500+</div>
                <p className="text-muted-foreground">Businesses Automated</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">847%</div>
                <p className="text-muted-foreground">Average ROI</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
                <p className="text-muted-foreground">Uptime Guarantee</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Our Story */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Story</h2>
          <div className="prose prose-lg max-w-4xl mx-auto">
            <p className="mb-6">
              PrismAI was born from a simple observation: the most successful businesses weren't necessarily the biggest, but they were the most efficient. They had systems that worked tirelessly, processes that optimized themselves, and customer experiences that felt personal and premium.
            </p>
            <p className="mb-6">
              We realized that the gap between enterprise-grade automation and small business capabilities was artificial. AI had advanced to the point where sophisticated automation could be made accessible, affordable, and easy to implement.
            </p>
            <p className="mb-6">
              Today, PrismAI serves businesses from startups to enterprises, providing the same level of intelligent automation that was once the exclusive domain of tech giants. Our platform handles millions of customer interactions monthly, generates tens of millions in additional revenue for our clients, and continues to push the boundaries of what's possible with AI.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Heart className="h-5 w-5 text-green-600" />
                  </div>
                  <CardTitle className="text-lg">Customer First</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Every decision we make starts with our customers. Their success is our success, and we measure ourselves by the value we create.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">Innovation</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We embrace cutting-edge technology and continuously evolve our platform to deliver the best possible solutions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Shield className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle className="text-lg">Trust & Security</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We maintain the highest standards of security and transparency, ensuring our clients' data is always protected.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Team */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Leadership Team</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <CardTitle>CEO & Founder</CardTitle>
                <p className="text-muted-foreground">Former enterprise AI consultant with 10+ years in business automation</p>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <CardTitle>CTO</CardTitle>
                <p className="text-muted-foreground">AI/ML expert with experience at leading tech companies</p>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <CardTitle>Head of Customer Success</CardTitle>
                <p className="text-muted-foreground">Customer experience leader focused on delivering exceptional results</p>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Achievements */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Achievements & Recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>SOC 2 Type II Certified</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>500+ Happy Clients</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>$47M+ Client Revenue Generated</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>99.9% Uptime Guarantee</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>847% Average Client ROI</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact CTA */}
        <div className="text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Ready to Transform Your Business?</h3>
              <p className="text-muted-foreground mb-4">
                Join hundreds of businesses already using PrismAI to automate operations and drive growth.
              </p>
              <Button asChild>
                <Link href="/demo">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Schedule a Demo
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}