import { Permission } from '@kiltprotocol/types'
import isEqual from 'lodash/isEqual'
import React from 'react'
import { connect, MapStateToProps } from 'react-redux'
import { RouteComponentProps, withRouter } from 'react-router'

import { ViewType } from '../../components/DelegationNode/DelegationNode'
import DelegationDetailView from '../../components/DelegationDetailView/DelegationDetailView'
import SelectCTypesModal from '../../components/Modal/SelectCTypesModal'
import MyDelegationsListView from '../../components/MyDelegationsListView/MyDelegationsListView'
import { safeDelete } from '../../services/FeedbackService'
import * as Delegations from '../../state/ducks/Delegations'
import { IMyDelegation } from '../../state/ducks/Delegations'
import * as Wallet from '../../state/ducks/Wallet'
import { State as ReduxState } from '../../state/PersistentStore'
import { IMyIdentity } from '../../types/Contact'
import { ICTypeWithMetadata } from '../../types/Ctype'

import './DelegationsView.scss'

type StateProps = {
  delegationEntries: IMyDelegation[]
  selectedIdentity?: IMyIdentity
}

type DispatchProps = {
  removeDelegation: (delegation: IMyDelegation) => void
}

type OwnProps = {
  isPCR: boolean
}

type Props = StateProps &
  DispatchProps &
  OwnProps &
  RouteComponentProps<{ delegationId: string }>

type State = {
  delegationEntries: IMyDelegation[]

  currentDelegation?: IMyDelegation
  invitePermissions?: Permission[]
}

class DelegationsView extends React.Component<Props, State> {
  private selectCTypesModal: React.RefObject<SelectCTypesModal>

  constructor(props: Props) {
    super(props)
    this.state = {
      delegationEntries: [],
    }

    this.deleteDelegation = this.deleteDelegation.bind(this)
    this.createDelegation = this.createDelegation.bind(this)
    this.onSelectCType = this.onSelectCType.bind(this)
    this.selectCTypesModal = React.createRef()
  }

  public componentDidMount(): void {
    const { delegationEntries, match } = this.props
    const { params } = match
    const { delegationId } = params

    this.filterDelegationEntries(delegationEntries, () => {
      if (delegationId) {
        const delegation = this.loadDelegationForId(delegationId)
        if (delegation) {
          this.setState({
            currentDelegation: this.loadDelegationForId(delegationId),
          })
        }
      }
    })
  }

  public componentDidUpdate(prevProps: Props): void {
    const { delegationEntries, selectedIdentity } = this.props

    if (!selectedIdentity || !prevProps.selectedIdentity) {
      throw new Error('No selected Identity')
    }
    if (!isEqual(prevProps.delegationEntries, delegationEntries)) {
      this.filterDelegationEntries(delegationEntries)
    }
  }

  private onSelectCType(selectedCTypes: ICTypeWithMetadata[]): void {
    if (selectedCTypes && selectedCTypes.length === 1) {
      const { history, isPCR } = this.props
      history.push(
        `/${isPCR ? 'pcrs' : 'delegations'}/new/${selectedCTypes[0].cType.hash}`
      )
    }
  }

  private filterDelegationEntries(
    allDelegationEntries: IMyDelegation[],
    callback?: () => void
  ): void {
    const { isPCR } = this.props

    // the ! check also checks older delegationEntries without isPCR
    const delegationEntries = allDelegationEntries.filter(
      (delegationEntry: IMyDelegation) => !delegationEntry.isPCR === !isPCR
    )

    this.setState({ delegationEntries }, callback)
  }

  private deleteDelegation(delegation: IMyDelegation): void {
    const { removeDelegation, isPCR } = this.props
    if (removeDelegation) {
      safeDelete(
        `${isPCR ? 'PCR' : 'delegation'} '${
          delegation.metaData.alias || delegation.id
        }'`,
        () => {
          removeDelegation(delegation)
        }
      )
    }
  }

  private loadDelegationForId(
    delegationId: Delegations.IMyDelegation['id']
  ): Delegations.IMyDelegation | undefined {
    const { delegationEntries } = this.state

    return delegationEntries.find(
      (delegationEntry: IMyDelegation) => delegationEntry.id === delegationId
    )
  }

  private createDelegation(): void {
    if (this.selectCTypesModal.current) {
      this.selectCTypesModal.current.show()
    }
  }

  public render(): JSX.Element {
    const { isPCR, match } = this.props
    const { delegationId } = match.params
    const { delegationEntries, currentDelegation } = this.state

    return (
      <section
        className={`DelegationsView ${isPCR ? 'isPCR' : 'isDelegation'}`}
      >
        {!delegationId && (
          <MyDelegationsListView
            delegationEntries={delegationEntries}
            onRemoveDelegation={this.deleteDelegation}
            onCreateDelegation={this.createDelegation}
            isPCR={isPCR}
          />
        )}
        {currentDelegation && (
          <DelegationDetailView
            delegationId={delegationId}
            isPCR={isPCR}
            editable
            viewType={ViewType.Present}
          />
        )}
        <SelectCTypesModal
          ref={this.selectCTypesModal}
          placeholder="Select cType#{multi}…"
          onConfirm={this.onSelectCType}
        />
      </section>
    )
  }
}

const mapStateToProps: MapStateToProps<StateProps, OwnProps, ReduxState> = (
  state
) => ({
  delegationEntries: Delegations.getAllDelegations(state),
  selectedIdentity: Wallet.getSelectedIdentity(state),
})

const mapDispatchToProps: DispatchProps = {
  removeDelegation: (delegation: IMyDelegation) =>
    Delegations.Store.removeDelegationAction(delegation),
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(DelegationsView))
