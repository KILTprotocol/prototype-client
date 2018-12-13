import * as mnemonic from '@polkadot/util-crypto/mnemonic'
import * as React from 'react'
import { connect } from 'react-redux'
import { RouteComponentProps } from 'react-router'
import { withRouter } from 'react-router-dom'
import { Button, Input } from 'semantic-ui-react'

import WalletRedux, {
  WalletAction,
  WalletState,
  WalletStateEntry,
} from '../../state/ducks/WalletRedux'
import Identity from '../../types/Identity'
import IdentityViewComponent from './IdentityViewComponent'

type Props = RouteComponentProps<{}> & {
  saveIdentity: (alias: string, identity: Identity) => void
  removeIdentity: (seedAsHex: string) => void
  identities: WalletStateEntry[]
}
type State = {
  randomPhrase: string
  alias: string
}

class WalletComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      alias: '',
      randomPhrase: mnemonic.mnemonicGenerate(),
    }
  }

  public render() {
    const identities = this.props.identities.map((entry: WalletStateEntry) => (
      <IdentityViewComponent
        key={entry.identity.seedAsHex}
        identity={entry.identity}
        alias={entry.alias}
        onDelete={this.removeIdentity}
      />
    ))

    return (
      <div>
        <h1>Wallet</h1>
        <hr />
        <h3>Add new identity from phrase</h3>
        <h4>(duplicates not permitted)</h4>
        <Input
          type="text"
          value={this.state.randomPhrase}
          onChange={this.setRandomPhrase}
        />
        <Button onClick={this.createRandomPhrase}>create random phrase</Button>
        <br />
        <Input
          type="text"
          placeholder="Name"
          value={this.state.alias}
          onChange={this.setAlias}
        />
        <Button onClick={this.addIdentity}>Add</Button>
        <hr />
        {identities}
      </div>
    )
  }

  private addIdentity = () => {
    const identity = new Identity(this.state.randomPhrase)

    // TODO: move to service and or effect
    fetch('http://localhost:3000/contacts', {
      body: JSON.stringify({
        key: identity.publicKeyAsHex,
        name: this.state.alias,
      }),
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      method: 'POST',
      mode: 'cors',
    }).then(
      response => {
        this.props.saveIdentity(this.state.alias, identity)
        this.createRandomPhrase()
      },
      error => {
        console.error('failed to POST new identity', error)
      }
    )
  }

  private createRandomPhrase = () => {
    this.setState({ randomPhrase: mnemonic.mnemonicGenerate() })
  }

  private setRandomPhrase = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ randomPhrase: e.currentTarget.value })
  }

  private setAlias = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ alias: e.currentTarget.value })
  }

  private removeIdentity = (seedAsHex: string) => {
    this.props.removeIdentity(seedAsHex)
  }
}

const mapStateToProps = (state: { wallet: WalletState }) => {
  return {
    identities: state.wallet
      .get('identities')
      .toList()
      .toArray(),
  }
}

const mapDispatchToProps = (dispatch: (action: WalletAction) => void) => {
  return {
    removeIdentity: (seedAsHex: string) => {
      dispatch(WalletRedux.removeIdentityAction(seedAsHex))
    },
    saveIdentity: (alias: string, identity: Identity) => {
      dispatch(WalletRedux.saveIdentityAction(alias, identity))
    },
  }
}

export default withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(WalletComponent)
)
