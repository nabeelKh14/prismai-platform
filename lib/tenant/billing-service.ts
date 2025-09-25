import { createClient } from '@/lib/supabase/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { logger } from '@/lib/logger'
import { ValidationError, AuthorizationError } from '@/lib/errors'

// Usage metrics
export type UsageMetric =
  | 'ai_calls'
  | 'chat_messages'
  | 'leads_generated'
  | 'emails_sent'
  | 'storage_mb'
  | 'api_requests'
  | 'knowledge_base_entries'
  | 'integrations_used'

// Billing tiers
export interface BillingTier {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  limits: Record<UsageMetric, number>
  features: string[]
}

// Usage record
export interface UsageRecord {
  id: string
  tenant_id: string
  metric: UsageMetric
  value: number
  period_start: string
  period_end: string
  recorded_at: string
  metadata?: Record<string, any>
}

// Billing invoice
export interface BillingInvoice {
  id: string
  tenant_id: string
  period_start: string
  period_end: string
  subtotal: number
  tax_amount: number
  total_amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  due_date: string
  paid_at?: string
  invoice_number: string
  line_items: BillingLineItem[]
}

// Invoice line item
export interface BillingLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  metadata?: Record<string, any>
}

export class BillingService {
  private async getSupabase() {
    return await createClient()
  }

  /**
   * Record usage for a tenant
   */
  async recordUsage(
    tenantId: string,
    metric: UsageMetric,
    value: number,
    metadata?: Record<string, any>
  ): Promise<UsageRecord> {
    const supabase = await this.getSupabase()

    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const { data: usageRecord, error } = await supabase
      .from('tenant_usage')
      .insert({
        tenant_id: tenantId,
        metric_name: metric,
        metric_value: value,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        metadata,
      })
      .select()
      .single()

    if (error) throw error

    logger.info('Usage recorded', { tenantId, metric, value })

    return usageRecord
  }

  /**
   * Get usage for a tenant in a specific period
   */
  async getTenantUsage(
    tenantId: string,
    userId: string,
    period?: { start: string; end: string }
  ): Promise<Record<UsageMetric, number>> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    let query = supabase
      .from('tenant_usage')
      .select('metric_name, metric_value')
      .eq('tenant_id', tenantId)

    if (period) {
      query = query
        .gte('period_start', period.start)
        .lte('period_end', period.end)
    } else {
      // Default to current month
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      query = query
        .gte('period_start', periodStart.toISOString().split('T')[0])
        .lte('period_end', periodEnd.toISOString().split('T')[0])
    }

    const { data: usageRecords, error } = await query

    if (error) throw error

    // Aggregate usage by metric
    const usage = (usageRecords || []).reduce((acc, record) => {
      const metric = record.metric_name as UsageMetric
      acc[metric] = (acc[metric] || 0) + record.metric_value
      return acc
    }, {} as Record<UsageMetric, number>)

    return usage
  }

  /**
   * Check if tenant is within usage limits
   */
  async checkUsageLimits(
    tenantId: string,
    metric: UsageMetric,
    additionalUsage: number = 0
  ): Promise<{
    currentUsage: number
    limit: number
    remaining: number
    isWithinLimit: boolean
  }> {
    const supabase = await this.getSupabase()

    // Get current usage
    const currentUsage = await this.getCurrentUsage(tenantId, metric)

    // Get tenant's billing tier limits
    const { data: subscription } = await supabase
      .from('tenant_subscriptions')
      .select(`
        plan:subscription_plans(limits)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single()

    const limit = (subscription?.plan as any)?.limits?.[metric] || 0
    const totalUsage = currentUsage + additionalUsage
    const remaining = Math.max(0, limit - totalUsage)
    const isWithinLimit = totalUsage <= limit

    return {
      currentUsage,
      limit,
      remaining,
      isWithinLimit,
    }
  }

  /**
   * Enforce usage limits
   */
  async enforceUsageLimit(
    tenantId: string,
    metric: UsageMetric,
    requestedUsage: number = 1
  ): Promise<void> {
    const limits = await this.checkUsageLimits(tenantId, metric, requestedUsage)

    if (!limits.isWithinLimit) {
      throw new ValidationError(
        `Usage limit exceeded for ${metric}. Current: ${limits.currentUsage}, Limit: ${limits.limit}, Requested: ${requestedUsage}`
      )
    }
  }

  /**
   * Generate invoice for a tenant
   */
  async generateInvoice(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
    userId: string
  ): Promise<BillingInvoice> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:manage_billing')

    const supabase = await this.getSupabase()

    // Get tenant subscription
    const { data: subscription } = await supabase
      .from('tenant_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single()

    if (!subscription) {
      throw new ValidationError('No active subscription found')
    }

    // Get usage for the period
    const usage = await this.getTenantUsage(tenantId, userId, { start: periodStart, end: periodEnd })

    // Calculate line items
    const lineItems: Omit<BillingLineItem, 'id'>[] = []

    // Base subscription
    lineItems.push({
      description: `${subscription.plan.name} Subscription`,
      quantity: 1,
      unit_price: subscription.plan.price_monthly,
      amount: subscription.plan.price_monthly,
      metadata: { type: 'subscription' },
    })

    // Overage charges
    for (const [metric, value] of Object.entries(usage)) {
      const limit = subscription.plan.limits[metric as UsageMetric] || 0
      if (value > limit) {
        const overage = value - limit
        const overageRate = this.getOverageRate(metric as UsageMetric)
        lineItems.push({
          description: `${metric} overage (${overage} units)`,
          quantity: overage,
          unit_price: overageRate,
          amount: overage * overageRate,
          metadata: { type: 'overage', metric, limit, used: value },
        })
      }
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = 0.1 // 10% tax
    const taxAmount = subtotal * taxRate
    const totalAmount = subtotal + taxAmount

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber()

    const { data: invoice, error } = await supabase
      .from('billing_invoices')
      .insert({
        tenant_id: tenantId,
        period_start: periodStart,
        period_end: periodEnd,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        status: 'draft',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        invoice_number: invoiceNumber,
      })
      .select()
      .single()

    if (error) throw error

    // Insert line items
    const invoiceLineItems = lineItems.map(item => ({
      ...item,
      invoice_id: invoice.id,
    }))

    await supabase
      .from('billing_invoice_items')
      .insert(invoiceLineItems)

    logger.info('Invoice generated', { tenantId, invoiceId: invoice.id, totalAmount })

    return {
      ...invoice,
      line_items: invoiceLineItems.map((item, index) => ({ ...item, id: `temp_${index}` })),
    } as BillingInvoice
  }

  /**
   * Get invoices for a tenant
   */
  async getTenantInvoices(
    tenantId: string,
    userId: string,
    status?: string
  ): Promise<BillingInvoice[]> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:view_billing')

    const supabase = await this.getSupabase()

    let query = supabase
      .from('billing_invoices')
      .select(`
        *,
        line_items:billing_invoice_items(*)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: invoices, error } = await query

    if (error) throw error

    return (invoices || []).map(invoice => ({
      ...invoice,
      line_items: invoice.line_items || [],
    })) as BillingInvoice[]
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    tenantId: string,
    planId: string,
    userId: string
  ): Promise<void> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:manage_billing')

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('tenant_subscriptions')
      .update({
        plan_id: planId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (error) throw error

    logger.info('Subscription updated', { tenantId, planId, userId })
  }

  /**
   * Get billing tiers
   */
  async getBillingTiers(): Promise<BillingTier[]> {
    const supabase = await this.getSupabase()

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly')

    if (error) throw error

    return (plans || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      limits: plan.limits,
      features: plan.features,
    }))
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(
    tenantId: string,
    userId: string,
    months: number = 6
  ): Promise<{
    currentUsage: Record<UsageMetric, number>
    historicalUsage: Array<{
      period: string
      usage: Record<UsageMetric, number>
    }>
    limits: Record<UsageMetric, number>
    alerts: Array<{
      metric: UsageMetric
      current: number
      limit: number
      percentage: number
    }>
  }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    // Get current usage
    const currentUsage = await this.getTenantUsage(tenantId, userId)

    // Get historical usage
    const historicalUsage = []
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const periodStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

      const usage = await this.getTenantUsage(tenantId, userId, {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      })

      historicalUsage.push({
        period: periodStart.toISOString().slice(0, 7), // YYYY-MM format
        usage,
      })
    }

    // Get limits
    const { data: subscription } = await supabase
      .from('tenant_subscriptions')
      .select('plan:subscription_plans(limits)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single()

    const limits = (subscription?.plan as any)?.limits || {}

    // Generate alerts
    const alerts = Object.entries(currentUsage)
      .map(([metric, current]) => {
        const limit = limits[metric as UsageMetric] || 0
        if (limit === 0) return null

        const percentage = (current / limit) * 100
        if (percentage >= 80) { // Alert when usage is 80% or more
          return {
            metric: metric as UsageMetric,
            current,
            limit,
            percentage,
          }
        }
        return null
      })
      .filter(Boolean) as Array<{
        metric: UsageMetric
        current: number
        limit: number
        percentage: number
      }>

    return {
      currentUsage,
      historicalUsage,
      limits,
      alerts,
    }
  }

  // =====================================
  // PRIVATE HELPERS
  // =====================================

  private async getCurrentUsage(tenantId: string, metric: UsageMetric): Promise<number> {
    const supabase = await this.getSupabase()

    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const { data: records, error } = await supabase
      .from('tenant_usage')
      .select('metric_value')
      .eq('tenant_id', tenantId)
      .eq('metric_name', metric)
      .gte('period_start', periodStart.toISOString().split('T')[0])
      .lte('period_end', periodEnd.toISOString().split('T')[0])

    if (error) throw error

    return (records || []).reduce((sum, record) => sum + record.metric_value, 0)
  }

  private getOverageRate(metric: UsageMetric): number {
    const rates: Record<UsageMetric, number> = {
      ai_calls: 0.10,
      chat_messages: 0.01,
      leads_generated: 0.50,
      emails_sent: 0.02,
      storage_mb: 0.10,
      api_requests: 0.001,
      knowledge_base_entries: 0.20,
      integrations_used: 1.00,
    }

    return rates[metric] || 0.10
  }

  private async generateInvoiceNumber(): Promise<string> {
    const supabase = await this.getSupabase()

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    // Get count of invoices this month
    const { count, error } = await supabase
      .from('billing_invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(year, now.getMonth(), 1).toISOString())
      .lt('created_at', new Date(year, now.getMonth() + 1, 1).toISOString())

    if (error) throw error

    const sequence = String((count || 0) + 1).padStart(4, '0')
    return `INV-${year}${month}-${sequence}`
  }
}

// Export singleton instance
export const billingService = new BillingService()