import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Lock, Eye, Server, Key, AlertTriangle, CheckCircle, Zap, Database, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security - PrismAI',
  description: 'Learn about PrismAI\'s comprehensive security measures and compliance standards.',
}

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Security at PrismAI</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Enterprise-grade security designed to protect your business data and ensure compliance with industry standards.
          </p>
        </div>

        {/* Security Overview */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">SOC 2 Type II</h3>
                <p className="text-sm text-muted-foreground">
                  Compliant security controls and processes
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Database className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">End-to-End Encryption</h3>
                <p className="text-sm text-muted-foreground">
                  Data encrypted in transit and at rest
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Eye className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">99.9% Uptime</h3>
                <p className="text-sm text-muted-foreground">
                  Reliable service with continuous monitoring
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-2">GDPR Ready</h3>
                <p className="text-sm text-muted-foreground">
                  Privacy-compliant data handling
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <Lock className="h-5 w-5 text-cyan-600" />
                </div>
                <CardTitle className="text-lg">Data Encryption</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                All data is encrypted using AES-256 encryption standards, both in transit and at rest.
              </p>
              <Badge variant="secondary">AES-256</Badge>
              <Badge variant="secondary" className="ml-2">TLS 1.3</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Server className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle className="text-lg">Infrastructure Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Hosted on enterprise-grade cloud infrastructure with automated security updates.
              </p>
              <Badge variant="secondary">AWS</Badge>
              <Badge variant="secondary" className="ml-2">Auto-scaling</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Key className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Access Control</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Multi-factor authentication and role-based access control for all users.
              </p>
              <Badge variant="secondary">MFA</Badge>
              <Badge variant="secondary" className="ml-2">RBAC</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Eye className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle className="text-lg">Monitoring & Logging</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                24/7 security monitoring with automated threat detection and response.
              </p>
              <Badge variant="secondary">24/7 Monitoring</Badge>
              <Badge variant="secondary" className="ml-2">SIEM</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <CardTitle className="text-lg">Incident Response</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Comprehensive incident response plan with dedicated security team.
              </p>
              <Badge variant="secondary">IR Plan</Badge>
              <Badge variant="secondary" className="ml-2">24h Response</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Compliance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Regular audits and compliance with industry standards and regulations.
              </p>
              <Badge variant="secondary">SOC 2</Badge>
              <Badge variant="secondary" className="ml-2">GDPR</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Security Details */}
        <div className="prose prose-lg max-w-4xl mx-auto mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Security Measures</h2>

          <section className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Network Security</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Distributed Denial of Service (DDoS) protection</li>
              <li>Web Application Firewall (WAF) with real-time threat detection</li>
              <li>Network segmentation and zero-trust architecture</li>
              <li>Regular vulnerability scanning and penetration testing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Data Protection</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>AES-256 encryption for all stored data</li>
              <li>TLS 1.3 encryption for all data in transit</li>
              <li>Secure key management with hardware security modules</li>
              <li>Regular data backups with encryption</li>
            </ul>
          </section>

          <section className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Access Management</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Multi-factor authentication (MFA) required for all accounts</li>
              <li>Role-based access control (RBAC) with least privilege principle</li>
              <li>Single sign-on (SSO) integration available</li>
              <li>Automated account deactivation for inactive users</li>
            </ul>
          </section>

          <section className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Compliance & Certifications</h3>
            <div className="grid md:grid-cols-2 gap-6 mb-4">
              <div>
                <h4 className="font-semibold mb-2">SOC 2 Type II</h4>
                <p className="text-muted-foreground text-sm">
                  Independent audit of our security controls and processes, ensuring trust and compliance.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">GDPR Compliance</h4>
                <p className="text-muted-foreground text-sm">
                  Full compliance with EU General Data Protection Regulation for data privacy.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">HIPAA Ready</h4>
                <p className="text-muted-foreground text-sm">
                  Healthcare data protection standards available for medical organizations.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">ISO 27001</h4>
                <p className="text-muted-foreground text-sm">
                  International standard for information security management systems.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Security Updates</h3>
            <p className="mb-4">
              We maintain a comprehensive security update process:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Automated security patching for all systems</li>
              <li>Regular security assessments and audits</li>
              <li>Immediate response to newly discovered vulnerabilities</li>
              <li>Transparent communication about security incidents</li>
            </ul>
          </section>
        </div>

        {/* Trust Badges */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-center">Trusted by Industry Leaders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                  <Shield className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-sm font-medium">SOC 2 Certified</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <Lock className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-sm font-medium">GDPR Compliant</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm font-medium">HIPAA Ready</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                  <Database className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-sm font-medium">99.9% Uptime</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact CTA */}
        <div className="text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Security Questions?</h3>
              <p className="text-muted-foreground mb-4">
                Our security team is available to answer your questions and discuss your specific requirements.
              </p>
              <Button asChild>
                <Link href="mailto:security@prismai.com">
                  <Shield className="mr-2 h-4 w-4" />
                  Contact Security Team
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}