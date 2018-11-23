

import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { withRouter } from 'react-router-dom'
import Identity from 'src/types/Identity'

type Props = {
  identity: Identity
  onDelete: (seedAsHex: string) => void
} & RouteComponentProps<{}>

class IdentityViewComponent extends React.Component<Props, {}> {

  constructor(props: Props) {
    super(props)
  }

  public render() {
    const { identity } = this.props

    return (
      <div style={{ borderBottom: '1px solid grey', padding: '1rem' }}>
        <ul>
          <li>Phrase: {identity.phrase}</li>
          <li>Seed (as hex): {identity.seedAsHex}</li>
          <li>Public Key: {identity.publicKey}</li>
          <li><button onClick={this.onDelete}>Remove</button></li>
        </ul>
      </div>
    )
  }

  private onDelete = () => {
    this.props.onDelete(this.props.identity.seedAsHex)
  }
}

export default withRouter(IdentityViewComponent)
