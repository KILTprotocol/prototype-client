import * as React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'

import WalletComponent from './wallet/WalletComponent'

import ChainStatsComponent from './chainStats/ChainStatsComponent'
import ContactListComponent from './contacts/ContactListComponent'
import CtypeCreateComponent from './ctype/CtypeCreateComponent'
import CtypeManagerComponent from './ctype/CtypeManagerComponent'

import ClaimCreate from './claim/ClaimCreate'
import ClaimList from './claim/ClaimList'

import MessageListComponent from './messages/MessageListComponent'
import RootComponent from './root/RootComponent'

const Routes: React.FunctionComponent<{}> = props => {
  // const bbqBirch = encodeURIComponent('wss://substrate-rpc.parity.io/')

  const nodeWebsocketUrl = getNodeWsAddress()

  function getNodeWsAddress() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${protocol}://${process.env.REACT_APP_NODE_HOST}:${
      process.env.REACT_APP_NODE_WS_PORT
    }`
  }

  return (
    <Switch>
      <Route path={'/wallet'} component={WalletComponent} />
      <Route path={'/chain-stats/:host'} component={ChainStatsComponent} />
      <Route
        path={'/chain-stats'}
        children={
          <Redirect
            to={`/chain-stats/${encodeURIComponent(nodeWebsocketUrl)}`}
          />
        }
      />
      <Route path={'/ctype/new'} component={CtypeCreateComponent} />
      <Route path={'/ctype/:ctypeKey'} component={CtypeManagerComponent} />
      <Route path={'/ctype'} component={CtypeManagerComponent} />

      <Route path="/claim/new/:ctypeKey" component={ClaimCreate} />
      <Route path="/claim" component={ClaimList} />

      <Route path={'/contacts'} component={ContactListComponent} />
      <Route path={'/messages'} component={MessageListComponent} />
      <Route component={RootComponent} />
    </Switch>
  )
}

export default Routes
