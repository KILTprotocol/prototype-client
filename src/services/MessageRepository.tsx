import { Identity } from '@kiltprotocol/sdk-js'
import {
  IEncryptedMessage,
  IMessage,
  IPublicIdentity,
  IRejectTerms,
  IRequestAttestationForClaim,
  IRequestClaimsForCTypes,
  IRequestTerms,
  ISubmitAttestationForClaim,
  ISubmitClaimsForCTypes,
  ISubmitTerms,
  MessageBody,
  MessageBodyType,
} from '@kiltprotocol/types'
import Message from '@kiltprotocol/messaging'
import cloneDeep from 'lodash/cloneDeep'
import React from 'react'
import { InteractionProps } from 'react-json-view'
import Code from '../components/Code/Code'
import { ModalType } from '../components/Modal/Modal'
import * as UiState from '../state/ducks/UiState'
import * as Wallet from '../state/ducks/Wallet'
import { persistentStoreInstance } from '../state/PersistentStore'
import { IContact, IMyIdentity } from '../types/Contact'
import { ICType } from '../types/Ctype'
import { IBlockingNotification, NotificationType } from '../types/UserFeedback'
import { BaseDeleteParams, BasePostParams } from './BaseRepository'
import ContactRepository from './ContactRepository'
import errorService from './ErrorService'
import FeedbackService, {
  notifyFailure,
  notifySuccess,
} from './FeedbackService'
import filterArray from '../utils/filterArray'

export interface IMessageOutput extends IMessage {
  encryptedMessage: IEncryptedMessage
  sender?: IContact
}

// TODO: add tests, create interface for this class to be implemented as mock
// (for other tests)

class MessageRepository {
  public static readonly URL = `${window._env_.REACT_APP_SERVICE_HOST}/messaging`
  /**
   * takes contact or list of contacts
   * and send a message to every contact in list
   *
   * TODO: combine notifications into a one success and one failure
   *
   * @param receivers
   * @param messageBody
   */
  public static async send(
    receivers: IContact[],
    messageBody: MessageBody
  ): Promise<void> {
    const sender = Wallet.getSelectedIdentity(
      persistentStoreInstance.store.getState()
    )

    if (!sender) {
      throw new Error('No selected Identity')
    }

    const receiversAsArray = Array.isArray(receivers) ? receivers : [receivers]
    const requests = receiversAsArray.reduce(
      (promiseChain, receiver: IContact) => {
        return MessageRepository.singleSend(messageBody, sender, receiver)
      },
      Promise.resolve()
    )
    return requests
  }

  /**
   * takes an address or list of addresses,
   * gets the corresponding Contact (if existent) and initiates message sending
   *
   * @param receiverAddresses
   * @param messageBody
   */
  public static async sendToAddresses(
    receiverAddresses: Array<IContact['publicIdentity']['address']>,
    messageBody: MessageBody
  ): Promise<void> {
    const arrayContacts = receiverAddresses.map(
      (
        receiverAddress: IContact['publicIdentity']['address']
      ): IContact | null => {
        const contact = ContactRepository.findByAddress(receiverAddress)
        if (!contact) {
          notifyFailure(`Could not send message to ${receiverAddress}`, false)
        }
        return contact
      }
    )

    const filteredContacts = arrayContacts.filter(filterArray)

    return MessageRepository.send(filteredContacts, messageBody)
  }

  /**
   * takes a public identity and initiates message sending
   *
   * @param receivers
   * @param messageBody
   */
  public static sendToPublicIdentity(
    receiver: IPublicIdentity,
    messageBody: MessageBody
  ): Promise<void> {
    const receiverContact: IContact = {
      metaData: {
        name: '',
      },
      publicIdentity: receiver,
    }

    return MessageRepository.send([receiverContact], messageBody)
  }

  public static multiSendToAddresses(
    receiverAddresses: Array<IContact['publicIdentity']['address']>,
    messageBodies: MessageBody[]
  ): void {
    messageBodies.map((messageBody: MessageBody) => {
      return MessageRepository.sendToAddresses(receiverAddresses, messageBody)
    })
  }

  public static async deleteByMessageId(
    messageId: string,
    signature: string
  ): Promise<Response> {
    return fetch(`${MessageRepository.URL}/${messageId}`, {
      ...BaseDeleteParams,
      headers: { ...BaseDeleteParams.headers, signature },
    })
  }

  public static async findByMyIdentity(
    myIdentity: Identity
  ): Promise<IMessageOutput[]> {
    return fetch(`${MessageRepository.URL}/inbox/${myIdentity.address}`)
      .then((response) => response.json())
      .then((encryptedMessages: IEncryptedMessage[]) => {
        const decryptedMesssages = encryptedMessages.map(
          (encryptedMessage: IEncryptedMessage) => {
            let sender = ContactRepository.findByAddress(
              encryptedMessage.senderAddress
            )
            try {
              const m = Message.decrypt(encryptedMessage, myIdentity)
              Message.ensureOwnerIsSender(m)
              if (!sender) {
                sender = {
                  metaData: { name: '', unregistered: true },
                  publicIdentity: {
                    address: encryptedMessage.senderAddress,
                    boxPublicKeyAsHex: encryptedMessage.senderBoxPublicKey,
                  },
                }
              }

              return {
                ...m,
                encryptedMessage,
                sender,
              }
            } catch (error) {
              errorService.log({
                error,
                message: `error on decrypting message: 
                    ${JSON.stringify(encryptedMessage)}`,
                origin: 'MessageRepository.findByMyIdentity()',
              })
              return undefined
            }
          }
        )
        return (
          decryptedMesssages
            .filter(filterArray)
            // TODO: check message structure via SDK
            .filter(
              (message) =>
                message.body.type !==
                  MessageBodyType.REQUEST_CLAIMS_FOR_CTYPES ||
                Array.isArray(message.body.content)
            )
        )
      })
  }

  public static async dispatchMessage(
    message: IEncryptedMessage
  ): Promise<Response> {
    const response = await fetch(`${MessageRepository.URL}`, {
      ...BasePostParams,
      body: JSON.stringify(message),
    })
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    return response
  }

  public static async singleSend(
    messageBody: MessageBody,
    sender: IMyIdentity,
    receiver: IContact
  ): Promise<void> {
    try {
      let message: Message = new Message(
        messageBody,
        sender.identity.getPublicIdentity(),
        receiver.publicIdentity
      )

      message = await MessageRepository.handleDebugMode(message)

      return MessageRepository.dispatchMessage(
        message.encrypt(sender.identity, receiver.publicIdentity)
      )
        .then(() => {
          notifySuccess(
            `Message '${messageBody.type}' to receiver ${
              receiver.metaData.name || receiver.publicIdentity.address
            } successfully sent.`
          )
        })
        .catch((error) => {
          errorService.logWithNotification({
            error,
            message: `Could not send message '${messageBody.type}' to receiver '${receiver.metaData.name}'`,
            origin: 'MessageRepository.singleSend()',
            type: 'ERROR.FETCH.POST',
          })
        })
    } catch (error) {
      errorService.log({
        error,
        message: `Could not create message '${messageBody.type}' to receiver '${receiver.metaData.name}'`,
        origin: 'MessageRepository.singleSend()',
      })
      return Promise.reject()
    }
  }

  public static getCTypeHashes(
    message: IMessageOutput
  ): Array<ICType['cType']['hash']> {
    const { body } = message
    const { type } = body

    switch (type) {
      case MessageBodyType.REQUEST_TERMS:
        return [(message.body as IRequestTerms).content.cTypeHash]
      case MessageBodyType.SUBMIT_TERMS:
        return [(message.body as ISubmitTerms).content.claim.cTypeHash]
      case MessageBodyType.REJECT_TERMS:
        return [(message.body as IRejectTerms).content.claim.cTypeHash]

      case MessageBodyType.REQUEST_ATTESTATION_FOR_CLAIM:
        return [
          (message.body as IRequestAttestationForClaim).content
            .requestForAttestation.claim.cTypeHash,
        ]
      case MessageBodyType.SUBMIT_ATTESTATION_FOR_CLAIM:
        return [
          (message.body as ISubmitAttestationForClaim).content.attestation
            .cTypeHash,
        ]

      case MessageBodyType.REQUEST_CLAIMS_FOR_CTYPES:
        return (message.body as IRequestClaimsForCTypes).content
          .map((val) => val.cTypeHash)
          .filter(Boolean)
      case MessageBodyType.SUBMIT_CLAIMS_FOR_CTYPES: {
        const cTypeHashes = (
          message.body as ISubmitClaimsForCTypes
        ).content.map((attestedClaim) => attestedClaim.request.claim.cTypeHash)
        const uniqueCTypeHashes: Array<ICType['cType']['hash']> =
          cTypeHashes.filter(
            (cTypeHash: ICType['cType']['hash'], index: number) =>
              cTypeHashes.indexOf(cTypeHash) === index
          )
        return uniqueCTypeHashes
      }

      case MessageBodyType.REJECT_ATTESTATION_FOR_CLAIM:
      case MessageBodyType.REQUEST_ACCEPT_DELEGATION:
      case MessageBodyType.SUBMIT_ACCEPT_DELEGATION:
      case MessageBodyType.REJECT_ACCEPT_DELEGATION:
      case MessageBodyType.INFORM_CREATE_DELEGATION:
        return []

      default:
        return []
    }
  }

  private static async handleDebugMode(message: Message): Promise<Message> {
    const debugMode = UiState.getDebugMode(
      persistentStoreInstance.store.getState()
    )

    let manipulatedMessage = cloneDeep(message)

    if (debugMode) {
      return new Promise<Message>((resolve) => {
        FeedbackService.addBlockingNotification({
          header: 'Manipulate your message before sending',
          message: (
            <Code
              onEdit={(edit: InteractionProps) => {
                manipulatedMessage = edit.updated_src as Message
              }}
              onAdd={(add: InteractionProps) => {
                manipulatedMessage = add.updated_src as Message
              }}
            >
              {message}
            </Code>
          ),
          modalType: ModalType.CONFIRM,
          okButtonLabel: 'Send manipulated Message',
          onCancel: (notification: IBlockingNotification) => {
            notification.remove()
            return resolve(message)
          },
          onConfirm: (notification: IBlockingNotification) => {
            notification.remove()
            return resolve(manipulatedMessage)
          },
          type: NotificationType.INFO,
        })
      })
    }
    return message
  }

  private static handleMultiAddressErrors(errors: Error[]): void {
    if (errors.length) {
      notifyFailure(
        `Could not send message to ${
          errors.length > 1 ? 'these addresses' : 'this address'
        }: ${errors.join(', ')}`,
        false
      )
    }
  }
}

export default MessageRepository
