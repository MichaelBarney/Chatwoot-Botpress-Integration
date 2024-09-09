import * as sdk from '@botpress/sdk'
import * as bp from '.botpress'
import { log } from 'console'
import { Integration, RuntimeError } from '@botpress/sdk' // import the RuntimeError class

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

export default new bp.Integration({
  register: async ({ webhookUrl, ctx, client}) => {
    if(!ctx.configuration.apiToken && !ctx.configuration.botToken){
      throw new RuntimeError(
        `Configuration Error! API Token and Bot Token are required`
      )
    }
    if(ctx.configuration.botToken){
      console.log("Setting state")
      await client.setState({
        type: 'integration',
        name: 'configuration',
        id: ctx.integrationId,
        payload: { botToken: ctx.configuration.botToken },
      }).catch((error) => {
        console.log("Error: ", error);
        throw new RuntimeError(
        `Configuration Error! ${error}`
      )});
      return;
    }

    console.log("Creating bot")
    await axios.post(`${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/agent_bots`, {
      name: "Botpress",
      description: "Botpress Chatwoot Integration",
      outgoing_url: webhookUrl,
    }, {
      headers: { 
        'api_access_token': ctx.configuration.apiToken, 
        'Content-Type': 'application/json'
      },
      maxBodyLength: Infinity
    })
    .then(async (response:any) => {
      console.log("Bot Creation Response: ", response.data);
      const botId = response.data.id;
      const botToken = response.data.access_token;
      console.log("Bot ID: ", botId);
      console.log("Bot Token: ", botToken);

      console.log("Setting state")
      await client.setState({
        type: 'integration',
        name: 'configuration',
        id: ctx.integrationId,
        payload: { botId, botToken },
      }).catch((error) => {
        console.log("Error: ", error);
        throw new RuntimeError(
        `Configuration Error! ${error}`
      )});

      // Set inbox bot
      console.log("Setting inbox bot")
      await axios.post(`${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/inboxes/${ctx.configuration.inboxNumber}/set_agent_bot`, {
        agent_bot: botId,
      }, {
        headers: { 
          'api_access_token': ctx.configuration.apiToken, 
          'Content-Type': 'application/json'
        },
        maxBodyLength: Infinity
      }).then((response:any) => {
        console.log("Response For Set Agent Bot: ", response.data);
      }).catch((error:any) => {
        throw new RuntimeError(
        `Configuration Error! ${error}`
      )});
    }
    )
    .catch((error:any) => {
      console.log("Error: ", error);
      throw new RuntimeError(
      `Configuration Error! ${error}`
    )});
  },
  unregister: async ({ ctx, client}) => {
    console.log("Unregistering bot Console Log")
    const { state } = await client.getState({
      type: 'integration',
      name: 'configuration',
      id: ctx.integrationId,
    })
    await axios.delete(`${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/agent_bots/${state.payload.botId}`, {
      headers: { 
        'api_access_token': ctx.configuration.apiToken, 
        'Content-Type': 'application/json'
      },
      maxBodyLength: Infinity
    })
    .then((response:any) => {
      console.log("Response For Unregister: ", response.data);
    }
    )
    .catch((error:any) => {
      throw new RuntimeError(
      `Configuration Error! ${error}`
    )});
  },
  actions: {
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

      const endpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/toggle_status`
      console.log("Endpoint: ", endpoint)
      const response = await axios.post(endpoint, {
        status: 'open',
      }, {
        headers: { 
          'api_access_token': ctx.configuration.apiToken, 
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
          await sendToChatwoot(chatwootBody, ctx, conversation, client, user);
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
            const { state } = await client.getState({
              type: 'integration',
              name: 'configuration',
              id: ctx.integrationId,
            });
        
            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;
        
            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': state.payload.botToken,
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

          await sendToChatwoot(messageBody, ctx, conversation, client, user)
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

const sendToChatwoot = async (messageBody:any, ctx:any , conversation:any, client:any, user:any) => {
  console.log("Sending message to Chatwoot")
  console.log("Conversation: ", conversation)
  
  const { state } = await client.getState({
    type: 'integration',
    name: 'configuration',
    id: ctx.integrationId,
  })

  if(state.payload.conversationId){
    await client.setState({
      type: 'user',
      name: 'chatwoot',
      id: user.id,
      payload: { conversationId: conversation.tags.chatwootId as string },
    }
    )
  }

  console.log("Message Body: ", messageBody)

  const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${conversation.tags.chatwootId}/messages`
    console.log("Message Endpoint: ", messageEndpoint)
    await axios.post(messageEndpoint, messageBody, {
      headers: { 
        'api_access_token': state.payload.botToken, 
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