import * as bp from '.botpress'
import { image } from '.botpress/implementation/channels/proai';

export class WhatsApp {
    token: string
    constructor({token}: {token:string, secure:boolean}) {
        this.token = token
    }
    async sendMessage(phoneNumberId: string, to: string, message: OutgoingMessage) {
        console.log("DEBUG: Sending Message: ", message);
        
        const body = {
            messaging_product: "whatsapp",
            to: to,
            ...message.body,
        }

        try{
            const whatsAppAnswer = await fetch(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages?access_token=${this.token}`,
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body),
            }
            );

            const whatsAppAnswerJSON:any = await whatsAppAnswer.json();
            console.log("DEBUG: Message Answer: ", whatsAppAnswerJSON);
            const messageId = whatsAppAnswerJSON.messages[0].id;        
            return {messages: [{id: messageId}]}
        } catch (error) {
            return {error: error}
        }
    }
    async markAsRead(phoneNumberId: string, messageId: string) {}
    async retrieveMedia(whatsappMediaId: string) {
        return {url: 'https://example.com'}
    }
}

export class Image {
    _type = 'image'
    body: any
    constructor(url:string, caption?:string) {
        this.body = {
            type: "image",
            image: {link: url},
          };
    }
}

export class Text {
    _type = 'text'
    body: any
    constructor(text:string) {
        this.body = {
            type: "text",
            text: {body: text},
        }
    }
}

export class QuickReplies {
    _type = 'interactive'
    body: any
    constructor(quickReplies: string[], bodyText: string) {
        this.body = {
            type: "interactive",
            interactive: {},
        }

        if (quickReplies.length <= 3) {
            console.log("DEBUG: Less than 3");
              this.body.interactive = {
                body: {
                  text: bodyText,
                },
                type: "button",
                action: {
                  buttons: quickReplies.map((quickReply) => {
                    return {
                      type: "reply",
                      reply: {
                        title: quickReply,
                        id: quickReply,
                      },
                    };
                  }),
                },
              };
            } else{
              quickReplies = quickReplies.slice(0, 10);
              this.body.interactive = {
                body: {
                  text: bodyText,
                },
                type: "button",
                action: {
                  sections: [
                    {
                      title: "Escolha uma opção",
                      rows: quickReplies.map((quickReply) => {
                        return {
                          title: quickReply,
                          description: "",
                          id: quickReply,
                        };
                      }),
                    },
                  ],
                },
              };
            }
    }
}

export class Video {
    _type = 'video'
    body: any
    constructor(url:string) {
        this.body = {
            type: "video",
            video: {link: url},
        };
    }
}

export class Audio {
    _type = 'audio'
    body: any
    constructor(url:string) {
        this.body = {
            type: "audio",
            audio: {link: url},
        };
    }
}

export class Document {
    _type = 'document'
    body: any
    constructor(url:string) {
        this.body = {
            type: "document",
            document: {link: url},
        };
    }
}

export class Location {
    _type = 'location'
    body: any
    constructor(latitude:number, longitude:number ) {
        this.body = {
            type: "location",
            location: {
              latitude: latitude,
              longitude: longitude,
            },
          };
    }
}

export class Contacts {
    _type = 'contacts'
    body: any

    constructor(name: string, phoneNumber: string ) {
        this.body = {
            type: "contacts",
            contacts: {
              name: name,
              phone_number: phoneNumber,
            },
          };

    }
}

export class Template {
    body: any
    _type = 'template'
    constructor(templateName: string, language: string, variables: string[], header: {imageId?: string, videoId?: string}, lto: {cuponCode: string, urlVariable: string, offerTTLMinutes: number}, user: any) {
        this.body = {
            type: "template",
            template: {
              name: templateName,
              language: {
                code: language,
              },
              components: [{
                type: "header",
                parameters: [
                  ...(header.imageId ? [{
                    type: "image",
                    image: {
                      id: header.imageId,
                    }},
                  ] : header.videoId ?[
                    {
                      type: "video",
                      video: {
                        id: header.videoId,
                      },
                    },
        
                  ] :[])],
              }, {
                type: "body",
                parameters: variables.map((parameter) => {
                  return {
                    type: "text",
                    text: parameter,
                  };
                }
                ),
              }, {
                type: "button",
                sub_type: "copy_code",
                index: 0,
                parameters: [
                  {
                    type: "coupon_code",
                    coupon_code: lto?.cuponCode,
                  },
                ],
              }, {
                type: "button",
                sub_type: "url",
                index: 1,
                parameters: [
                  {
                    type: "text",
                    text: lto?.urlVariable,
                  },
                ],
              },
              {
                type: "limited_time_offer",
                parameters: [
                  {
                    type: "limited_time_offer",
                    limited_time_offer: {
                      expiration_time_ms:
                          Date.now() + lto?.offerTTLMinutes * 60000,
                    },
                  },
                ],
              },
              ],
            },
        };
    }
}  

export class Reaction {
    _type = 'reaction'
    body: any
    constructor(emoji: string, messageId: string) {
        this.body = {
            type: "reaction",
            reaction: {
              message_id: messageId,
              emoji: emoji,
            },
        }
    }
}

export class Sticker {
    _type = 'sticker'
    body: any
    constructor(url:string) {
        this.body = {
            type: "sticker",
            sticker: {link: url},
        };
    }
}

export type OutgoingMessage =
  | Text
  | Audio
  | Document
  | Image
  | Sticker
  | Video
  | Location
  | Contacts
  | QuickReplies
  | Template
  | Reaction

  export type WhatsAppPayload = {
    object: string
    entry: WhatsAppEntry[]
  }
  
  export type WhatsAppEntry = {
    id: string
    changes: WhatsAppChanges[]
  }
  
  export type WhatsAppChanges = {
    value: WhatsAppValue
    field: string
  }
  
  export type WhatsAppValue = {
    messaging_product: string
    metadata: {
      display_phone_number: string
      phone_number_id: string
    }
    contacts: WhatsAppProfile[]
    messages: WhatsAppMessage[]
  }
  
  export type WhatsAppProfile = {
    profile: {
      name: string
    }
    wa_id: string
  }
  
  export type WhatsAppMessage = {
    from: string
    id: string
    timestamp: string
    text?: {
      body: string
    }
    image?: {
      mime_type: string
      body: string
      sha256: string
      id: string
    }
    button?: {
      payload: string
      text: string
    }
    location?: {
      address: string
      latitude: string
      longitude: string
      name: string
      url: string
    }
    document?: {
      filename: string
      mime_type: string
      sha256: string
      id: string
    }
    audio?: {
      //could be audio file, or voice note
      mime_type: string
      sha256: string
      id: string
      voice: boolean
    }
    errors?: {
      code: number
      title: string
    }
    interactive?: {
      type: string
      button_reply?: {
        id: string
        title: string
      }
      list_reply?: {
        id: string
        title: string
        description: string
      }
    }
    //contacts?: not implemented - long and didn't find a use case for it
    type: string
  }
  