import * as React from 'react'

import Select, { createFilter } from 'react-select'
import { Config } from 'react-select/lib/filters'
import KiltIdenticon from '../../components/KiltIdenticon/KiltIdenticon'
import Modal, { ModalType } from '../../components/Modal/Modal'

import contactRepository from '../../services/ContactRepository'
import CtypeRepository from '../../services/CtypeRepository'
import errorService from '../../services/ErrorService'
import FeedbackService, { notifySuccess } from '../../services/FeedbackService'
import MessageRepository from '../../services/MessageRepository'
import { Contact } from '../../types/Contact'
import { ICType } from '../../types/Ctype'
import { MessageBodyType, RequestClaimForCtype } from '../../types/Message'
import { BlockUi } from '../../types/UserFeedback'

import './ContactList.scss'

interface Props {}

interface State {
  contacts: Contact[]
  ctypes: ICType[]
}

type SelectOption = {
  value: string
  label: string
}

class ContactList extends React.Component<Props, State> {
  private selectCtypeModal: Modal | null
  private selectedCtype: ICType | undefined
  private selectedContact: Contact | undefined
  private filterConfig: Config = {
    ignoreAccents: true,
    ignoreCase: true,
    matchFrom: 'any',
    trim: true,
  }

  constructor(props: Props) {
    super(props)
    this.state = {
      contacts: [],
      ctypes: [],
    }
    this.onCancelRequestClaim = this.onCancelRequestClaim.bind(this)
    this.onFinishRequestClaim = this.onFinishRequestClaim.bind(this)
    this.onRequestClaimForVerification = this.onRequestClaimForVerification.bind(
      this
    )
    this.onSelectCtype = this.onSelectCtype.bind(this)
  }

  public componentDidMount() {
    contactRepository
      .findAll()
      .then((contacts: Contact[]) => {
        this.setState({ contacts })
      })
      .catch(error => {
        errorService.log({
          error,
          message: 'Could not fetch contacts',
          origin: 'ContactList.componentDidMount()',
          type: 'ERROR.FETCH.GET',
        })
      })
    CtypeRepository.findAll()
      .then((ctypes: ICType[]) => {
        this.setState({ ctypes })
      })
      .catch(error => {
        errorService.log({
          error,
          message: 'Could not fetch CTYPEs',
          origin: 'ContactList.componentDidMount()',
          type: 'ERROR.FETCH.GET',
        })
      })
  }

  public render() {
    const { contacts } = this.state
    return (
      <section className="ContactList">
        <h1>Contacts</h1>
        <table>
          <thead>
            <tr>
              <th className="name">Name</th>
              <th className="address">Address</th>
              <th className="actionTd" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact: Contact) => (
              <tr key={contact.publicIdentity.address}>
                <td className="name">
                  <KiltIdenticon contact={contact} />
                </td>
                <td className="address" title={contact.publicIdentity.address}>
                  {contact.publicIdentity.address}
                </td>
                <td className="actionTd">
                  <div className="actions">
                    <button
                      className="requestClaimBtn"
                      title="Request claim for verification"
                      onClick={this.onRequestClaimForVerification(contact)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Modal
          ref={el => {
            this.selectCtypeModal = el
          }}
          type={ModalType.CONFIRM}
          header="Select CTYPE"
          onCancel={this.onCancelRequestClaim}
          onConfirm={this.onFinishRequestClaim}
        >
          {this.getSelectCtypes()}
        </Modal>
      </section>
    )
  }

  private getSelectCtypes() {
    const { ctypes } = this.state

    const options: SelectOption[] = ctypes.map((ctype: ICType) => ({
      label: ctype.name,
      value: ctype.key,
    }))
    return (
      <Select
        className="react-select-container"
        classNamePrefix="react-select"
        isClearable={true}
        isSearchable={true}
        isDisabled={false}
        isMulti={false}
        isRtl={false}
        closeMenuOnSelect={true}
        name="selectCtypes"
        options={options}
        onChange={this.onSelectCtype}
        filterOption={createFilter(this.filterConfig)}
      />
    )
  }

  private onSelectCtype(selectedOption: SelectOption) {
    const { ctypes } = this.state

    this.selectedCtype = ctypes.find(
      (ctype: ICType) => selectedOption.value === ctype.key
    )
  }

  private onCancelRequestClaim() {
    this.selectedCtype = undefined
  }

  private onFinishRequestClaim() {
    if (this.selectedContact && this.selectedCtype) {
      const blockUi: BlockUi = FeedbackService.addBlockUi({
        headline: 'Sending Message',
      })
      const request: RequestClaimForCtype = {
        content: this.selectedCtype,
        type: MessageBodyType.REQUEST_CLAIM_FOR_CTYPE,
      }

      MessageRepository.send(this.selectedContact, request)
        .then(() => {
          blockUi.remove()
          notifySuccess('Request Claims successfully sent.')
        })
        .catch(error => {
          blockUi.remove()
          errorService.log({
            error,
            message: `Could not send message ${request.type} to ${
              this.selectedContact!.metaData.name
            }`,
            origin: 'ContactList.onFinishRequestClaim()',
            type: 'ERROR.FETCH.POST',
          })
        })
    }
  }

  private onRequestClaimForVerification = (
    contact?: Contact
  ): (() => void) => () => {
    this.selectedContact = contact
    if (this.selectCtypeModal) {
      this.selectCtypeModal.show()
    }
  }
}

export default ContactList
