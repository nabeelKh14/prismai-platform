"use client"

import React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Phone, ArrowLeft, Shield, Zap, Star, CheckCircle, TrendingUp, Award, Users, DollarSign, Timer, Crown, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Debug: Log when component mounts
  React.useEffect(() => {
    console.log('Login page mounted successfully')
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-pink-500/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-pink-400/20" />
      <div className="absolute inset-0 opacity-50">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>
      
      <div className="relative flex min-h-screen">
        {/* Left Side - Hormozi Value Proposition */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 relative z-10">
          <div className="max-w-lg">
            {/* Premium Logo */}
            <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-2xl shadow-cyan-500/25">
                  <Crown className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">PrismAI</span>
                <div className="text-xs text-cyan-400 font-semibold tracking-wider">INTELLIGENT BUSINESS AUTOMATION</div>
              </div>
            </Link>

            {/* Hormozi Headline */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-full text-sm font-bold animate-pulse">
                  <Timer className="h-4 w-4" />
                  URGENT: Only 23 Spots Left This Month
                </div>
                <h1 className="text-5xl font-black text-white mb-6 leading-[1.1]">
                  Welcome Back To Your
                  <span className="block bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent relative">
                    $2.3M Revenue Machine
                    <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full" />
                  </span>
                </h1>
                <p className="text-xl text-gray-300 leading-relaxed font-medium">
                  The same AI suite that generated <span className="text-green-400 font-bold">$47M+</span> for 1,247+ businesses is waiting for you...
                </p>
              </div>

              {/* Proof Metrics - Hormozi Style */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-400/30 rounded-xl backdrop-blur-sm hover:scale-105 transition-all duration-300">
                  <DollarSign className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
                  <div className="text-2xl font-black text-cyan-400 mb-1">$47M+</div>
                  <div className="text-xs text-gray-300 font-semibold">CLIENT REVENUE</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-400/30 rounded-xl backdrop-blur-sm hover:scale-105 transition-all duration-300">
                  <TrendingUp className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <div className="text-2xl font-black text-green-400 mb-1">847%</div>
                  <div className="text-xs text-gray-300 font-semibold">AVG ROI</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-pink-500/20 to-pink-600/20 border border-pink-400/30 rounded-xl backdrop-blur-sm hover:scale-105 transition-all duration-300">
                  <Users className="h-6 w-6 text-pink-400 mx-auto mb-2" />
                  <div className="text-2xl font-black text-pink-400 mb-1">1,247</div>
                  <div className="text-xs text-gray-300 font-semibold">SUCCESS STORIES</div>
                </div>
              </div>

              {/* Social Proof - Hormozi Style */}
              <div className="relative">
                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-cyan-500/40 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">
                  <div className="absolute -top-3 left-6">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-3 py-1 rounded-full text-xs font-black">
                      ⭐ VERIFIED SUCCESS STORY
                    </div>
                  </div>
                  <div className="flex mb-4 justify-center">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <blockquote className="text-white text-lg font-medium text-center mb-4 leading-relaxed">
                    "Generated <span className="text-green-400 font-bold">$2.8M in additional revenue</span> within 67 days. This AI suite is absolutely insane. Best investment I've ever made."
                  </blockquote>
                  <div className="text-center border-t border-gray-700 pt-4">
                    <div className="font-bold text-white">Marcus Johnson</div>
                    <div className="text-cyan-400 text-sm font-semibold">CEO, TechCorp Solutions</div>
                    <div className="text-xs text-gray-400 mt-1">Generated $2.8M in 67 days</div>
                  </div>
                </div>
              </div>

              {/* Trust Indicators - Premium */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Badge className="bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-400 border-green-500/40 px-3 py-2 font-bold hover:scale-105 transition-all">
                    <Shield className="h-4 w-4 mr-2" />
                    SOC2 + Enterprise Security
                  </Badge>
                  <Badge className="bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 text-cyan-400 border-cyan-500/40 px-3 py-2 font-bold hover:scale-105 transition-all">
                    <Award className="h-4 w-4 mr-2" />
                    99.3% Client Retention
                  </Badge>
                </div>
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 text-center">
                    <Sparkles className="h-5 w-5 text-pink-400" />
                    <span className="text-white font-bold">Join 1,247+ businesses already using our AI suite</span>
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Premium Login Form */}
        <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 relative z-10">
          <div className="w-full max-w-md">
            {/* Mobile Premium Header */}
            <div className="lg:hidden text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-2 text-gray-300 hover:text-white mb-6 group">
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to home
              </Link>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-400 rounded-xl flex items-center justify-center shadow-2xl">
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse" />
                </div>
                <div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">PrismAI</span>
                  <div className="text-xs text-cyan-400 font-semibold">INTELLIGENT BUSINESS AUTOMATION</div>
                </div>
              </div>
            </div>

            <Card className="border-2 border-cyan-500/30 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl shadow-2xl shadow-cyan-500/10">
              <CardHeader className="text-center relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-cyan-400 to-pink-400 text-black px-4 py-1 rounded-full text-xs font-black">
                    🔥 PREMIUM ACCESS
                  </div>
                </div>
                <CardTitle className="text-3xl font-black text-white mt-4 mb-2">
                  Welcome Back, <span className="bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">Champion</span>
                </CardTitle>
                <CardDescription className="text-gray-300 text-lg font-medium">
                  Your <span className="text-green-400 font-bold">$2.3M Revenue Engine</span> is waiting
                </CardDescription>
                <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-400 px-4 py-2 rounded-full text-sm border border-green-500/40 mt-4 font-bold">
                  <Users className="h-4 w-4" />
                  <span>1,247+ Businesses Already Crushing It</span>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-white font-semibold text-base">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@company.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 bg-gray-800/80 border-2 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-xl text-lg font-medium transition-all duration-300 hover:border-cyan-500/50"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-white font-semibold text-base">Password</Label>
                      <Link href="/auth/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline font-medium transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 bg-gray-800/80 border-2 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-xl text-lg font-medium transition-all duration-300 hover:border-cyan-500/50"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-16 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 text-white font-black text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25 rounded-xl" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Accessing Your Revenue Engine...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Crown className="h-6 w-6" />
                        <span>🚀 ACCESS MY $2.3M AI SUITE</span>
                      </div>
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center">
                  <div className="mb-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="text-yellow-400 font-bold text-sm mb-1">⚡ New Here?</div>
                    <Link href="/auth/sign-up" className="text-white hover:text-cyan-300 font-bold text-lg hover:underline transition-colors">
                      Claim Your $66K AI Suite for $2,997/month →
                    </Link>
                    <div className="text-xs text-gray-400 mt-1">Price increases to $4,997 on Jan 31st</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
                <Shield className="h-3 w-3 text-green-400" />
                <span>Bank-level security • SOC2 Type II • 99.99% uptime</span>
              </div>
              <Link href="/privacy" className="text-xs text-cyan-400 hover:underline transition-colors">
                Privacy Policy & Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
