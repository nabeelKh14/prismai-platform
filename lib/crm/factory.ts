import { CRMConnector, CRMConnectorFactory, CRMConfig } from './types'
import { SalesforceConnector } from './salesforce-connector'
import { HubSpotConnector } from './hubspot-connector'
import { PipedriveConnector } from './pipedrive-connector'
import { logger } from '@/lib/logger'

export class CRMConnectorFactoryImpl implements CRMConnectorFactory {
  createConnector(config: CRMConfig): CRMConnector {
    try {
      switch (config.provider) {
        case 'salesforce':
          return new SalesforceConnector(config)
        case 'hubspot':
          return new HubSpotConnector(config)
        case 'pipedrive':
          return new PipedriveConnector(config)
        default:
          throw new Error(`Unsupported CRM provider: ${config.provider}`)
      }
    } catch (error) {
      logger.error('Failed to create CRM connector', error as Error, {
        userId: config.userId,
        provider: config.provider
      })
      throw error
    }
  }
}

// Export singleton instance
export const crmConnectorFactory = new CRMConnectorFactoryImpl()

// Utility function to create connector
export function createCRMConnector(config: CRMConfig): CRMConnector {
  return crmConnectorFactory.createConnector(config)
}