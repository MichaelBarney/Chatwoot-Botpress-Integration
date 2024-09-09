import { IntegrationDefinition, z, messages} from '@botpress/sdk'
import { integrationName } from './package.json'
import { chatwoot } from '.botpress/implementation/channels'

export default new IntegrationDefinition({
  name: integrationName,
  version: '1.0.1',
  readme: 'hub.md',
  title: 'Chatwoot',
  description: 'Chatwoot Integration for live agent handoff',
  icon: 'icon.svg',
  actions: {
    sendToAgent: {
      title: 'Send to Agent',
      description: 'Directs the conversation to an agent',
      input: {
        schema: z.object({}),
      },
      output: {
        schema: z.object({
          currentStatus: z.string().describe('Conversation Status'),
        }),
      },
    }
  },
  events: {},
  configuration: {
    schema: z.object({
      apiToken: z.string().optional(),
      botToken: z.string().optional(),
      baseUrl: z.string(),
      accountNumber: z.number(),
      inboxNumber: z.number(),
    }),
  },
  states: {
    configuration: {
      type: 'integration',
      schema: z.object({
        botToken: z.string().optional(),
        botId: z.number().optional(),
      }),
    },
    chatwoot: {
      type: 'user',
      schema: z.object({
        conversationId: z.string(),
      }),
    }
  },
  channels: {
    chatwoot: {
      // messages: messages.defaults,  // use this to support all message types supported in Botpress Studio
      messages: messages.defaults, // use this to support all message types supported in Botpress Studio
      message: {
        tags: {
          chatwootId: {}, // Add this line to tag messages
        },
      },
      conversation: {
        tags: {
          chatwootId: {}, // Add this line to tag conversations
        },
      },
    },
  },
  user: {
    tags: {
      chatwootId: {}, // Add this line to tag users
    },
  },
  
})
