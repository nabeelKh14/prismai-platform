import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, Mail, CheckCircle, ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0B0B0D' }}>
      {/* Premium Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-pink-500/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-400/20 via-transparent to-cyan-400/20" />
      <div className="absolute inset-0 opacity-50">
        <div className="absolute top-10 left-10 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Premium Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-green-500/25">
                  <Crown className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">PrismAI</span>
                <div className="text-xs text-cyan-400 font-black tracking-wider">INTELLIGENT BUSINESS AUTOMATION</div>
              </div>
            </div>
          </div>

          <Card className="border-2 border-green-400/40 bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl shadow-2xl shadow-green-500/20 relative overflow-hidden">
            {/* Success Ribbon */}
            <div className="absolute top-0 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1 text-xs font-black transform rotate-12 translate-x-4 -translate-y-2 shadow-lg">
              SUCCESS!
            </div>
            
            <CardHeader className="text-center relative">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-green-400 to-emerald-400 text-black px-6 py-2 rounded-full text-sm font-black shadow-2xl animate-pulse">
                  🎉 WELCOME TO THE ELITE!
                </div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-400/50 rounded-full flex items-center justify-center mx-auto mb-6 mt-4">
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
              <CardTitle className="text-3xl font-black text-white mb-2">
                <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Check Your Email</span>
              </CardTitle>
              <CardDescription className="text-gray-300 text-lg font-medium">
                Your <span className="text-green-400 font-bold">$66K AI Suite</span> is waiting for activation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 p-6 rounded-xl">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Mail className="h-6 w-6 text-green-400" />
                  <span className="font-black text-green-400 text-lg">Confirmation Required</span>
                </div>
                <p className="text-gray-300 text-center font-medium">
                  We've sent you a confirmation link to activate your <span className="text-green-400 font-bold">$66K AI Revenue Engine</span>. Check your inbox and click the link to get started!
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-black text-white text-center text-lg">🚀 What Happens Next?</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-4 p-3 bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border border-cyan-400/30 rounded-xl">
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black text-white">1</span>
                    </div>
                    <span className="text-white font-semibold">Confirm your email address</span>
                  </div>
                  <div className="flex items-start gap-4 p-3 bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-400/30 rounded-xl">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black text-white">2</span>
                    </div>
                    <span className="text-white font-semibold">Access your AI suite dashboard</span>
                  </div>
                  <div className="flex items-start gap-4 p-3 bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-400/30 rounded-xl">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black text-white">3</span>
                    </div>
                    <span className="text-white font-semibold">Start generating revenue in 48 hours</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-center mb-4 font-medium">Didn't receive the email?</p>
                <Button className="w-full h-12 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-white font-bold transition-all duration-300 transform hover:scale-105 rounded-xl">
                  Resend Confirmation Email
                </Button>
              </div>

              <div className="text-center pt-4 border-t border-gray-700">
                <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-bold transition-colors group">
                  <span>Return to Homepage</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
