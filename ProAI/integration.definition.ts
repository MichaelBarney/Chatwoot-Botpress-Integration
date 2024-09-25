import { IntegrationDefinition, z, messages } from '@botpress/sdk'

const TagsForCreatingConversation = {
  phoneNumberId: {
    title: 'Phone Number ID',
    description:
      'Whatsapp Phone Number ID to use as sender. If not provided it defaults to the one set in the configuration.',
  },
  userPhone: {
    title: 'User phone number',
    description: 'Phone number of the Whatsapp user to start the conversation with.',
  },
  templateName: {
    title: 'Message Template name',
    description: 'Name of the Whatsapp Message Template to start the conversation with.',
  },
  templateLanguage: {
    title: 'Message Template language (optional)',
    description:
      'Language of the Whatsapp Message Template to start the conversation with. Defaults to "en_US" (U.S. English).',
  },
  templateVariables: {
    title: 'Message Template variables (optional)',
    description: 'JSON array representation of variable values to pass to the Whatsapp Message Template.',
  },
}


export default new IntegrationDefinition({
  name: "proai",
  version: '1.0.0',
  readme: 'hub.md',
  title: 'Pro AI',
  description: 'Pro AI integration',
  icon: 'icon.svg',
  actions: {
    startConversation: {
      title: 'Start Conversation',
      description:
        "Proactively starts a conversation with a user's Whatsapp phone number by sending them a message using a Whatsapp Message Template.",
      input: {
        schema: z.object({
          userPhone: z.string().describe(TagsForCreatingConversation.userPhone.description),
          templateName: z.string().describe(TagsForCreatingConversation.templateName.description),
          templateLanguage: z.string().optional().describe(TagsForCreatingConversation.templateLanguage.description),
          templateVariablesJson: z
            .string()
            .optional()
            .describe(TagsForCreatingConversation.templateVariables.description),
          senderPhoneNumberId: z.string().optional().describe(TagsForCreatingConversation.phoneNumberId.description),
        }),
      },
      output: {
        schema: z.object({
          conversationId: z.string(),
        }),
      },
    },
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
      whatsapp: z.object({
        verifyToken: z.string().describe('Token used for verification when subscribing to webhooks'),
        accessToken: z
          .string()
          .describe('Access Token from a System Account that has permission to the Meta app'),
        clientSecret: z.string().describe('Meta app secret used for webhook signature check'),
        phoneNumberId: z.string().describe('Default Phone used for starting conversations'),
      }),
      useChatwoot: z.boolean().optional(),
      chatwoot: z.object({
        botToken: z.string().optional(),
        baseUrl: z.string().optional(),
        accountNumber: z.number().optional(),
        inboxNumber: z.number().optional(),
      }).optional()
    }).hidden((formData) => {
      const showConfig = !formData?.useChatwoot

      return {
        chatwoot: showConfig,
      }
    }),
  },
  states: {
    credentials: {
      type: 'integration',
      schema: z.object({
        accessToken: z.string().optional(),
        phoneNumberId: z.string().optional(),
        wabaId: z.string().optional(),
      }),
    },
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
    "proai": {
      // messages: messages.defaults,  // use this to support all message types supported in Botpress Studio
      messages: messages.defaults, // use this to support all message types supported in Botpress Studio
      message: {
        tags: {
          id: {}, // Add this line to tag messages
        },
      },
      conversation: {
        tags: TagsForCreatingConversation,
      },
    },
  },
  user: {
    tags: {
      userId: {}, // Add this line to tag users
      name: {},
    },
  },
})
