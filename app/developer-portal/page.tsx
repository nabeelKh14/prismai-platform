'use client';

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BookOpen,
  Key,
  BarChart3,
  Code,
  MessageSquare,
  Zap,
  Shield,
  Globe
} from 'lucide-react'
import DotGrid from '@/components/DotGrid'

const features = [
  {
    title: 'Interactive API Documentation',
    description: 'Explore our comprehensive API documentation with interactive examples and testing tools.',
    icon: BookOpen,
    href: '/docs',
    color: 'text-blue-600',
  },
  {
    title: 'API Key Management',
    description: 'Generate, manage, and monitor your API keys with detailed usage analytics.',
    icon: Key,
    href: '/developer-portal/api-keys',
    color: 'text-green-600',
  },
  {
    title: 'Usage Analytics',
    description: 'Track your API usage, monitor performance, and optimize your integration.',
    icon: BarChart3,
    href: '/developer-portal/analytics',
    color: 'text-purple-600',
  },
  {
    title: 'Code Examples & SDKs',
    description: 'Get started quickly with code examples in multiple languages and SDKs.',
    icon: Code,
    href: '/developer-portal/examples',
    color: 'text-orange-600',
  },
  {
    title: 'Developer Community',
    description: 'Connect with other developers, share knowledge, and get help from the community.',
    icon: MessageSquare,
    href: '/developer-portal/community',
    color: 'text-pink-600',
  },
]

const stats = [
  {
    label: 'API Endpoints',
    value: '50+',
    description: 'Comprehensive endpoints for all business needs',
  },
  {
    label: 'Languages Supported',
    value: '8+',
    description: 'SDKs and examples in popular programming languages',
  },
  {
    label: 'Uptime SLA',
    value: '99.9%',
    description: 'Enterprise-grade reliability and performance',
  },
  {
    label: 'Global CDN',
    value: '15+',
    description: 'Edge locations worldwide for optimal performance',
  },
]

export default function DeveloperPortalPage() {
  return (
    <div className="space-y-12">
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
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Welcome to the{' '}
            <span className="text-primary">PrismAI</span>{' '}
            Developer Portal
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Build powerful business applications with our comprehensive API suite.
            From CRM integration to AI-powered analytics, we provide everything you need
            to create exceptional business solutions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/docs">
              <BookOpen className="mr-2 h-5 w-5" />
              View API Documentation
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/developer-portal/api-keys">
              <Key className="mr-2 h-5 w-5" />
              Get API Key
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-3xl font-bold text-primary">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{stat.label}</p>
              <p className="text-sm text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Features Grid */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Developer Tools & Resources</h2>
          <p className="text-muted-foreground mt-2">
            Everything you need to integrate with our platform successfully
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-muted ${feature.color}`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription>{feature.description}</CardDescription>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={feature.href}>
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Getting Started Section */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Ready to Get Started?</CardTitle>
          <CardDescription className="text-lg">
            Follow our quick start guide to begin integrating with our APIs
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto font-bold">
                1
              </div>
              <h3 className="font-semibold">Create Account</h3>
              <p className="text-muted-foreground">
                Sign up for a developer account and verify your email
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto font-bold">
                2
              </div>
              <h3 className="font-semibold">Generate API Key</h3>
              <p className="text-muted-foreground">
                Create your first API key and configure permissions
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto font-bold">
                3
              </div>
              <h3 className="font-semibold">Start Building</h3>
              <p className="text-muted-foreground">
                Use our documentation and examples to build your integration
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Button asChild>
              <Link href="/auth/sign-up">
                <Zap className="mr-2 h-4 w-4" />
                Create Developer Account
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">
                <BookOpen className="mr-2 h-4 w-4" />
                Read Documentation
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}