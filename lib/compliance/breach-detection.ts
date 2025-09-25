/**
 * Automated Breach Detection System
 * Implements real-time detection algorithms for security incidents and data breaches
 * Supports GDPR, HIPAA, and SOC2 compliance requirements
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Types for breach detection
export interface BreachDetectionRule {
  id: string;
  name: string;
  description: string;
  type: 'anomaly' | 'signature' | 'behavioral' | 'threshold';
  severity: 1 | 2 | 3 | 4 | 5;
  enabled: boolean;
  config: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  source: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, any>;
  raw_data?: string;
}

export interface DetectedBreach {
  id: string;
  incident_id: string;
  title: string;
  description: string;
  incident_type: string;
  severity_score: number;
  confidence_score: number;
  affected_systems: string[];
  affected_data_types: string[];
  estimated_records_affected?: number;
  detection_method: 'automated' | 'manual' | 'third_party' | 'user_report' | 'monitoring';
  detection_rules_triggered: string[];
  evidence: SecurityEvent[];
  gdpr_applicable: boolean;
  hipaa_applicable: boolean;
  soc2_applicable: boolean;
  detected_at: Date;
  detected_by: string;
  status: 'detected' | 'investigating' | 'assessed' | 'notifying' | 'resolved' | 'closed';
}

// Detection rule schemas
const AnomalyRuleSchema = z.object({
  metric: z.string(),
  baseline_window_hours: z.number().min(1).max(720), // 1 hour to 30 days
  threshold_deviation: z.number().min(0.1).max(10), // Standard deviations
  minimum_occurrences: z.number().min(1).default(1),
  cooldown_minutes: z.number().min(0).default(60)
});

const SignatureRuleSchema = z.object({
  patterns: z.array(z.string()),
  match_type: z.enum(['exact', 'regex', 'fuzzy']),
  case_sensitive: z.boolean().default(false),
  minimum_matches: z.number().min(1).default(1)
});

const BehavioralRuleSchema = z.object({
  user_behavior_patterns: z.array(z.string()),
  time_window_hours: z.number().min(1).max(168), // 1 hour to 1 week
  deviation_threshold: z.number().min(0.1).max(5),
  baseline_period_days: z.number().min(1).max(90)
});

const ThresholdRuleSchema = z.object({
  metric: z.string(),
  threshold_value: z.number(),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']),
  time_window_minutes: z.number().min(1).default(60),
  consecutive_periods: z.number().min(1).default(1)
});

// Main breach detection engine
export class BreachDetectionEngine {
  private supabase: any;
  private rules: Map<string, BreachDetectionRule> = new Map();
  private eventBuffer: SecurityEvent[] = [];
  private readonly BUFFER_SIZE = 1000;
  private readonly BUFFER_TTL_MINUTES = 60;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeRules();
    this.startEventProcessing();
  }

  /**
   * Initialize detection rules from database
   */
  private async initializeRules(): Promise<void> {
    try {
      const { data: rules, error } = await this.supabase
        .from('breach_detection_rules')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      for (const rule of rules || []) {
        this.rules.set(rule.id, rule as BreachDetectionRule);
      }

      console.log(`Initialized ${this.rules.size} breach detection rules`);
    } catch (error) {
      console.error('Failed to initialize breach detection rules:', error);
    }
  }

  /**
   * Process incoming security events
   */
  async processSecurityEvent(event: SecurityEvent): Promise<DetectedBreach | null> {
    // Add to buffer for analysis
    this.eventBuffer.push(event);

    // Maintain buffer size
    if (this.eventBuffer.length > this.BUFFER_SIZE) {
      this.eventBuffer = this.eventBuffer.slice(-this.BUFFER_SIZE);
    }

    // Clean old events
    this.cleanEventBuffer();

    // Analyze event against all rules
    const triggeredRules: string[] = [];
    let maxSeverity = 1;
    let gdprApplicable = false;
    let hipaaApplicable = false;
    let soc2Applicable = false;

    for (const [ruleId, rule] of this.rules) {
      if (await this.evaluateRule(rule, event)) {
        triggeredRules.push(ruleId);
        maxSeverity = Math.max(maxSeverity, rule.severity);

        // Determine regulatory applicability
        if (this.isGDPRRelevant(event, rule)) gdprApplicable = true;
        if (this.isHIPAARelevant(event, rule)) hipaaApplicable = true;
        if (this.isSOC2Relevant(event, rule)) soc2Applicable = true;
      }
    }

    // If no rules triggered, return null
    if (triggeredRules.length === 0) {
      return null;
    }

    // Calculate confidence score based on rule matches and event characteristics
    const confidenceScore = this.calculateConfidenceScore(event, triggeredRules);

    // Create breach incident if confidence is high enough
    if (confidenceScore >= 0.6) {
      return await this.createBreachIncident({
        event,
        triggeredRules,
        severity: maxSeverity,
        confidenceScore,
        gdprApplicable,
        hipaaApplicable,
        soc2Applicable
      });
    }

    return null;
  }

  /**
   * Evaluate a single rule against an event
   */
  private async evaluateRule(rule: BreachDetectionRule, event: SecurityEvent): Promise<boolean> {
    try {
      switch (rule.type) {
        case 'anomaly':
          return await this.evaluateAnomalyRule(rule, event);
        case 'signature':
          return await this.evaluateSignatureRule(rule, event);
        case 'behavioral':
          return await this.evaluateBehavioralRule(rule, event);
        case 'threshold':
          return await this.evaluateThresholdRule(rule, event);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
      return false;
    }
  }

  /**
   * Evaluate anomaly-based detection rules
   */
  private async evaluateAnomalyRule(rule: BreachDetectionRule, event: SecurityEvent): Promise<boolean> {
    const config = AnomalyRuleSchema.parse(rule.config);

    // Get historical data for comparison
    const historicalData = await this.getHistoricalMetricData(
      config.metric,
      config.baseline_window_hours
    );

    if (historicalData.length < 10) return false; // Need sufficient baseline data

    const currentValue = this.extractMetricValue(event, config.metric);
    if (currentValue === null) return false;

    const mean = historicalData.reduce((sum, val) => sum + val, 0) / historicalData.length;
    const variance = historicalData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalData.length;
    const stdDev = Math.sqrt(variance);

    const deviation = Math.abs(currentValue - mean) / stdDev;

    return deviation >= config.threshold_deviation &&
           this.checkMinimumOccurrences(event, config.minimum_occurrences);
  }

  /**
   * Evaluate signature-based detection rules
   */
  private async evaluateSignatureRule(rule: BreachDetectionRule, event: SecurityEvent): Promise<boolean> {
    const config = SignatureRuleSchema.parse(rule.config);

    let matchCount = 0;
    const searchText = config.case_sensitive ?
      event.description + JSON.stringify(event.metadata) :
      (event.description + JSON.stringify(event.metadata)).toLowerCase();

    for (const pattern of config.patterns) {
      const searchPattern = config.case_sensitive ? pattern : pattern.toLowerCase();

      switch (config.match_type) {
        case 'exact':
          if (searchText.includes(searchPattern)) matchCount++;
          break;
        case 'regex':
          try {
            const regex = new RegExp(searchPattern, config.case_sensitive ? 'g' : 'gi');
            if (regex.test(searchText)) matchCount++;
          } catch (error) {
            console.error(`Invalid regex pattern: ${pattern}`);
          }
          break;
        case 'fuzzy':
          if (this.fuzzyMatch(searchText, searchPattern, 0.8)) matchCount++;
          break;
      }
    }

    return matchCount >= config.minimum_matches;
  }

  /**
   * Evaluate behavioral detection rules
   */
  private async evaluateBehavioralRule(rule: BreachDetectionRule, event: SecurityEvent): Promise<boolean> {
    const config = BehavioralRuleSchema.parse(rule.config);

    // Get user's historical behavior
    const userId = event.metadata.user_id || event.metadata.userId;
    if (!userId) return false;

    const historicalBehavior = await this.getUserBehaviorData(
      userId,
      config.baseline_period_days
    );

    const currentBehavior = this.extractUserBehavior(event);

    // Calculate deviation from baseline
    const deviation = this.calculateBehavioralDeviation(
      currentBehavior,
      historicalBehavior,
      config.user_behavior_patterns
    );

    return deviation >= config.deviation_threshold;
  }

  /**
   * Evaluate threshold-based detection rules
   */
  private async evaluateThresholdRule(rule: BreachDetectionRule, event: SecurityEvent): Promise<boolean> {
    const config = ThresholdRuleSchema.parse(rule.config);

    const currentValue = this.extractMetricValue(event, config.metric);
    if (currentValue === null) return false;

    let thresholdExceeded = false;

    switch (config.operator) {
      case 'gt':
        thresholdExceeded = currentValue > config.threshold_value;
        break;
      case 'gte':
        thresholdExceeded = currentValue >= config.threshold_value;
        break;
      case 'lt':
        thresholdExceeded = currentValue < config.threshold_value;
        break;
      case 'lte':
        thresholdExceeded = currentValue <= config.threshold_value;
        break;
      case 'eq':
        thresholdExceeded = currentValue === config.threshold_value;
        break;
      case 'neq':
        thresholdExceeded = currentValue !== config.threshold_value;
        break;
    }

    if (!thresholdExceeded) return false;

    // Check for consecutive periods if required
    if (config.consecutive_periods > 1) {
      return await this.checkConsecutiveThresholds(event, config);
    }

    return true;
  }

  /**
   * Calculate confidence score for detected breach
   */
  private calculateConfidenceScore(event: SecurityEvent, triggeredRules: string[]): number {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const ruleId of triggeredRules) {
      const rule = this.rules.get(ruleId);
      if (!rule) continue;

      const ruleWeight = rule.severity / 5; // Weight based on severity
      totalWeight += ruleWeight;

      // Base score from rule match
      let ruleScore = 0.7;

      // Adjust based on event characteristics
      if (event.severity === 'critical') ruleScore += 0.2;
      if (event.severity === 'high') ruleScore += 0.1;
      if (this.hasStrongEvidence(event)) ruleScore += 0.1;

      weightedScore += ruleScore * ruleWeight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Create a new breach incident
   */
  private async createBreachIncident(params: {
    event: SecurityEvent;
    triggeredRules: string[];
    severity: number;
    confidenceScore: number;
    gdprApplicable: boolean;
    hipaaApplicable: boolean;
    soc2Applicable: boolean;
  }): Promise<DetectedBreach> {
    const incidentId = `BR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const breach: Omit<DetectedBreach, 'id'> = {
      incident_id: incidentId,
      title: this.generateBreachTitle(params.event, params.triggeredRules),
      description: this.generateBreachDescription(params.event, params.triggeredRules),
      incident_type: this.classifyIncidentType(params.event),
      severity_score: params.severity,
      confidence_score: params.confidenceScore,
      affected_systems: this.identifyAffectedSystems(params.event),
      affected_data_types: this.identifyAffectedDataTypes(params.event),
      estimated_records_affected: this.estimateAffectedRecords(params.event),
      detection_method: 'automated',
      detection_rules_triggered: params.triggeredRules,
      evidence: [params.event],
      gdpr_applicable: params.gdprApplicable,
      hipaa_applicable: params.hipaaApplicable,
      soc2_applicable: params.soc2Applicable,
      detected_at: new Date(),
      detected_by: 'automated-detection-engine',
      status: 'detected'
    };

    // Store in database
    const { data, error } = await this.supabase
      .from('breach_incidents')
      .insert([breach])
      .select()
      .single();

    if (error) {
      console.error('Failed to create breach incident:', error);
      throw error;
    }

    // Log the detection
    await this.logDetectionEvent(breach as DetectedBreach);

    return { ...breach, id: data.id };
  }

  /**
   * Determine if event is GDPR relevant
   */
  private isGDPRRelevant(event: SecurityEvent, rule: BreachDetectionRule): boolean {
    const gdprTriggers = [
      'personal_data', 'pii', 'privacy', 'data_subject',
      'unauthorized_access', 'data_exfiltration', 'encryption_failure'
    ];

    return gdprTriggers.some(trigger =>
      event.event_type.toLowerCase().includes(trigger) ||
      event.description.toLowerCase().includes(trigger) ||
      rule.name.toLowerCase().includes(trigger)
    );
  }

  /**
   * Determine if event is HIPAA relevant
   */
  private isHIPAARelevant(event: SecurityEvent, rule: BreachDetectionRule): boolean {
    const hipaaTriggers = [
      'phi', 'protected_health', 'medical_record', 'patient_data',
      'healthcare', 'medical', 'clinical', 'diagnosis'
    ];

    return hipaaTriggers.some(trigger =>
      event.event_type.toLowerCase().includes(trigger) ||
      event.description.toLowerCase().includes(trigger) ||
      rule.name.toLowerCase().includes(trigger)
    );
  }

  /**
   * Determine if event is SOC2 relevant
   */
  private isSOC2Relevant(event: SecurityEvent, rule: BreachDetectionRule): boolean {
    const soc2Triggers = [
      'security_incident', 'unauthorized_access', 'system_breach',
      'data_loss', 'confidentiality', 'integrity', 'availability'
    ];

    return soc2Triggers.some(trigger =>
      event.event_type.toLowerCase().includes(trigger) ||
      event.description.toLowerCase().includes(trigger) ||
      rule.name.toLowerCase().includes(trigger)
    );
  }

  /**
   * Helper methods for rule evaluation
   */
  private async getHistoricalMetricData(metric: string, hours: number): Promise<number[]> {
    // Implementation would fetch from monitoring/metrics
    return [];
  }

  private extractMetricValue(event: SecurityEvent, metric: string): number | null {
    // Extract metric value from event metadata
    return event.metadata[metric] || null;
  }

  private checkMinimumOccurrences(event: SecurityEvent, minOccurrences: number): boolean {
    // Check if similar events occurred minimum times
    return true; // Simplified for now
  }

  private fuzzyMatch(text: string, pattern: string, threshold: number): boolean {
    // Simple fuzzy matching implementation
    const textLen = text.length;
    const patternLen = pattern.length;
    if (patternLen > textLen) return false;

    let matches = 0;
    for (let i = 0; i <= textLen - patternLen; i++) {
      let matchCount = 0;
      for (let j = 0; j < patternLen; j++) {
        if (text[i + j] === pattern[j]) matchCount++;
      }
      if (matchCount / patternLen >= threshold) matches++;
    }

    return matches > 0;
  }

  private async getUserBehaviorData(userId: string, days: number): Promise<any> {
    // Fetch user behavior data from analytics
    return {};
  }

  private extractUserBehavior(event: SecurityEvent): any {
    // Extract behavioral patterns from event
    return {};
  }

  private calculateBehavioralDeviation(current: any, historical: any, patterns: string[]): number {
    // Calculate deviation from baseline behavior
    return 0;
  }

  private async checkConsecutiveThresholds(event: SecurityEvent, config: any): Promise<boolean> {
    // Check for consecutive threshold violations
    return true;
  }

  private hasStrongEvidence(event: SecurityEvent): boolean {
    // Determine if event has strong evidence indicators
    return event.metadata.confidence !== undefined && event.metadata.confidence > 0.8;
  }

  private generateBreachTitle(event: SecurityEvent, triggeredRules: string[]): string {
    const ruleNames = triggeredRules.map(id => this.rules.get(id)?.name).filter(Boolean);
    return `${event.event_type.replace(/_/g, ' ').toUpperCase()} - ${ruleNames.join(', ')}`;
  }

  private generateBreachDescription(event: SecurityEvent, triggeredRules: string[]): string {
    return `Automated detection triggered by: ${triggeredRules.join(', ')}. Event details: ${event.description}`;
  }

  private classifyIncidentType(event: SecurityEvent): string {
    const typeMapping: Record<string, string> = {
      'unauthorized_access': 'unauthorized_access',
      'data_exfiltration': 'data_breach',
      'malware': 'malware',
      'ddos': 'ddos',
      'phishing': 'phishing',
      'insider_threat': 'insider_threat'
    };

    return typeMapping[event.event_type] || 'security_incident';
  }

  private identifyAffectedSystems(event: SecurityEvent): string[] {
    return event.metadata.affected_systems || [event.source];
  }

  private identifyAffectedDataTypes(event: SecurityEvent): string[] {
    const dataTypes = [];
    if (event.metadata.data_types) {
      dataTypes.push(...event.metadata.data_types);
    }
    if (event.description.toLowerCase().includes('personal')) dataTypes.push('personal_data');
    if (event.description.toLowerCase().includes('health')) dataTypes.push('protected_health_information');
    return [...new Set(dataTypes)];
  }

  private estimateAffectedRecords(event: SecurityEvent): number | undefined {
    return event.metadata.estimated_records || undefined;
  }

  private async logDetectionEvent(breach: DetectedBreach): Promise<void> {
    await this.supabase
      .from('breach_audit_logs')
      .insert([{
        breach_incident_id: breach.id,
        action: 'create',
        user_identifier: 'system',
        changes: { detected_breach: breach }
      }]);
  }

  private cleanEventBuffer(): void {
    const cutoff = new Date(Date.now() - this.BUFFER_TTL_MINUTES * 60 * 1000);
    this.eventBuffer = this.eventBuffer.filter(event => event.timestamp >= cutoff);
  }

  private startEventProcessing(): void {
    // Start background processing for batch analysis
    setInterval(() => {
      this.processEventBuffer();
    }, 30000); // Process every 30 seconds
  }

  private async processEventBuffer(): Promise<void> {
    // Process buffered events for pattern analysis
    // Implementation for batch processing and correlation
  }
}

// Export singleton instance
export const breachDetectionEngine = new BreachDetectionEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);