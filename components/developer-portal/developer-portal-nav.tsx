'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Key,
  BarChart3,
  Code,
  MessageSquare,
  Settings,
  Home,
  Play
} from 'lucide-react'

const navigation = [
  {
    name: 'Overview',
    href: '/developer-portal',
    icon: Home,
  },
  {
    name: 'API Documentation',
    href: '/docs',
    icon: BookOpen,
    external: true,
  },
  {
    name: 'API Keys',
    href: '/developer-portal/api-keys',
    icon: Key,
  },
  {
    name: 'Usage Analytics',
    href: '/developer-portal/analytics',
    icon: BarChart3,
  },
  {
    name: 'Code Examples',
    href: '/developer-portal/examples',
    icon: Code,
  },
  {
    name: 'Community',
    href: '/developer-portal/community',
    icon: MessageSquare,
  },
  {
    name: 'API Tester',
    href: '/developer-portal/api-tester',
    icon: Play,
  },
  {
    name: 'Settings',
    href: '/developer-portal/settings',
    icon: Settings,
  },
]

export function DeveloperPortalNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/developer-portal" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Code className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">Developer Portal</span>
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              {navigation.map((item) => {
                const isActive = item.external
                  ? false
                  : pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs">
                <BookOpen className="h-4 w-4 mr-2" />
                API Docs
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}