import * as sdk from '@botpress/sdk'
import * as bp from '.botpress'
import { log } from 'console'
import { Integration, RuntimeError } from '@botpress/sdk' // import the RuntimeError class

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

export default new bp.Integration({
  register: async ({ }) => {
  },
  unregister: async ({ }) => {
  },
  actions: {
    sendToAgent: async ({ ctx, client, input }) => {
      console.log("Sending to agent")

      const conversationId = input.conversationId
      const { conversation } = await client.getConversation({
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
      }).then((response: any) => {
        console.log("Response For Send To Agent: ", response.data);
      }).catch((error: any) => {
        throw new RuntimeError(
          `Error sending message to Chatwoot! ${error}`
        )
      }
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
        dropdown: async ({ payload, ctx, conversation }) => {
          try {
            console.log("Handling dropdown menu:", payload);

            // Prepare the message content for the dropdown
            const dropdownMessage = {
              content: payload.text,
              content_type: 'input_select',
              content_attributes: {
                items: payload.options.map((option: any) => {
                  return { title: option.label, value: option.value };
                }),
              },
              message_type: 'outgoing',
              private: false,
            };

            // Get the Chatwoot conversation ID from conversation tags
            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;

            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': ctx.configuration.botToken,
                'Content-Type': 'application/json',
              },
            };

            await axios.post(messageEndpoint, dropdownMessage, config)
              .then((response) => {
                console.log("Dropdown sent successfully: ", response.data);
              })
              .catch((error) => {
                console.error("Error sending dropdown: ", error.response?.data || error.message);
              });

          } catch (error) {
            console.error(`Error handling dropdown: ${error}`);
            throw new RuntimeError(`Error handling dropdown: ${error}`);
          }
        },

        choice: async ({ payload, ctx, conversation, client, user }) => {
          console.log("Choice: ", payload)
          const chatwootBody = {
            "content": payload.text,
            "content_type": "input_select",
            "content_attributes": {
              "items": payload.options.map((option: any) => {
                return { "title": option.label, "value": option.value }
              })
            },
            "private": false
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
        video: async ({ payload, ctx, conversation }) => {
          try {
            console.log("Handling video message:", payload);

            // Fetch video from the provided URL
            const videoUrl = payload.videoUrl; // Assuming the video URL is passed in the payload
            const response = await axios.get(videoUrl, {
              responseType: 'stream',
            });

            // Prepare the form data with the video stream
            const formData = new FormData();
            formData.append('attachments[]', response.data, {
              filename: payload.fileName || 'video.mp4',  // Use filename from payload if available
              contentType: response.headers['content-type'],
            });
            formData.append('message_type', 'outgoing');

            // Get the Chatwoot conversation ID from conversation tags
            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;

            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': ctx.configuration.botToken,
                ...formData.getHeaders(),  // Add headers from FormData
              },
              maxBodyLength: Infinity,  // Handle large files
            };

            await axios.post(messageEndpoint, formData, config);
            console.log("Video sent successfully to Chatwoot");

          } catch (error) {
            console.error(`Error sending video to Chatwoot: ${error}`);
            throw new RuntimeError(`Error sending video to Chatwoot: ${error}`);
          }
        },
        location: async ({ payload, logger, ...props }) => {
          console.log("Location: ", payload)
          //TODO: Implement Location
        },
        file: async ({ payload, logger, ctx, conversation }) => {
          try {
            console.log("Handling file message:", payload);

            // Fetch file from the provided URL
            const fileUrl = payload.fileUrl;  // Assuming the file URL is passed in the payload
            const response = await axios.get(fileUrl, {
              responseType: 'stream',
            });

            // Prepare the form data with the file stream
            const formData = new FormData();
            formData.append('attachments[]', response.data, {
              filename: payload.fileName || 'file',  // Use filename from payload if available
              contentType: response.headers['content-type'],
            });
            formData.append('message_type', 'outgoing');

            // Get the Chatwoot conversation ID from conversation tags
            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;

            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': ctx.configuration.botToken,
                ...formData.getHeaders(),  // Add headers from FormData
              },
              maxBodyLength: Infinity,  // Handle large files
            };

            await axios.post(messageEndpoint, formData, config);
            console.log("File sent successfully to Chatwoot");

          } catch (error) {
            logger.error(`Error sending file to Chatwoot: ${error}`);
            throw new RuntimeError(`Error sending file to Chatwoot: ${error}`);
          }
        },
        audio: async ({ payload, ctx, conversation }) => {
          try {
            console.log("Handling audio message:", payload);

            // Fetch audio from the provided URL
            const audioUrl = payload.audioUrl; // Assuming the audio URL is passed in the payload
            const response = await axios.get(audioUrl, {
              responseType: 'stream',
            });

            // Prepare the form data with the audio stream
            const formData = new FormData();
            formData.append('attachments[]', response.data, {
              filename: payload.fileName || 'audio.mp3',  // Use filename from payload if available
              contentType: response.headers['content-type'],
            });
            formData.append('message_type', 'outgoing');

            // Get the Chatwoot conversation ID from conversation tags
            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;

            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': ctx.configuration.botToken,
                ...formData.getHeaders(),  // Add headers from FormData
              },
              maxBodyLength: Infinity,  // Handle large files
            };

            await axios.post(messageEndpoint, formData, config);
            console.log("Audio sent successfully to Chatwoot");

          } catch (error) {
            console.error(`Error sending audio to Chatwoot: ${error}`);
            throw new RuntimeError(`Error sending audio to Chatwoot: ${error}`);
          }
        },
        markdown: async ({ payload, ctx, conversation }) => {
          try {
            console.log("Handling Markdown message:", payload);

            // Prepare the message with Markdown content
            const markdownMessage = {
              content: payload.text, // Assuming 'text' is in Markdown format
              message_type: 'outgoing',
              private: false,
            };

            // Get the Chatwoot conversation ID from conversation tags
            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;

            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': ctx.configuration.botToken,
                'Content-Type': 'application/json',
              },
            };

            await axios.post(messageEndpoint, markdownMessage, config)
              .then((response) => {
                console.log("Markdown message sent successfully: ", response.data);
              })
              .catch((error) => {
                console.error("Error sending Markdown message: ", error.response?.data || error.message);
              });

          } catch (error) {
            console.error(`Error handling Markdown: ${error}`);
            throw new RuntimeError(`Error handling Markdown: ${error}`);
          }
        },
        bloc: async ({ payload, ctx, conversation }) => {
          try {
            console.log("Handling block message:", payload);

            // Prepare the block content, which could include text and media
            const content = payload.text ? payload.text : '';
            const attachments = payload.attachments || []; // Assuming there could be attachments like images

            // Build the message to send
            const blockMessage = {
              content: content,
              attachments: attachments,
              message_type: 'outgoing',
              private: false,
            };

            const chatwootConversationId = conversation.tags.chatwootId;
            const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${chatwootConversationId}/messages`;

            // Make the POST request to Chatwoot
            const config = {
              headers: {
                'api_access_token': ctx.configuration.botToken,
                'Content-Type': 'application/json',
              },
            };

            await axios.post(messageEndpoint, blockMessage, config)
              .then((response) => {
                console.log("Block message sent successfully: ", response.data);
              })
              .catch((error) => {
                console.error("Error sending block message: ", error.response?.data || error.message);
              });

          } catch (error) {
            console.error(`Error handling block: ${error}`);
            throw new RuntimeError(`Error handling block: ${error}`);
          }
        },
        text: async ({ payload, ctx, conversation, client, user }) => {
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

    if (data.conversation.status == 'open') {
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

const sendToChatwoot = async (messageBody: any, ctx: any, conversation: any) => {
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
  }).then((response: any) => {
    console.log("Response For Sending Message: ", response.data);
  }).catch((error: any) => {
    throw new RuntimeError(
      `Error sending message to Chatwoot! ${error}`
    )
  });
}