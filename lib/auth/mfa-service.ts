import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'
import { createHash } from 'crypto'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { SMSClient } from '@/lib/twilio/sms-client'

export interface MFASetupData {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface MFAVerificationResult {
  success: boolean
  message: string
}

export class MFAService {
  private static readonly ISSUER = 'AI Business Suite'
  private static readonly BACKUP_CODE_COUNT = 10
  private static readonly BACKUP_CODE_LENGTH = 8

  /**
   * Generate TOTP secret and QR code for user setup
   */
  static async generateTOTPSecret(userId: string, email: string): Promise<MFASetupData> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.ISSUER}:${email}`,
        issuer: this.ISSUER,
        length: 32
      })

      // Generate QR code URL
      const qrCodeUrl = speakeasy.otpauthURL({
        secret: secret.ascii,
        label: encodeURIComponent(`${this.ISSUER}:${email}`),
        issuer: this.ISSUER,
        encoding: 'ascii'
      })

      // Generate backup codes
      const backupCodes = this.generateBackupCodes()

      // Store MFA setup data in database
      const supabase = await createClient()
      const { error } = await supabase
        .from('user_mfa')
        .upsert({
          user_id: userId,
          totp_secret: secret.ascii,
          backup_codes: backupCodes,
          mfa_enabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) {
        logger.error('Failed to store MFA setup data', { error, userId })
        throw new Error('Failed to initialize MFA setup')
      }

      logger.info('MFA setup data generated', { userId })

      return {
        secret: secret.ascii,
        qrCodeUrl,
        backupCodes
      }
    } catch (error) {
      logger.error('Failed to generate TOTP secret', { error, userId })
      throw new Error('Failed to generate MFA setup data')
    }
  }

  /**
   * Verify TOTP token
   */
  static async verifyTOTP(userId: string, token: string): Promise<MFAVerificationResult> {
    try {
      const supabase = await createClient()
      const { data: mfaData, error } = await supabase
        .from('user_mfa')
        .select('totp_secret, backup_codes, mfa_enabled')
        .eq('user_id', userId)
        .single()

      if (error || !mfaData) {
        return { success: false, message: 'MFA not configured for this user' }
      }

      if (!mfaData.mfa_enabled) {
        return { success: false, message: 'MFA not enabled for this user' }
      }

      // Check if token is a backup code
      if (mfaData.backup_codes && mfaData.backup_codes.includes(token)) {
        // Remove used backup code
        const updatedBackupCodes = mfaData.backup_codes.filter((code: string) => code !== token)
        await supabase
          .from('user_mfa')
          .update({
            backup_codes: updatedBackupCodes,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        logger.info('MFA verified with backup code', { userId })
        return { success: true, message: 'MFA verified with backup code' }
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: mfaData.totp_secret,
        encoding: 'ascii',
        token: token,
        window: 2 // Allow 2 time windows (30 seconds each)
      })

      if (verified) {
        logger.info('MFA verified with TOTP', { userId })
        return { success: true, message: 'MFA verified successfully' }
      }

      return { success: false, message: 'Invalid MFA token' }
    } catch (error) {
      logger.error('Failed to verify TOTP', { error, userId })
      return { success: false, message: 'MFA verification failed' }
    }
  }

  /**
   * Enable MFA for user after successful setup verification
   */
  static async enableMFA(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      const { error } = await supabase
        .from('user_mfa')
        .update({
          mfa_enabled: true,
          enabled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to enable MFA', { error, userId })
        return false
      }

      logger.info('MFA enabled for user', { userId })
      return true
    } catch (error) {
      logger.error('Failed to enable MFA', { error, userId })
      return false
    }
  }

  /**
   * Disable MFA for user
   */
  static async disableMFA(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      const { error } = await supabase
        .from('user_mfa')
        .update({
          mfa_enabled: false,
          disabled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to disable MFA', { error, userId })
        return false
      }

      logger.info('MFA disabled for user', { userId })
      return true
    } catch (error) {
      logger.error('Failed to disable MFA', { error, userId })
      return false
    }
  }

  /**
   * Check if MFA is enabled for user
   */
  static async isMFAEnabled(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('user_mfa')
        .select('mfa_enabled')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return false
      }

      return data.mfa_enabled || false
    } catch (error) {
      logger.error('Failed to check MFA status', { error, userId })
      return false
    }
  }

  /**
   * Generate QR code data URL
   */
  static async generateQRCodeDataURL(qrCodeUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(qrCodeUrl)
    } catch (error) {
      logger.error('Failed to generate QR code', { error })
      throw new Error('Failed to generate QR code')
    }
  }

  /**
   * Generate backup codes
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      codes.push(this.generateBackupCode())
    }
    return codes
  }

  /**
   * Generate single backup code
   */
  private static generateBackupCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < this.BACKUP_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /**
   * Regenerate backup codes
   */
  static async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const backupCodes = this.generateBackupCodes()
      const supabase = await createClient()

      const { error } = await supabase
        .from('user_mfa')
        .update({
          backup_codes: backupCodes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to regenerate backup codes', { error, userId })
        throw new Error('Failed to regenerate backup codes')
      }

      logger.info('Backup codes regenerated', { userId })
      return backupCodes
    } catch (error) {
      logger.error('Failed to regenerate backup codes', { error, userId })
      throw new Error('Failed to regenerate backup codes')
    }
  }

  /**
   * Send SMS verification code
   */
  static async sendSMSCode(userId: string, phoneNumber: string): Promise<boolean> {
    try {
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

      const supabase = await createClient()

      // Store the code in database
      const { error } = await supabase
        .from('user_mfa')
        .update({
          phone_number: phoneNumber,
          sms_verification_code: code,
          sms_code_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to store SMS code', { error, userId })
        throw new Error('Failed to store SMS verification code')
      }

      // Send SMS using Twilio
      const smsClient = new SMSClient(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!,
        process.env.TWILIO_SMS_NUMBER!
      )
      const message = `Your AI Business Suite verification code is: ${code}. This code expires in 5 minutes.`

      const smsResult = await smsClient.sendMessage(phoneNumber, message)

      if (!smsResult.success) {
        logger.error('Failed to send SMS', { error: smsResult.error, userId })
        throw new Error('Failed to send SMS verification code')
      }

      logger.info('SMS verification code sent', { userId, phoneNumber: phoneNumber.slice(-4) })
      return true
    } catch (error) {
      logger.error('Failed to send SMS code', { error, userId })
      throw new Error('Failed to send SMS verification code')
    }
  }

  /**
   * Verify SMS code
   */
  static async verifySMSCode(userId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const supabase = await createClient()
      const { data: mfaData, error } = await supabase
        .from('user_mfa')
        .select('sms_verification_code, sms_code_expires_at, sms_enabled')
        .eq('user_id', userId)
        .single()

      if (error || !mfaData) {
        return { success: false, message: 'SMS verification not set up' }
      }

      // Check if code has expired
      if (!mfaData.sms_code_expires_at || new Date(mfaData.sms_code_expires_at) < new Date()) {
        return { success: false, message: 'SMS verification code has expired' }
      }

      // Verify the code
      if (mfaData.sms_verification_code !== code) {
        return { success: false, message: 'Invalid SMS verification code' }
      }

      // Clear the used code
      await supabase
        .from('user_mfa')
        .update({
          sms_verification_code: null,
          sms_code_expires_at: null,
          sms_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      logger.info('SMS code verified successfully', { userId })
      return { success: true, message: 'SMS verification successful' }
    } catch (error) {
      logger.error('Failed to verify SMS code', { error, userId })
      return { success: false, message: 'SMS verification failed' }
    }
  }

  /**
   * Enable SMS MFA for user
   */
  static async enableSMSMFA(userId: string, phoneNumber: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      // First send verification code
      const sent = await this.sendSMSCode(userId, phoneNumber)
      if (!sent) {
        return false
      }

      // Update phone number (but don't enable yet - wait for verification)
      const { error } = await supabase
        .from('user_mfa')
        .update({
          phone_number: phoneNumber,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to update phone number', { error, userId })
        return false
      }

      logger.info('SMS MFA setup initiated', { userId })
      return true
    } catch (error) {
      logger.error('Failed to enable SMS MFA', { error, userId })
      return false
    }
  }

  /**
   * Disable SMS MFA for user
   */
  static async disableSMSMFA(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      const { error } = await supabase
        .from('user_mfa')
        .update({
          sms_enabled: false,
          phone_number: null,
          sms_verification_code: null,
          sms_code_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to disable SMS MFA', { error, userId })
        return false
      }

      logger.info('SMS MFA disabled', { userId })
      return true
    } catch (error) {
      logger.error('Failed to disable SMS MFA', { error, userId })
      return false
    }
  }

  /**
   * Check if SMS MFA is enabled for user
   */
  static async isSMSMFAEnabled(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('user_mfa')
        .select('sms_enabled')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return false
      }

      return data.sms_enabled || false
    } catch (error) {
      logger.error('Failed to check SMS MFA status', { error, userId })
      return false
    }
  }

  /**
   * Get user's MFA methods
   */
  static async getUserMFAMethods(userId: string): Promise<{
    totpEnabled: boolean
    smsEnabled: boolean
    phoneNumber?: string
  }> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('user_mfa')
        .select('mfa_enabled, sms_enabled, phone_number')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return { totpEnabled: false, smsEnabled: false }
      }

      return {
        totpEnabled: data.mfa_enabled || false,
        smsEnabled: data.sms_enabled || false,
        phoneNumber: data.phone_number
      }
    } catch (error) {
      logger.error('Failed to get user MFA methods', { error, userId })
      return { totpEnabled: false, smsEnabled: false }
    }
  }
}