import * as bp from '../.botpress'
import * as types from './types'
import { sleep } from './util'
import { OutgoingMessage, WhatsApp } from './whatsapp'

export type SendMessageProps = {
  client: bp.Client
  ctx: types.MessageHandlerProps['ctx']
  conversation: types.MessageHandlerProps['conversation']
  ack: types.MessageHandlerProps['ack']
  logger: types.MessageHandlerProps['logger']
  message: OutgoingMessage
}

export async function send({ ctx, conversation, message, ack, logger }: SendMessageProps) {
  const whatsapp = new WhatsApp({ token: ctx.configuration.whatsapp.accessToken, secure: false })
  const phoneNumberId = conversation.tags.phoneNumberId
  const to = conversation.tags.userPhone
  const messageType = message._type

  if (!phoneNumberId) {
    logger
      .forBot()
      .error("Cannot send message to Whatsapp because the phone number ID wasn't set in the conversation tags.")
    return
  }

  if (!to) {
    logger
      .forBot()
      .error(
        "Cannot send message to Whatsapp because the phone number ID isn't specified yet in the Whatsapp configuration of the bot."
      )
    return
  }

  const feedback = await whatsapp.sendMessage(phoneNumberId, to, message)

  if (feedback?.error) {
    logger.forBot().error(`Failed to send ${messageType} message from bot to Whatsapp. Reason:`, feedback?.error)
    return
  }

  const messageId = feedback?.messages?.[0]?.id

  if (messageId) {
    logger.forBot().debug(`Successfully sent ${messageType} message from bot to Whatsapp:`, message)
    await ack({ tags: { id: messageId } })
  } else {
    logger
      .forBot()
      .warn(
        `A ${messageType} message from the bot was sent to Whatsapp but the message ID wasn't found in their response. Response: ${JSON.stringify(
          feedback
        )}`
      )
  }
}

export async function sendMany({
  client,
  ctx,
  conversation,
  ack,
  generator,
  logger,
}: Omit<SendMessageProps, 'message'> & { generator: Generator<OutgoingMessage, void, unknown> }) {
  try {
    for (const message of generator) {
      // Sending multiple messages in sequence does not guarantee delivery order on the client-side.
      // In order for messages to appear in order on the client side, adding some sleep in between each seems to work.
      await sleep(1000)
      await send({ ctx, conversation, ack, message, logger, client })
    }
  } catch (err) {
    logger.forBot().error('Failed to generate messages for sending to Whatsapp. Reason:', err)
  }
}
