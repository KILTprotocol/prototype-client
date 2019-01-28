import { Identity } from '@kiltprotocol/prototype-sdk'
import { EncryptedAsymmetricString } from '@kiltprotocol/prototype-sdk/build/crypto/Crypto'
import PersistentStore from '../state/PersistentStore'

import { Contact, MyIdentity } from '../types/Contact'
import { Message, MessageBody } from '../types/Message'
import { BaseDeleteParams, BasePostParams } from './BaseRepository'
import ContactRepository from './ContactRepository'
import ErrorService from './ErrorService'

// TODO: add tests, create interface for this class to be implemented as mock
// (for other tests)

class MessageRepository {
  public static async findByMessageId(
    messageId: string,
    myIdentity: Identity
  ): Promise<Message> {
    return fetch(
      `${MessageRepository.URL}/inbox/${
        myIdentity.signPublicKeyAsHex
      }/${messageId}`
    )
      .then(response => response.json())
      .then(message => MessageRepository.decryptMessage(message, myIdentity))
  }

  public static async findByMyIdentity(
    myIdentity: Identity
  ): Promise<Message[]> {
    return fetch(`${MessageRepository.URL}/inbox/${myIdentity.address}`)
      .then(response => response.json())
      .then(async (messages: Message[]) => {
        await ContactRepository.findAll()
        return messages
      })
      .then((messages: Message[]) => {
        for (const message of messages) {
          MessageRepository.decryptMessage(message, myIdentity)
        }
        return messages
      })
  }

  public static async findByMyIdentities(
    myIdentities: Identity[]
  ): Promise<Message[]> {
    return Promise.reject('implement')
  }

  public static async send(
    receiver: Contact,
    messageBody: MessageBody
  ): Promise<Message> {
    try {
      const sender: MyIdentity = PersistentStore.store.getState().wallet
        .selectedIdentity
      const encryptedMessage: EncryptedAsymmetricString = sender.identity.encryptAsymmetricAsStr(
        JSON.stringify(messageBody),
        receiver.publicIdentity.boxPublicKeyAsHex
      )
      const messageObj: Message = {
        message: encryptedMessage.box,
        nonce: encryptedMessage.nonce,
        receiverAddress: receiver.publicIdentity.address,
        senderAddress: sender.identity.address,
      }
      return fetch(`${MessageRepository.URL}`, {
        ...BasePostParams,
        body: JSON.stringify(messageObj),
      }).then(response => response.json())
    } catch (error) {
      ErrorService.log({
        error,
        message: 'error just before sending messageBody',
        origin: 'MessageRepository.send()',
      })
      return Promise.reject()
    }
  }

  public static async deleteByMessageId(messageId: string) {
    return fetch(`${MessageRepository.URL}/${messageId}`, {
      ...BaseDeleteParams,
    })
  }

  private static readonly URL = `${process.env.REACT_APP_SERVICE_HOST}:${
    process.env.REACT_APP_SERVICE_PORT
  }/messaging`

  private static decryptMessage(
    message: Message,
    myIdentity: Identity
  ): Message {
    const ea: EncryptedAsymmetricString = {
      box: message.message,
      nonce: message.nonce,
    }
    const sender: Contact | undefined = ContactRepository.findByAddress(
      message.senderAddress
    )

    if (sender) {
      const decoded: string | false = myIdentity.decryptAsymmetricAsStr(
        ea,
        sender.publicIdentity.boxPublicKeyAsHex
      )
      if (!decoded) {
        message.message = 'ERROR DECODING MESSAGE'
        const errorMessage = `Could not decode message ${message.messageId}`
        ErrorService.log(
          {
            error: { name: 'ERROR DECODING MESSAGE', message: errorMessage },
            message: errorMessage,
            origin: 'MessageRepository.decryptMessage()',
          },
          { blocking: false }
        )
      } else {
        message.message = decoded
      }
      try {
        message.body = JSON.parse(message.message)
      } catch (error) {
        ErrorService.log(
          {
            error,
            message: `Could not parse message body of message ${
              message.messageId
            } ($m.message)`,
            origin: 'MessageRepository.decryptMessage()',
          },
          { blocking: false }
        )
      }
    } else {
      ErrorService.log({
        error: new Error(),
        message: 'Could not retrieve claimer from local contact list',
        origin: 'MessageRepository.decryptMessage()',
      })
    }

    return message
  }
}

export default MessageRepository
