'use client';

import { Button } from "@/components/ui/button"
import { Phone } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Navbar() {
    const pathname = usePathname();
    const isAuthPage = pathname.startsWith('/auth');
    const isDashboardPage = pathname.startsWith('/dashboard');

    if (isAuthPage || isDashboardPage) return null;

    return (
        <nav className="border-b border-cyan-500/20 backdrop-blur supports-[backdrop-filter]:bg-[#0B0B0D]/60 sticky top-0 z-50" style={{ backgroundColor: '#0B0B0D' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center space-x-2 group">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <Phone className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">PrismAI</span>
                    </Link>

                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="/features" className="text-sm font-medium text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                            Features
                        </Link>
                        <Link href="/demo" className="text-sm font-medium text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                            Demo
                        </Link>
                        <Link href="/pricing" className="text-sm font-medium text-gray-300 hover:text-cyan-400 transition-colors duration-200">
                            Pricing
                        </Link>
                        <Link href="/auth/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors duration-200">
                            Login
                        </Link>
                        <Button
                            className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 rounded-xl font-semibold px-6"
                            asChild
                        >
                            <Link href="/auth/sign-up">Get Started</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
