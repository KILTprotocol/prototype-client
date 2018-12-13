import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, withRouter } from 'react-router-dom'

import blockchainService from 'src/services/BlockchainService'
import { ApiPromise } from '@polkadot/api'

import pair from '@polkadot/keyring/pair'
import { stringToU8a, u8aToHex } from '@polkadot/util'
import { keccakAsU8a, naclKeypairFromSeed } from '@polkadot/util-crypto'

import CtypeEditorComponent from './CtypeEditorComponent'

import If from '../../common/If'

type Props = RouteComponentProps<{
  hash?: string
}>

class CtypeComponent extends React.Component<Props, {}> {
  public state = {
    connected: false,
    schema: '{ "title": "My New Schema" }',
  }

  // @ts-ignore
  private api: ApiPromise

  constructor(props: Props) {
    super(props)
    this.submit = this.submit.bind(this)
  }

  public componentDidMount() {
    this.connect()
  }

  public async connect() {
    // TODO: test unmount and host change
    // TODO: test error handling
    this.api = await blockchainService.connect()
    this.setState({ connected: true })
    // @ts-ignore
    window.api = this.api
  }

  public async submit() {
    const seedAlice = 'Alice'.padEnd(32, ' ')
    const { secretKey, publicKey } = naclKeypairFromSeed(stringToU8a(seedAlice))
    const Alice = pair({ publicKey, secretKey })

    const hash = keccakAsU8a(this.state.schema)

    const signature = Alice.sign(hash)
    console.log(`Signature: ${u8aToHex(signature)}`)

    const ctypeAdd = this.api.tx.ctype.add(hash, signature)

    const nonce = await this.api.query.system.accountNonce(Alice.address())
    if (nonce) {
      const signed = ctypeAdd.sign(Alice, nonce.toHex())
      signed
        .send(status => {
          console.log(`current status ${status.type}`)
          console.log(status)
        })
        .then(hash => {
          console.log(`submitted with hash ${hash}`)
        })
    }
  }

  public render() {
    const hash = this.props.match.params.hash
    return (
      <div>
        <h1 className="App-title">Ctype Manager</h1>
        <CtypeEditorComponent
          schema={this.state.schema}
          updateSchema={this.updateSchema}
        />
        <br />
        <button
          disabled={this.state.connected ? false : true}
          onClick={this.submit}
        >
          Submit
        </button>
        <If
          condition={!!hash}
          then={<div>Current hash: {hash}</div>}
          else={
            <ul>
              <li>
                <Link to={'/ctype/123'}>CTYPE 123</Link>
              </li>
              <li>
                <Link to={'/ctype/ABC'}>CTYPE ABC</Link>
              </li>
            </ul>
          }
        />
      </div>
    )
  }

  private updateSchema = (schema: string) => {
    this.setState({
      schema,
    })
  }
}

export default withRouter(CtypeComponent)
