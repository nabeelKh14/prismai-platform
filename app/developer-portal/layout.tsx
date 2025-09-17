import { Metadata } from 'next'
import { DeveloperPortalNav } from '@/components/developer-portal/developer-portal-nav'

export const metadata: Metadata = {
  title: 'Developer Portal - PrismAI',
  description: 'Developer portal for PrismAI API integration',
}

export default function DeveloperPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <DeveloperPortalNav />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}