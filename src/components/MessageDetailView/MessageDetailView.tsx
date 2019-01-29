import React from 'react'

import { Message } from '../../types/Message'
import Code from '../Code/Code'
import MessageWorkflowBuilder from './MessageWorkflowBuilder'

import './MessageDetailView.scss'

type Props = {
  message: Message
  onDelete: (message: Message) => void
  onCancel: (id: string) => void
}

type State = {}

class MessageDetailView extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.handleDelete = this.handleDelete.bind(this)
    this.handleCancel = this.handleCancel.bind(this)
  }

  public render() {
    const { message, children } = this.props
    return (
      <section className="MessageDetailView">
        <h4>Subject: {message.body ? message.body.type : message.message}</h4>
        {MessageWorkflowBuilder.shouldDisplayContentAsCode(message) && (
          <div>
            Contents:{' '}
            {message.body ? (
              <Code>{message.body.content}</Code>
            ) : (
              message.message
            )}
          </div>
        )}
        <div className="workflow">
          {MessageWorkflowBuilder.fromMessage(message, this.handleDelete)}
        </div>
        <footer>
          {children}
          <button className="cancel" onClick={this.handleCancel}>
            Cancel
          </button>
          <button className="delete" onClick={this.handleDelete}>
            Delete
          </button>
        </footer>
      </section>
    )
  }

  private getWorkflow(): ReactNode | undefined {
    const { message } = this.props

    if (!message || !message.body || !message.body.content) {
      return undefined
    }

    const messageBodyType: MessageBodyType | undefined =
      message && message.body && message.body.type

    switch (messageBodyType) {
      case MessageBodyType.REQUEST_CLAIM_FOR_CTYPE:
        return (
          <ChooseClaimForCtype
            senderAddress={message.senderAddress}
            ctypeKey={(message.body as RequestClaimForCtype).content.key}
            onFinished={this.handleDelete}
          />
        )
      case MessageBodyType.REQUEST_ATTESTATION_FOR_CLAIM:
        return (
          <AttestClaim
            senderAddress={message.senderAddress}
            claim={
              ((message.body as RequestAttestationForClaim)
                .content as ClaimMessageBodyContent).claim
            }
            ctypeName={
              ((message.body as RequestAttestationForClaim)
                .content as ClaimMessageBodyContent).cType.name
            }
            onFinished={this.handleDelete}
          />
        )
      case MessageBodyType.APPROVE_ATTESTATION_FOR_CLAIM:
        return (
          <ImportAttestation
            claim={(message.body as ApproveAttestationForClaim).content.claim}
            attestation={
              (message.body as ApproveAttestationForClaim).content.attestation
            }
            onFinished={this.handleDelete}
          />
        )
      default:
        return undefined
    }
  }

  private handleDelete() {
    const { message, onDelete } = this.props
    if (message && onDelete) {
      onDelete(message)
    }
  }

  private handleCancel() {
    const { message, onCancel } = this.props
    if (message && message.messageId && onCancel) {
      onCancel(message.messageId)
    }
  }
}

export default MessageDetailView
