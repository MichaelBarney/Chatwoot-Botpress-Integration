import * as sdk from '@botpress/sdk'
import * as bp from '.botpress'
import { Integration, RuntimeError } from '@botpress/sdk' // import the RuntimeError class
import { createConversationHandler as createConversation, startConversation } from './conversation'

import * as outgoing from './outgoing-message'
import { Audio, Document, Image, QuickReplies, Location, Text, Video, WhatsApp, WhatsAppPayload } from './whatsapp'

import queryString from 'query-string'
import * as crypto from 'node:crypto'
import { handleIncomingMessage } from './incoming-message'

const axios = require('axios');

export default new bp.Integration({
  register: async () => {

  },
  unregister: async () => {},
  actions: {
    startConversation: async ({ ctx, input, client, logger }) => {
      const phoneNumberId: string | undefined = input.senderPhoneNumberId || ctx.configuration.whatsapp.phoneNumberId

      if (!phoneNumberId) {
        throw new Error('phoneNumberId is required')
      }

      const conversation = await startConversation(
        {
          phoneNumberId,
          userPhone: input.userPhone,
          templateName: input.templateName,
          templateLanguage: input.templateLanguage,
          templateVariablesJson: input.templateVariablesJson,
        },
        { client, ctx, logger }
      )

      return {
        conversationId: conversation.id,
      }
    },
    sendToAgent: async (entries) => {
      console.log("Sending to agent")
      const {input, ctx, client} = entries;
      const userState = await client.getState({
        type: 'user',
        name: 'chatwoot',
        id: ctx.botUserId,
      })

      const chatwootConversationId = userState.state.payload.conversationId;
      console.log("Conversation ID: ", chatwootConversationId)

      const endpoint = `${ctx.configuration.chatwoot?.baseUrl}/api/v1/accounts/${ctx.configuration.chatwoot?.accountNumber}/conversations/${chatwootConversationId}/toggle_status`
      console.log("Endpoint: ", endpoint)
      const response = await axios.post(endpoint, {
        status: 'open',
      }, {
        headers: { 
          'api_access_token': ctx.configuration.chatwoot?.botToken, 
          'Content-Type': 'application/json'
        },
        maxBodyLength: Infinity
      }).then((response:any) => {
        console.log("Response For Send To Agent: ", response.data);
      }).catch((error:any) => {
        throw new RuntimeError(
        `Error sending message to Chatwoot! ${error}`
      )}
      )

      return { currentStatus: 'open' };
    },
  },
  channels: {
    proai: {
      messages: {
        text: async ({ payload, ...props }) => {
          await outgoing.send({ ...props, message: new Text(payload.text) })
        },
        image: async ({ payload, ...props }) => {
          await outgoing.send({
            ...props,
            message: new Image(payload.imageUrl),
          })
        },
        markdown: async ({ payload, ...props }) => {
          await outgoing.send({
            ...props,
            message: new Text(payload.markdown),
          })
        },
        audio: async ({ payload, ...props }) => {
          await outgoing.send({
            ...props,
            message: new Audio(payload.audioUrl),
          })
        },
        video: async ({ payload, ...props }) => {
          await outgoing.send({
            ...props,
            message: new Video(payload.videoUrl),
          })
        },
        file: async ({ payload, ...props }) => {
          const url = new URL(payload.fileUrl)
          const extension = url.pathname.includes('.') ? url.pathname.split('.').pop()?.toLowerCase() ?? '' : ''
          const filename = 'file' + (extension ? `.${extension}` : '')

          await outgoing.send({
            ...props,
            message: new Document(payload.fileUrl),
          })
        },
        location: async ({ payload, ...props }) => {
          await outgoing.send({
            ...props,
            message: new Location(payload.latitude, payload.longitude),
          })
        },
        carousel: async ({ payload, ...props }) => {
          for (const card of payload.items) {
            if (card.imageUrl) {
              await outgoing.send({
                ...props,
                message: new Image(card.imageUrl),
              })
            } else {
              await outgoing.send({
                ...props,
                message: new Text(card.title),
              })
            }
          }
        },
        card: async ({ payload, ...props }) => {
          await outgoing.send({
            ...props,
            message: new Text(payload.title),
          })
        },
        dropdown: async ({ payload, logger, ...props }) => {
          await outgoing.send({
            ...props,
            logger,
            message: new QuickReplies(payload.options.map((option) => option.value), payload.text),
          })
        },
        choice: async ({ payload, logger, ...props }) => {
          await outgoing.send({
            ...props,
            logger,
            message: new QuickReplies(payload.options.map((option) => option.label), payload.text),
          })
        },
        bloc: () => {
          throw new RuntimeError('Not implemented')
        },
      },
    },
  },
  handler: async ({ req, client, ctx, logger }) => {
    if (req.body) {
      logger.forBot().debug('Handler received request from Whatsapp with payload:', req.body)
    } else {
      logger.forBot().debug('Handler received request from Whatsapp with empty payload')
    }

    if (req.query) {
      const query = queryString.parse(req.query)

      const mode = query['hub.mode']
      const token = query['hub.verify_token']
      const challenge = query['hub.challenge']

      if (mode === 'subscribe') {
        if (token === ctx.configuration.whatsapp.verifyToken) {
          if (!challenge) {
            logger.forBot().warn('Returning HTTP 400 as no challenge parameter was received in query string of request')
            return {
              status: 400,
            }
          }

          return {
            body: typeof challenge === 'string' ? challenge : '',
          }
        } else {
          logger
            .forBot()
            .warn("Returning HTTP 403 as the Whatsapp token doesn't match the one in the bot configuration")
          return {
            status: 403,
          }
        }
      } else {
        logger.forBot().warn(`Returning HTTP 400 as the '${mode}' mode received in the query string isn't supported`)
        return {
          status: 400,
        }
      }
    }

    if (!req.body) {
      logger.forBot().warn('Handler received an empty body, so the message was ignored')
      return
    }

    const secret = ctx.configuration.whatsapp.clientSecret

    // For testing purposes, if you send the secret in the header it's possible to disable signature check
    if (secret && req.headers['x-secret'] !== secret) {
      const signature = req.headers['x-hub-signature-256']

      if (!signature) {
        const errorMessage = 'Couldn\'t find "x-hub-signature-256" in headers.'
        logger.forBot().error(errorMessage)
        return { status: 401, body: errorMessage }
      } else {
        const signatureHash = signature.split('=')[1]
        const expectedHash = crypto.createHmac('sha256', secret).update(req.body).digest('hex')
        if (signatureHash !== expectedHash) {
          const errorMessage =
            "Couldn't validate the request signature, please verify the client secret configuration property."
          logger.forBot().error(errorMessage)
          return { status: 401, body: errorMessage }
        }
      }
    }

    try {
      const data = JSON.parse(req.body) as WhatsAppPayload

      for (const { changes } of data.entry) {
        for (const change of changes) {
          if (!change.value.messages) {
            // If the change doesn't contain messages we can ignore it, as we don't currently process other change types (such as statuses).
            continue
          }

          for (const message of change.value.messages) {
            const whatsapp = new WhatsApp({ token: ctx.configuration.whatsapp.accessToken!, secure: false })

            const phoneNumberId = change.value.metadata.phone_number_id

            await whatsapp.markAsRead(phoneNumberId, message.id)

            await handleIncomingMessage(message, change.value, ctx, client, logger)
          }
        }
      }
    } catch (e: any) {
      logger.forBot().error('Error while handling request:', e)
      logger.forBot().debug('Request body received:', req.body)
    }

    return
  },
})