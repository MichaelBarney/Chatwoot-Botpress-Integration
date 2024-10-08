import * as sdk from '@botpress/sdk'
import * as bp from '.botpress'
import { log } from 'console'
import { Integration, RuntimeError } from '@botpress/sdk' // import the RuntimeError class

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

export default new bp.Integration({
  register: async ({}) => {
  },
  unregister: async ({ }) => {
  },
  actions: {
    sendToAgent: async ({ctx, client, input} ) => {
      console.log("Sending to agent")

      const conversationId = input.conversationId
      const {conversation} = await client.getConversation({
        id: conversationId
      })
      const chatwootConversationId = conversation.tags.chatwootId

      const endpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/toggle_status`
      console.log("Endpoint: ", endpoint)
      const response = await axios.post(endpoint, {
        status: 'open',
      }, {
        headers: { 
          'api_access_token': ctx.configuration.botToken, 
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
    chatwoot: {
      messages: {
        carousel: async ({ payload, ...props }) => {
          console.log("Carousel: ", payload)
          //TODO: Implement Carousel
        },
        card: async ({ payload, ...props }) => {
          console.log("Card: ", payload)
          //TODO: Implement Card
        },
        dropdown: async ({ payload, logger, ...props }) => {
          console.log("Dropdown: ", payload)
          //TODO: Implement Dropdown
        },
        choice: async ({ payload, ctx, conversation, client, user}) => {
          console.log("Choice: ", payload)
          const chatwootBody = {
            "content": payload.text,
            "content_type": "input_select",
            "content_attributes": {
              "items": payload.options.map((option:any) => {
                return { "title": option.label, "value": option.value }
              })
            },
            "private":false
          }
          await sendToChatwoot(chatwootBody, ctx, conversation);
        },
        image: async ({ payload, logger, ctx, conversation, client, user }) => {
          try {
            console.log("Handling image message:", payload);
        
            // Fetch image from the provided URL and create a stream
            const imageUrl = payload.imageUrl;  // Assuming the image URL is passed in the payload
            const response = await axios.get(imageUrl, {
              responseType: 'stream'
            });
        
            // Prepare the form data with the image and other necessary fields
            const formData = new FormData();
            formData.append('attachments[]', response.data, {
              filename: 'image.jpg',  // You can change this based on the image type
              contentType: response.headers['content-type']
            });
            formData.append('message_type', 'outgoing');
            // formData.append('content', 'Envio de imagem utilizando o link em buffer');
        
            // Get the conversation ID and bot token from the client state
            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;
        
            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': ctx.configuration.botToken,
                ...formData.getHeaders(),  // Add the necessary headers from FormData
              },
              maxBodyLength: Infinity, // To handle large image uploads
            };
        
            await axios.post(messageEndpoint, formData, config);
            console.log("Image sent successfully to Chatwoot");
        
          } catch (error) {
            throw new RuntimeError(
              `Error sending image to Chatwoot! ${error}`
            );
          }
        },
        video: async ({ payload, logger, ...props }) => {
          console.log("Video: ", payload)
          //TODO: Implement Video
        },
        location: async ({ payload, logger, ...props }) => {
          console.log("Location: ", payload)
          //TODO: Implement Location
        },
        file: async ({ payload, logger, ...props }) => {
          console.log("File: ", payload)
          //TODO: Implement File
        },
        audio: async ({ payload, logger, ...props }) => {
          console.log("Audio: ", payload)
          //TODO: Implement Audio
        },
        markdown: async ({ payload, logger, ...props }) => {
          console.log("Markdown: ", payload)
          //TODO: Implement Markdown
        },
        bloc: async ({ payload, logger, ...props }) => {
          console.log("Block: ", payload)
          //TODO: Implement Block
        },
        text: async ({ payload, ctx, conversation, client, user}) => {
          const messageBody = {
            content: payload.text,
            message_type: 'outgoing',
            private: false,
          }

          await sendToChatwoot(messageBody, ctx, conversation)
        },
      },
    },
  },

  handler: async ({ req, client }) => {

    const data = JSON.parse(req.body as string)

    if (data.message_type !== 'incoming') {
      return {
        status: 200,
        body: "Message not incoming",
      }
    }

    if (data.conversation.status == 'open'){
      return {
        status: 200,
        body: "Conversation is open",
      }
    }

    const conversationId = data?.conversation?.id
    const userId = data?.sender?.id
    const messageId = data?.id
    const content = data?.content

    console.log("Conversation ID: ", conversationId)
    console.log("User ID: ", userId)
    console.log("Message ID: ", messageId)
    console.log("Content: ", content)

    if (!conversationId || !userId || !messageId) {
      return {
        status: 400,
        body: "Handler didn't receive a valid message",
      }
    }

    const { conversation } = await client.getOrCreateConversation({
      channel: 'chatwoot',
      tags: { 'chatwootId': `${conversationId}` },
    })

    const { user } = await client.getOrCreateUser({
      tags: { 'chatwootId': `${userId}` },
    })

    await client.createMessage({
      tags: { 'chatwootId': `${messageId}` },
      type: 'text',
      userId: user.id,
      conversationId: conversation.id,
      payload: { text: content },
    })

    return {
      status: 200,
      body: "Message received",
    }
  },
})

const sendToChatwoot = async (messageBody:any, ctx:any , conversation:any) => {
  console.log("Sending message to Chatwoot")
  console.log("Conversation: ", conversation)

  console.log("Message Body: ", messageBody)

  const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${conversation.tags.chatwootId}/messages`
    console.log("Message Endpoint: ", messageEndpoint)
    await axios.post(messageEndpoint, messageBody, {
      headers: { 
        'api_access_token': ctx.configuration.botToken, 
        'Content-Type': 'application/json'
      },
      maxBodyLength: Infinity
    }).then((response:any) => {
      console.log("Response For Sending Message: ", response.data);
    }).catch((error:any) => {
      throw new RuntimeError(
      `Error sending message to Chatwoot! ${error}`
    )});
}