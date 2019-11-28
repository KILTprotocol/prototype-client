import * as sdk from '@kiltprotocol/sdk-js'
import * as React from 'react'
import { connect } from 'react-redux'
import { RouteComponentProps, withRouter } from 'react-router'
import { Link } from 'react-router-dom'

import ContactPresentation from '../../components/ContactPresentation/ContactPresentation'
import CTypePresentation from '../../components/CTypePresentation/CTypePresentation'
import CTypeRepository from '../../services/CtypeRepository'
import delegationService from '../../services/DelegationsService'
import * as Wallet from '../../state/ducks/Wallet'
import { State as ReduxState } from '../../state/PersistentStore'
import { ICType } from '../../types/Ctype'
import Spinner from '../../components/Spinner/Spinner'
import FeedbackService, {
  notifySuccess,
  notifyError,
} from '../../services/FeedbackService'
import { BlockUi } from '../../types/UserFeedback'

import './DelegationCreate.scss'

type Props = RouteComponentProps<{
  cTypeHash: sdk.ICType['hash']
}> & {
  isPCR: boolean

  selectedIdentity?: Wallet.Entry
}

type State = {
  alias: string
  delegation?: sdk.DelegationRootNode
}

class DelegationCreate extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      alias: '',
    }
    this.handleNameChange = this.handleNameChange.bind(this)
    this.submit = this.submit.bind(this)
  }

  public componentDidMount() {
    const ctypeHash = this.props.match.params.cTypeHash
    const { selectedIdentity } = this.props
    const { alias } = this.state
    if (selectedIdentity) {
      this.setState({
        alias,
        delegation: new sdk.DelegationRootNode(
          sdk.UUID.generate(),
          ctypeHash,
          selectedIdentity.identity.address
        ),
      })
    }
  }

  public render() {
    const { isPCR } = this.props
    const ctypeHash = this.props.match.params.cTypeHash
    const { alias, delegation } = this.state
    return (
      <section className="DelegationCreate">
        <h1>{isPCR ? `New Root PCR` : `New Root Delegation`}</h1>
        {delegation ? (
          <React.Fragment>
            <div className="Delegation-base">
              <div>
                <label>Alias</label>
                <input type="text" onChange={this.handleNameChange} />
              </div>
              <div>
                <label>Id</label>
                <div>{delegation.id}</div>
              </div>
              <div>
                <label>CTYPE</label>
                <div>
                  <CTypePresentation
                    cTypeHash={ctypeHash}
                    interactive={true}
                    linked={true}
                  />
                </div>
              </div>
              <div>
                <label>Account</label>
                <div>
                  <ContactPresentation
                    address={delegation.account}
                    interactive={true}
                  />
                </div>
              </div>
            </div>
            <div className="actions">
              <Link to={`/${isPCR ? 'pcrs' : 'delegations'}`}>Cancel</Link>
              <button
                className="submit-delegation"
                disabled={alias.length === 0}
                onClick={this.submit}
              >
                Submit
              </button>
            </div>
          </React.Fragment>
        ) : (
          <Spinner />
        )}
      </section>
    )
  }

  private handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      alias: e.target.value.trim(),
    })
  }

  private submit(): void {
    const { history, isPCR } = this.props
    const { delegation, alias } = this.state

    if (delegation) {
      const blockUi: BlockUi = FeedbackService.addBlockUi({
        headline: `Creating ${isPCR ? 'Root PCR' : 'Root Delegation'}`,
      })

      delegationService
        .storeRoot(delegation, alias, isPCR)
        .then(() => {
          blockUi.remove()
          notifySuccess(`${isPCR ? 'PCR' : 'Delegation'} successfully created`)
          history.push(isPCR ? '/pcrs' : '/delegations')
        })
        .catch(error => {
          blockUi.remove()
          notifyError(error)
        })
    }
  }
}

const mapStateToProps = (state: ReduxState) => ({
  selectedIdentity: Wallet.getSelectedIdentity(state),
})

export default connect(mapStateToProps)(withRouter(DelegationCreate))
