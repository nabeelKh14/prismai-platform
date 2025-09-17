"use client"

import React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Phone, ArrowLeft, CheckCircle, Zap, Star, Shield, Award, TrendingUp, Clock, Target, Crown, Sparkles, DollarSign, Users, Timer, Gift } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const businessTypes = [
  "Healthcare & Medical",
  "Legal & Professional Services",
  "Real Estate & Property",
  "Beauty, Wellness & Spa",
  "Financial & Insurance Services",
  "E-commerce & Retail",
  "Restaurants & Food Service",
  "Automotive & Transportation",
  "Home & Construction Services",
  "Technology & Software",
  "Marketing & Advertising",
  "Education & Training",
  "Other",
]

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [businessType, setBusinessType] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Debug: Log when component mounts
  React.useEffect(() => {
    console.log('Sign-up page mounted successfully')
  }, [])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessName,
            business_type: businessType,
            phone_number: phoneNumber,
          },
        },
      })
      if (error) throw error
      router.push("/auth/sign-up-success")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{backgroundColor: '#0B0B0D'}}>
      {/* Premium Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-pink-500/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-pink-400/20" />
      <div className="absolute inset-0 opacity-60">
        <div className="absolute top-10 left-10 w-96 h-96 bg-gradient-to-r from-cyan-500/15 to-blue-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-[32rem] h-[32rem] bg-gradient-to-r from-pink-500/15 to-purple-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>
      
      <div className="relative flex min-h-screen">
        {/* Left Side - Hormozi Irresistible Offer */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 relative z-10">
          <div className="max-w-lg">
            {/* Premium Logo with Animation */}
            <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-2xl shadow-cyan-500/25">
                  <Crown className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse" />
                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse delay-500" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">PrismAI</span>
                <div className="text-xs text-cyan-400 font-black tracking-wider">INTELLIGENT BUSINESS AUTOMATION</div>
              </div>
            </Link>

            {/* Hormozi Scarcity + Irresistible Offer */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur opacity-75 animate-pulse"></div>
                  <div className="relative inline-flex items-center gap-2 bg-gradient-to-r from-red-500/90 to-orange-500/90 border-2 border-red-400 text-white px-6 py-3 rounded-full font-black text-sm shadow-2xl">
                    <Clock className="h-5 w-5 animate-pulse" />
                    ⚠️ URGENT: Only 12 Spots Left Today - Price Jumps $2,000 Tomorrow
                  </div>
                </div>
                <h1 className="text-5xl font-black text-white mb-4 leading-[1.05]">
                  Last Chance:
                  <span className="block bg-gradient-to-r from-green-400 via-emerald-400 to-green-300 bg-clip-text text-transparent relative">
                    $66K AI Suite for $2,997
                    <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse" />
                  </span>
                  <span className="block text-2xl text-gray-300 mt-2 font-medium">
                    (That's <span className="text-red-400 font-black">95% OFF</span> the real value)
                  </span>
                </h1>
              </div>

              {/* Value Stack - Hormozi Method */}
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl blur"></div>
                  <div className="relative bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-2 border-green-400/50 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="text-4xl font-black text-green-400 mb-2">$66,000</div>
                      <div className="text-lg text-green-300 line-through mb-2 font-semibold">Regular Investment</div>
                      <div className="text-3xl font-black text-white mb-1">$2,997/month</div>
                      <div className="text-lg font-black text-green-400">You Save $63,003 (95% OFF)</div>
                      <div className="text-sm text-green-300 mt-2 font-bold">⏰ Price increases to $4,997 tomorrow</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border border-cyan-400/30 rounded-xl hover:scale-105 transition-all duration-300">
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-bold">Complete PrismAI Platform</span>
                      <span className="text-cyan-400 font-black ml-2">($15K value)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-400/30 rounded-xl hover:scale-105 transition-all duration-300">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-bold">AI Lead Generation Engine</span>
                      <span className="text-purple-400 font-black ml-2">($12K value)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-pink-500/10 to-pink-600/10 border border-pink-400/30 rounded-xl hover:scale-105 transition-all duration-300">
                    <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-bold">Smart CRM + Automation</span>
                      <span className="text-pink-400 font-black ml-2">($18K value)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-400/30 rounded-xl hover:scale-105 transition-all duration-300">
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-bold">Revenue Analytics Dashboard</span>
                      <span className="text-orange-400 font-black ml-2">($10K value)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-400/30 rounded-xl hover:scale-105 transition-all duration-300">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-bold">24/7 AI Customer Support</span>
                      <span className="text-blue-400 font-black ml-2">($11K value)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Irresistible Bonuses */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl blur"></div>
                <div className="relative bg-gradient-to-br from-yellow-900/40 to-orange-900/40 border-2 border-yellow-400/50 rounded-2xl p-6">
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-4 py-2 rounded-full font-black text-sm">
                      <Gift className="h-4 w-4" />
                      🎁 EXCLUSIVE BONUSES (Limited Time)
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                      <span className="text-white font-bold">White-Glove Setup + Training</span>
                      <span className="text-yellow-400 font-black ml-auto">($8K value)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                      <span className="text-white font-bold">90-Day Revenue Guarantee</span>
                      <span className="text-yellow-400 font-black ml-auto">(Priceless)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                      <span className="text-white font-bold">Dedicated Success Manager</span>
                      <span className="text-yellow-400 font-black ml-auto">($15K value)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Proof + Trust */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-400/40 rounded-xl">
                    <DollarSign className="h-5 w-5 text-green-400 mx-auto mb-1" />
                    <div className="text-xl font-black text-green-400">$47M+</div>
                    <div className="text-xs text-gray-300 font-semibold">GENERATED</div>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-400/40 rounded-xl">
                    <TrendingUp className="h-5 w-5 text-cyan-400 mx-auto mb-1" />
                    <div className="text-xl font-black text-cyan-400">847%</div>
                    <div className="text-xs text-gray-300 font-semibold">AVG ROI</div>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-pink-500/20 to-pink-600/20 border border-pink-400/40 rounded-xl">
                    <Users className="h-5 w-5 text-pink-400 mx-auto mb-1" />
                    <div className="text-xl font-black text-pink-400">1,247</div>
                    <div className="text-xs text-gray-300 font-semibold">SUCCESS</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/40 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 text-center">
                    <Shield className="h-5 w-5 text-green-400" />
                    <span className="text-white font-bold">100% Risk-Free • 90-Day Money-Back Guarantee</span>
                    <Shield className="h-5 w-5 text-green-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Premium Signup Form */}
        <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 relative z-10">
          <div className="w-full max-w-md">
            {/* Mobile Premium Header */}
            <div className="lg:hidden text-center mb-6">
              <Link href="/" className="inline-flex items-center gap-2 text-gray-300 hover:text-white mb-4 group">
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
                  <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">PrismAI</span>
                  <div className="text-xs text-cyan-400 font-black">INTELLIGENT BUSINESS AUTOMATION</div>
                </div>
              </div>
            </div>

            <Card className="border-2 border-green-400/40 bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl shadow-2xl shadow-green-500/20 relative overflow-hidden">
              {/* Premium Ribbon */}
              <div className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-1 text-xs font-black transform rotate-12 translate-x-4 -translate-y-2 shadow-lg">
                URGENT!
              </div>
              
              <CardHeader className="text-center relative pb-4">
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-green-400 to-emerald-400 text-black px-6 py-2 rounded-full text-sm font-black shadow-2xl">
                    🚀 CLAIM YOUR $66K AI SUITE
                  </div>
                </div>
                <CardTitle className="text-2xl font-black text-white mt-6 mb-2">
                  <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Last 12 Spots</span> Available
                </CardTitle>
                <CardDescription className="text-gray-300 text-base font-medium">
                  Complete setup in <span className="text-green-400 font-bold">48 hours</span> • Revenue generating by <span className="text-cyan-400 font-bold">week 1</span>
                </CardDescription>
                <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-500/30 to-orange-500/30 text-red-300 px-4 py-2 rounded-full text-sm border border-red-500/40 mt-4 font-black animate-pulse">
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Price increases $2,000 in 23 hours 47 minutes</span>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor="businessName" className="text-white font-semibold text-base">Business Name *</Label>
                      <Input
                        id="businessName"
                        placeholder="Your Company Name"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="h-12 bg-gray-800/80 border-2 border-gray-600 text-white placeholder-gray-400 focus:border-green-400 focus:ring-green-400 rounded-xl font-medium transition-all duration-300 hover:border-green-500/50"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="businessType" className="text-white font-semibold text-base">Business Type *</Label>
                      <Select value={businessType} onValueChange={setBusinessType} required>
                        <SelectTrigger className="h-12 bg-gray-800/80 border-2 border-gray-600 text-white focus:border-green-400 focus:ring-green-400 rounded-xl font-medium">
                          <SelectValue placeholder="Select your industry" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600 rounded-xl">
                          {businessTypes.map((type) => (
                            <SelectItem key={type} value={type} className="text-white hover:bg-gray-700 focus:bg-gray-700">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-white font-semibold text-base">Business Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ceo@yourcompany.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 bg-gray-800/80 border-2 border-gray-600 text-white placeholder-gray-400 focus:border-green-400 focus:ring-green-400 rounded-xl text-base font-medium transition-all duration-300 hover:border-green-500/50"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="phoneNumber" className="text-white font-semibold text-base">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-12 bg-gray-800/80 border-2 border-gray-600 text-white placeholder-gray-400 focus:border-green-400 focus:ring-green-400 rounded-xl text-base font-medium transition-all duration-300 hover:border-green-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor="password" className="text-white font-semibold text-base">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••••••"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 bg-gray-800/80 border-2 border-gray-600 text-white placeholder-gray-400 focus:border-green-400 focus:ring-green-400 rounded-xl text-base font-medium transition-all duration-300 hover:border-green-500/50"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="confirmPassword" className="text-white font-semibold text-base">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••••••"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 bg-gray-800/80 border-2 border-gray-600 text-white placeholder-gray-400 focus:border-green-400 focus:ring-green-400 rounded-xl text-base font-medium transition-all duration-300 hover:border-green-500/50"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-16 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-400 hover:via-emerald-400 hover:to-green-500 text-white font-black text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/30 rounded-xl relative overflow-hidden" 
                    disabled={isLoading}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 animate-pulse"></div>
                    {isLoading ? (
                      <div className="relative flex items-center gap-3">
                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Setting up your $66K revenue engine...</span>
                      </div>
                    ) : (
                      <div className="relative flex items-center gap-3">
                        <Zap className="h-6 w-6" />
                        <span>🚀 CLAIM MY $66K AI SUITE FOR $2,997</span>
                      </div>
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center">
                  <div className="mb-4 p-4 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border border-cyan-500/30 rounded-xl">
                    <div className="text-cyan-400 font-bold text-sm mb-1">💡 Already have an account?</div>
                    <Link href="/auth/login" className="text-white hover:text-cyan-300 font-bold text-lg hover:underline transition-colors">
                      Access Your $2.3M Revenue Engine →
                    </Link>
                  </div>
                </div>

                {/* Guarantee */}
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="text-center">
                    <div className="text-green-400 font-bold text-lg mb-2">🔒 90-Day Revenue Guarantee</div>
                    <div className="text-gray-300 text-sm mb-4">
                      Generate $10K+ in new revenue within 90 days or we'll refund everything and work for FREE
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-cyan-400 font-bold">48 Hours</div>
                        <div className="text-xs text-gray-400">Setup Complete</div>
                      </div>
                      <div>
                        <div className="text-pink-400 font-bold">90 Days</div>
                        <div className="text-xs text-gray-400">Revenue Guarantee</div>
                      </div>
                      <div>
                        <div className="text-green-400 font-bold">847%</div>
                        <div className="text-xs text-gray-400">Average ROI</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 text-center text-xs text-gray-400">
              🔒 Your data is 100% secure • SOC2 compliant •{" "}
              <Link href="/privacy" className="hover:underline text-cyan-400">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
