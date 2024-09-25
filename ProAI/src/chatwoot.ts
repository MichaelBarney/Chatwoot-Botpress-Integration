import { IntegrationContext } from "@botpress/sdk";
import { IntegrationCtx, Message } from "./types";
import { WhatsAppMessage } from "./whatsapp";
import {  Conversation, RuntimeError, User } from "@botpress/client";
import axios from "axios";
import { Client } from ".botpress";

export class Chatwoot {
    async incomingMessage(message: WhatsAppMessage, ctx: IntegrationContext, client: Client, user: User, conversation: Conversation) {
        console.log("Incoming message: ", message)
            
        const { state } = await client.getState({
            type: 'integration',
            name: 'chatwoot',
            id: ctx.integrationId,
        })
          
        if(state.payload.conversationId){
            await client.setState({
            type: 'user',
            name: 'chatwoot',
            id: ctx.botUserId,
                payload: {
                conversationId: state.payload.conversationId
                }
            })
        }
          
        console.log("Message Body: ", message.text)
          
        const messageEndpoint = `${ctx.configuration.baseUrl}/api/v1/accounts/${ctx.configuration.accountNumber}/conversations/${conversation.tags.chatwootId}/messages`
            console.log("Message Endpoint: ", messageEndpoint)
            await axios.post(messageEndpoint, message.text, {
            headers: { 
                'api_access_token': ctx.configuration.chatwoot.botToken, 
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
}