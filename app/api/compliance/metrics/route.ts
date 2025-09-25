/**
 * Compliance Metrics API Endpoints
 * Provides comprehensive compliance monitoring data for HIPAA, GDPR, and SOC2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { complianceDashboard } from '@/lib/compliance/metrics-dashboard';
import { privacyMetricsService } from '@/lib/compliance/privacy-metrics';
import { transferMetricsService } from '@/lib/compliance/transfer-metrics';
import { baaMetricsService } from '@/lib/compliance/baa-metrics';
import { breachMetricsService } from '@/lib/compliance/breach-metrics';
import { logger } from '@/lib/logger';

// GET /api/compliance/metrics - Get comprehensive compliance dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const type = searchParams.get('type'); // 'dashboard', 'privacy', 'transfers', 'baa', 'breach'
    const includeAlerts = searchParams.get('includeAlerts') === 'true';

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let response: any = {};

    switch (type) {
      case 'dashboard':
        response = await complianceDashboard.getDashboardMetrics(tenantId || undefined);
        break;

      case 'privacy':
        response = await privacyMetricsService.getPrivacyMetrics(tenantId || undefined);
        if (includeAlerts) {
          response.alerts = await privacyMetricsService.getPrivacyAlerts(tenantId || undefined);
        }
        break;

      case 'transfers':
        response = await transferMetricsService.getTransferMetrics(tenantId || undefined);
        if (includeAlerts) {
          response.alerts = await transferMetricsService.getTransferAlerts(tenantId || undefined);
        }
        break;

      case 'baa':
        response = await baaMetricsService.getBAAMetrics(tenantId || undefined);
        if (includeAlerts) {
          response.alerts = await baaMetricsService.getBAAAlerts(tenantId || undefined);
        }
        break;

      case 'breach':
        response = await breachMetricsService.getBreachMetrics(tenantId || undefined);
        if (includeAlerts) {
          response.alerts = await breachMetricsService.getBreachAlerts(tenantId || undefined);
        }
        break;

      default:
        // Return comprehensive dashboard by default
        response = await complianceDashboard.getDashboardMetrics(tenantId || undefined);
    }

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching compliance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance metrics' },
      { status: 500 }
    );
  }
}

// POST /api/compliance/metrics/alerts - Get all compliance alerts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, frameworks } = body;

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const allAlerts: any[] = [];

    // Get alerts from all services
    const alertPromises = [
      complianceDashboard.getActiveAlerts(tenantId),
      privacyMetricsService.getPrivacyAlerts(tenantId),
      transferMetricsService.getTransferAlerts(tenantId),
      baaMetricsService.getBAAAlerts(tenantId),
      breachMetricsService.getBreachAlerts(tenantId)
    ];

    const [dashboardAlerts, privacyAlerts, transferAlerts, baaAlerts, breachAlerts] = await Promise.all(alertPromises);

    allAlerts.push(
      ...dashboardAlerts.map(alert => ({ ...alert, source: 'dashboard' })),
      ...privacyAlerts.map(alert => ({ ...alert, source: 'privacy' })),
      ...transferAlerts.map(alert => ({ ...alert, source: 'transfers' })),
      ...baaAlerts.map(alert => ({ ...alert, source: 'baa' })),
      ...breachAlerts.map(alert => ({ ...alert, source: 'breach' }))
    );

    // Filter by frameworks if specified
    let filteredAlerts = allAlerts;
    if (frameworks && frameworks.length > 0) {
      filteredAlerts = allAlerts.filter(alert =>
        frameworks.includes(alert.framework)
      );
    }

    // Sort by severity and creation date
    filteredAlerts.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      data: {
        alerts: filteredAlerts,
        summary: {
          total: filteredAlerts.length,
          critical: filteredAlerts.filter(a => a.severity === 'critical').length,
          high: filteredAlerts.filter(a => a.severity === 'high').length,
          medium: filteredAlerts.filter(a => a.severity === 'medium').length,
          low: filteredAlerts.filter(a => a.severity === 'low').length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching compliance alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance alerts' },
      { status: 500 }
    );
  }
}

// PUT /api/compliance/metrics/alerts/{id}/resolve - Resolve a specific alert
export async function PUT(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const alertId = pathname.split('/').pop();

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { resolution, resolvedBy } = body;

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // In a real implementation, you would update the alert in the database
    // For now, return success response
    logger.info(`Alert ${alertId} resolved by ${resolvedBy}: ${resolution}`);

    return NextResponse.json({
      success: true,
      data: {
        alertId,
        resolvedAt: new Date().toISOString(),
        resolvedBy,
        resolution
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error resolving compliance alert:', error);
    return NextResponse.json(
      { error: 'Failed to resolve compliance alert' },
      { status: 500 }
    );
  }
}

// GET /api/compliance/metrics/trends - Get historical compliance trends
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const days = parseInt(searchParams.get('days') || '30');

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get trends from all services
    const dashboardMetrics = await complianceDashboard.getDashboardMetrics(tenantId || undefined);

    // Generate historical data (in a real implementation, this would come from a database)
    const trends = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date: date.toISOString().split('T')[0],
        hipaaScore: Math.max(70, dashboardMetrics.frameworkScores.find(s => s.framework === 'HIPAA')?.score || 85 + Math.random() * 10),
        gdprScore: Math.max(70, dashboardMetrics.frameworkScores.find(s => s.framework === 'GDPR')?.score || 82 + Math.random() * 12),
        soc2Score: Math.max(70, dashboardMetrics.frameworkScores.find(s => s.framework === 'SOC2')?.score || 88 + Math.random() * 8),
        overallScore: Math.max(70, dashboardMetrics.overallScore + Math.random() * 10 - 5)
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        trends,
        summary: {
          currentOverall: dashboardMetrics.overallScore,
          averageOverall: trends.reduce((sum, t) => sum + t.overallScore, 0) / trends.length,
          improvement: trends[trends.length - 1].overallScore - trends[0].overallScore
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching compliance trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance trends' },
      { status: 500 }
    );
  }
}

// GET /api/compliance/metrics/reports - Generate compliance reports
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const reportType = searchParams.get('type') || 'comprehensive';
    const format = searchParams.get('format') || 'json';

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate report based on type
    let reportData: any = {};

    switch (reportType) {
      case 'comprehensive':
        reportData = await complianceDashboard.getDashboardMetrics(tenantId || undefined);
        break;
      case 'privacy':
        reportData = await privacyMetricsService.getPrivacyMetrics(tenantId || undefined);
        break;
      case 'transfers':
        reportData = await transferMetricsService.getTransferMetrics(tenantId || undefined);
        break;
      case 'baa':
        reportData = await baaMetricsService.getBAAMetrics(tenantId || undefined);
        break;
      case 'breach':
        reportData = await breachMetricsService.getBreachMetrics(tenantId || undefined);
        break;
      default:
        reportData = await complianceDashboard.getDashboardMetrics(tenantId || undefined);
    }

    // Format response based on requested format
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: {
          reportType,
          generatedAt: new Date().toISOString(),
          generatedBy: user.email,
          ...reportData
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // For other formats, return JSON structure that can be processed by frontend
      return NextResponse.json({
        success: true,
        data: {
          reportType,
          format,
          generatedAt: new Date().toISOString(),
          generatedBy: user.email,
          content: reportData
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error generating compliance report:', error);
    return NextResponse.json(
      { error: 'Failed to generate compliance report' },
      { status: 500 }
    );
  }
}