import {
  COLLECTIONS_SCHEMA_VERSION,
  type CollectionsState,
} from '../model/collection.types'

const SAMPLE_CREATED_AT = Date.UTC(2026, 6, 1, 8)
const SAMPLE_UPDATED_AT = Date.UTC(2026, 6, 30, 8)

/**
 * Realistic deterministic data used while developing the dashboard.
 *
 * This state must never be automatically written to user storage.
 */
export const DEVELOPMENT_SAMPLE_STATE = {
  schemaVersion: COLLECTIONS_SCHEMA_VERSION,
  collections: [
    {
      id: 'sample-development',
      name: 'Development',
      description: 'Daily tools and technical documentation.',
      icon: 'code',
      color: '#f97316',
      resources: [
        {
          id: 'sample-github',
          type: 'website',
          name: 'GitHub',
          url: 'https://github.com/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-wxt',
          type: 'website',
          name: 'WXT Documentation',
          url: 'https://wxt.dev/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-react',
          type: 'website',
          name: 'React Documentation',
          url: 'https://react.dev/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-typescript',
          type: 'website',
          name: 'TypeScript Documentation',
          url: 'https://www.typescriptlang.org/docs/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-stack-overflow',
          type: 'website',
          name: 'Stack Overflow',
          url: 'https://stackoverflow.com/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
      ],
      createdAt: SAMPLE_CREATED_AT,
      updatedAt: SAMPLE_UPDATED_AT,
    },
    {
      id: 'sample-azure-study',
      name: 'Azure Study',
      description: 'Resources for Azure learning and certification.',
      icon: 'cloud',
      color: '#0ea5e9',
      resources: [
        {
          id: 'sample-microsoft-learn-azure',
          type: 'website',
          name: 'Microsoft Learn for Azure',
          url: 'https://learn.microsoft.com/en-us/azure/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-azure-portal',
          type: 'website',
          name: 'Azure Portal',
          url: 'https://portal.azure.com/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-azure-architecture',
          type: 'website',
          name: 'Azure Architecture Center',
          url: 'https://learn.microsoft.com/en-us/azure/architecture/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-azure-samples',
          type: 'website',
          name: 'Azure Samples',
          url: 'https://github.com/Azure-Samples',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
      ],
      createdAt: SAMPLE_CREATED_AT,
      updatedAt: SAMPLE_UPDATED_AT,
    },
    {
      id: 'sample-web-research',
      name: 'Web Research',
      description: 'References for researching browser capabilities.',
      icon: 'search',
      color: '#8b5cf6',
      resources: [
        {
          id: 'sample-mdn',
          type: 'website',
          name: 'MDN Web Docs',
          url: 'https://developer.mozilla.org/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-web-dev',
          type: 'website',
          name: 'web.dev',
          url: 'https://web.dev/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-can-i-use',
          type: 'website',
          name: 'Can I use',
          url: 'https://caniuse.com/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
        {
          id: 'sample-npm',
          type: 'website',
          name: 'npm',
          url: 'https://www.npmjs.com/',
          createdAt: SAMPLE_CREATED_AT,
          updatedAt: SAMPLE_UPDATED_AT,
        },
      ],
      createdAt: SAMPLE_CREATED_AT,
      updatedAt: SAMPLE_UPDATED_AT,
    },
  ],
} as const satisfies CollectionsState
