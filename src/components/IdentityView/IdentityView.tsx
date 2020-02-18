import * as React from 'react'
import { connect } from 'react-redux'
import ContactRepository from '../../services/ContactRepository'
import errorService from '../../services/ErrorService'
import { notifySuccess } from '../../services/FeedbackService'
import * as Balances from '../../state/ducks/Balances'
import * as Contacts from '../../state/ducks/Contacts'
import * as Wallet from '../../state/ducks/Wallet'
import DidDocumentView from '../../containers/DidDocumentView/DidDocumentView'
import PersistentStore, {
  State as ReduxState,
} from '../../state/PersistentStore'
import { Contact, MyIdentity } from '../../types/Contact'
import ContactPresentation from '../ContactPresentation/ContactPresentation'

import './IdentityView.scss'
import MessageRepository from '../../services/MessageRepository'
import { Identity } from '@kiltprotocol/sdk-js'
import QRCodePublicIdentity from '../QRCodePublicIdentity/QRCodePublicIdentity'

type Props = {
  // input
  myIdentity: MyIdentity
  selected: boolean
  // output
  onDelete?: (address: MyIdentity['identity']['address']) => void
  onSelect?: (seedAsHex: MyIdentity['identity']['address']) => void
  onCreateDid?: (identity: MyIdentity) => void
  onDeleteDid?: (identity: MyIdentity) => void
  // mapStateToProps
  contacts: Contact[]
}

type State = {
  showPublicIdentityQRCode: boolean
}

const FAUCET_URL = process.env.REACT_APP_FAUCET_URL

class IdentityView extends React.Component<Props, State> {

  constructor(props: Props) {
    super(props)
    this.registerContact = this.registerContact.bind(this)
    this.toggleContacts = this.toggleContacts.bind(this)
    this.openKiltFaucet = this.openKiltFaucet.bind(this)
    this.state = {
      showPublicIdentityQRCode: false
    }
    this.togglePublicIdentityQRCode = this.togglePublicIdentityQRCode.bind(this)
  }

  private togglePublicIdentityQRCode() {
    const { showPublicIdentityQRCode } = this.state
    this.setState({
      showPublicIdentityQRCode: !showPublicIdentityQRCode,
    })
  }

  public render() {
    const {
      contacts,
      myIdentity,
      selected,
      onDelete,
      onSelect,
      onCreateDid,
      onDeleteDid,
    } = this.props
    const { showPublicIdentityQRCode } = this.state
    const { metaData, phrase, did, identity } = myIdentity
    const contact: Contact | undefined = contacts.find(
      (myContact: Contact) =>
        myContact.publicIdentity.address === myIdentity.identity.address
    )

    let balance: number = 0
    if (contact) {
      balance = Balances.getBalance(
        PersistentStore.store.getState(),
        contact.publicIdentity.address
      )
    }
    const classes = ['IdentityView', selected ? 'selected' : '']
    const publicIdentityWithServiceAddress = {...identity.getPublicIdentity(), serviceAddress: MessageRepository.URL}
    const togglePublicIdentityQRCodeButtonTxt = `${showPublicIdentityQRCode ? "Hide" : "Show"} QR Code`
    return (
      <section className={classes.join(' ')}>
        {selected && <h2>Active identity</h2>}
        <ContactPresentation address={identity.address} size={50} />
        <div className="attributes">
          <div>
            <label>Alias</label>
            <div>{metaData.name}</div>
          </div>
          <div>
            <label>Phrase</label>
            <div>{phrase}</div>
          </div>
          <div>
            <label>KILT Address</label>
            <div>{identity.address}</div>
          </div>
          <div>
            <label>Seed (as hex)</label>
            <div>{identity.seedAsHex}</div>
          </div>
          <div>
            <label>Public Key</label>
            <div>{identity.signPublicKeyAsHex}</div>
          </div>
          <div>
            <label>Encryption Public Key</label>
            <div>{identity.boxPublicKeyAsHex}</div>
          </div>
          <div>
            <label>Public identity (scan to send a message)</label>
            <div>
              <div>
                <button className="QRCodeToggle" onClick={this.togglePublicIdentityQRCode}>
                  {togglePublicIdentityQRCodeButtonTxt}
                </button>
                {
                  showPublicIdentityQRCode &&
                  <div className="QRCode">
                    <QRCodePublicIdentity publicIdentity={publicIdentityWithServiceAddress}/>
                  </div>
                }
              </div>
            </div>
          </div>
          <div>
            <label>{myIdentity.did ? 'DID Document' : 'DID'}</label>
            <div>
              {did?.document ? (
                <span className="did">
                  <DidDocumentView didDocument={did.document}>
                    {did.identifier}
                  </DidDocumentView>
                </span>
              ) : (
                <>
                  <div>No DID is attached to this identity.</div>
                </>
              )}
            </div>
          </div>
        </div>
        <span className="actions" />
        <div className="actions">
          {onCreateDid && !did && (
            <button
              title="Generate DID..."
              onClick={onCreateDid.bind(this, myIdentity)}
            >
              Register DID
            </button>
          )}
          {onDeleteDid && did && (
            <button
              title="Delete DID"
              onClick={onDeleteDid.bind(this, myIdentity)}
            >
              Delete DID
            </button>
          )}
          {(!contact || (contact && contact.metaData.unregistered)) && (
            <button onClick={this.registerContact}>
              Register Global Contact
            </button>
          )}
          <button
            className={`toggleContacts ${
              contact && contact.metaData.addedAt
                ? 'isMyContact'
                : 'isNotMyContact'
            }`}
            onClick={this.toggleContacts}
            title={
              contact && contact.metaData.addedAt
                ? 'Remove from Favourite Contact'
                : 'Add to Favourite Contact'
            }
          >
            {contact && contact.metaData.addedAt
              ? 'Unfavourize Contact'
              : 'Favourize Contact'}
          </button>
          <span />
        </div>
        <div className="actions">
          {!selected && (
            <>
              {onDelete && (
                <button
                  onClick={onDelete.bind(this, myIdentity.identity.address)}
                  disabled={selected}
                >
                  Remove
                </button>
              )}
              {onSelect && (
                <button
                  onClick={onSelect.bind(this, myIdentity.identity.address)}
                  disabled={selected}
                >
                  Select
                </button>
              )}
            </>
          )}

          {!(balance > 0) && (
            <button
              className="requestTokens"
              onClick={this.openKiltFaucet(myIdentity.identity.address)}
              title="Request Tokens"
            >
              Request Tokens
            </button>
          )}
        </div>
      </section>
    )
  }

  private registerContact() {
    const { myIdentity } = this.props
    const { identity, metaData } = myIdentity
    const { address, boxPublicKeyAsHex } = identity
    const { name } = metaData

    const contact: Contact = {
      metaData: { name },
      publicIdentity: {
        address,
        boxPublicKeyAsHex,
        serviceAddress: `${MessageRepository.URL}`,
      },
    }

    ContactRepository.add(contact).then(
      () => {
        notifySuccess(`Identity '${name}' successfully registered.`)
      },
      error => {
        errorService.log({
          error,
          message: `Failed to register identity '${name}'`,
          origin: 'IdentityView.registerContact()',
          type: 'ERROR.FETCH.POST',
        })
      }
    )
  }

  private openKiltFaucet(address: Identity['address']) {
    return () => {
      window.open(FAUCET_URL + '?' + address, '_blank')
    }
  }

  private toggleContacts() {
    const { contacts, myIdentity } = this.props
    let contact = contacts.find(
      (myContact: Contact) =>
        myContact.publicIdentity.address === myIdentity.identity.address
    )

    if (!contact) {
      contact = ContactRepository.getContactFromIdentity(myIdentity, {
        unregistered: true,
      })
    }

    const { metaData, publicIdentity } = contact

    if (contact.metaData.addedAt) {
      PersistentStore.store.dispatch(
        Contacts.Store.removeMyContact(publicIdentity.address)
      )
    } else {
      const myContact = {
        metaData: {
          ...metaData,
          addedAt: Date.now(),
          addedBy: Wallet.getSelectedIdentity(PersistentStore.store.getState())
            .identity.address,
        },
        publicIdentity,
      } as Contact

      PersistentStore.store.dispatch(Contacts.Store.addContact(myContact))
    }
  }
}

const mapStateToProps = (state: ReduxState) => ({
  contacts: Contacts.getContacts(state),
})

export default connect(mapStateToProps)(IdentityView)
