import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Lock, Eye, Database, Mail, Phone } from 'lucide-react'
import DotGrid from '@/components/DotGrid'

export const metadata: Metadata = {
  title: 'Privacy Policy - PrismAI',
  description: 'Learn about how PrismAI protects your privacy and handles your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
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

      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Your privacy is important to us. This policy explains how PrismAI collects, uses, and protects your personal information.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last updated: January 2025
          </p>
        </div>

        {/* Quick Overview */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Quick Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <Lock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Data Encryption</h3>
                <p className="text-sm text-muted-foreground">
                  All data is encrypted in transit and at rest using industry-standard protocols.
                </p>
              </div>
              <div className="text-center">
                <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Minimal Collection</h3>
                <p className="text-sm text-muted-foreground">
                  We only collect data necessary to provide our services and improve your experience.
                </p>
              </div>
              <div className="text-center">
                <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Your Rights</h3>
                <p className="text-sm text-muted-foreground">
                  You have full control over your data and can request deletion at any time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Policy Content */}
        <div className="prose prose-lg max-w-4xl mx-auto">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
            <h3 className="text-xl font-semibold mb-3">Personal Information</h3>
            <p className="mb-4">
              We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support. This may include:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Name and contact information (email, phone number)</li>
              <li>Business information (company name, industry, role)</li>
              <li>Account credentials and preferences</li>
              <li>Communication history with our AI assistants</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">Usage Data</h3>
            <p className="mb-4">
              We automatically collect certain information when you use our services:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Service usage patterns and analytics</li>
              <li>Device and browser information</li>
              <li>IP addresses and location data</li>
              <li>Performance metrics and error logs</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Provide, maintain, and improve our AI business automation services</li>
              <li>Process transactions and manage your account</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Analyze usage patterns to improve user experience</li>
              <li>Comply with legal obligations and protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Information Sharing and Disclosure</h2>
            <p className="mb-4">
              We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Service Providers:</strong> We may share information with trusted third-party service providers who assist in operating our platform</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In the event of a merger or acquisition, your information may be transferred to the new entity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Data Security</h2>
            <p className="mb-4">
              We implement comprehensive security measures to protect your personal information:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>End-to-end encryption for all data transmission</li>
              <li>Secure data storage with regular backups</li>
              <li>Access controls and authentication requirements</li>
              <li>Regular security audits and monitoring</li>
              <li>Employee training on data protection practices</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Your Rights and Choices</h2>
            <p className="mb-4">You have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your data in a structured format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="mb-4">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar technologies to enhance your experience with our services. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. International Data Transfers</h2>
            <p className="mb-4">
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Children's Privacy</h2>
            <p className="mb-4">
              Our services are not intended for children under 13. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this privacy policy or our data practices, please contact us:
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4" />
                <span>Email: privacy@prismai.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>Phone: Contact our support team through the dashboard</span>
              </div>
            </div>
          </section>
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Questions about your privacy?</h3>
              <p className="text-muted-foreground mb-4">
                Our privacy team is here to help you understand how we protect your data.
              </p>
              <Button asChild>
                <Link href="mailto:privacy@prismai.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Privacy Team
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}