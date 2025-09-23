import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Scale, AlertTriangle, CheckCircle, Mail, Phone } from 'lucide-react'
import DotGrid from '@/components/DotGrid'

export const metadata: Metadata = {
  title: 'Terms of Service - PrismAI',
  description: 'Read the terms and conditions for using PrismAI services.',
}

export default function TermsPage() {
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
              <Scale className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            These terms govern your use of PrismAI services. By using our platform, you agree to these terms.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last updated: January 2025
          </p>
        </div>

        {/* Quick Overview */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Key Terms at a Glance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Service Agreement</h3>
                <p className="text-sm text-muted-foreground">
                  Clear terms for using our AI business automation platform.
                </p>
              </div>
              <div className="text-center">
                <Scale className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Fair Usage</h3>
                <p className="text-sm text-muted-foreground">
                  Reasonable limits and acceptable use policies.
                </p>
              </div>
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Your Responsibilities</h3>
                <p className="text-sm text-muted-foreground">
                  What we expect from our users and customers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms Content */}
        <div className="prose prose-lg max-w-4xl mx-auto">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing and using PrismAI services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
            <p className="mb-4">
              PrismAI provides an intelligent business automation platform that includes:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>AI-powered customer service and communication tools</li>
              <li>Business process automation and workflow management</li>
              <li>Data analytics and business intelligence</li>
              <li>CRM integration and lead management</li>
              <li>API access and developer tools</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
            <h3 className="text-xl font-semibold mb-3">Account Creation</h3>
            <p className="mb-4">
              To use our services, you must create an account with accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials.
            </p>

            <h3 className="text-xl font-semibold mb-3">Account Responsibilities</h3>
            <p className="mb-4">You agree to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Provide accurate and current information</li>
              <li>Maintain the security of your account</li>
              <li>Notify us immediately of any unauthorized use</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Acceptable Use Policy</h2>
            <p className="mb-4">You agree not to use the service to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit harmful or malicious code</li>
              <li>Harass, abuse, or harm others</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Use the service for spam or unsolicited communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Intellectual Property</h2>
            <h3 className="text-xl font-semibold mb-3">Our Content</h3>
            <p className="mb-4">
              All content, features, and functionality of PrismAI services are owned by PrismAI and are protected by copyright, trademark, and other intellectual property laws.
            </p>

            <h3 className="text-xl font-semibold mb-3">Your Content</h3>
            <p className="mb-4">
              You retain ownership of content you submit to our services. By using our services, you grant us a license to use, store, and process your content as necessary to provide the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Payment Terms</h2>
            <h3 className="text-xl font-semibold mb-3">Subscription Fees</h3>
            <p className="mb-4">
              Subscription fees are billed in advance on a monthly or annual basis. Fees are non-refundable except as expressly stated in our refund policy.
            </p>

            <h3 className="text-xl font-semibold mb-3">Payment Methods</h3>
            <p className="mb-4">
              We accept major credit cards and other payment methods as indicated in our billing interface. You authorize us to charge your chosen payment method for all fees incurred.
            </p>

            <h3 className="text-xl font-semibold mb-3">Late Payments</h3>
            <p className="mb-4">
              Late payments may result in service suspension or termination. We may charge interest on overdue amounts.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Service Availability</h2>
            <h3 className="text-xl font-semibold mb-3">Uptime Guarantee</h3>
            <p className="mb-4">
              We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance may temporarily interrupt service.
            </p>

            <h3 className="text-xl font-semibold mb-3">Service Modifications</h3>
            <p className="mb-4">
              We reserve the right to modify or discontinue services with reasonable notice. We will not be liable for modifications that do not materially affect service quality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Data Privacy</h2>
            <p className="mb-4">
              Your privacy is important to us. Please review our Privacy Policy, which also governs your use of PrismAI services, to understand our practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Termination</h2>
            <h3 className="text-xl font-semibold mb-3">Termination by You</h3>
            <p className="mb-4">
              You may terminate your account at any time. Termination will take effect at the end of your current billing period.
            </p>

            <h3 className="text-xl font-semibold mb-3">Termination by Us</h3>
            <p className="mb-4">
              We may terminate or suspend your account for violations of these terms. We will provide notice and an opportunity to cure where appropriate.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Disclaimers and Limitations</h2>
            <h3 className="text-xl font-semibold mb-3">Service "As Is"</h3>
            <p className="mb-4">
              PrismAI services are provided "as is" without warranties of any kind, either express or implied.
            </p>

            <h3 className="text-xl font-semibold mb-3">Limitation of Liability</h3>
            <p className="mb-4">
              Our liability is limited to the amount paid by you for services in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Indemnification</h2>
            <p className="mb-4">
              You agree to indemnify and hold PrismAI harmless from any claims, damages, or expenses arising from your use of our services or violation of these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Governing Law</h2>
            <p className="mb-4">
              These terms are governed by the laws of [Jurisdiction], without regard to conflict of law principles. Any disputes will be resolved in the courts of [Jurisdiction].
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Changes to Terms</h2>
            <p className="mb-4">
              We may modify these terms at any time. We will notify users of material changes via email or platform notification. Continued use constitutes acceptance of new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">14. Contact Information</h2>
            <p className="mb-4">
              If you have questions about these terms, please contact us:
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4" />
                <span>Email: legal@prismai.com</span>
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
              <h3 className="text-lg font-semibold mb-2">Questions about our terms?</h3>
              <p className="text-muted-foreground mb-4">
                Our legal team is here to help clarify any aspects of our terms of service.
              </p>
              <Button asChild>
                <Link href="mailto:legal@prismai.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Legal Team
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}