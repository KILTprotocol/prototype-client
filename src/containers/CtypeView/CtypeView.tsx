import * as React from 'react'
import { RouteComponentProps, withRouter } from 'react-router-dom'

import CTypeDetailView from '../../components/CtypeDetailView/CtypeDetailView'
import CTypeListView from '../../components/CtypeListView/CtypeListView'
import SelectContactsModal from '../../components/Modal/SelectContactsModal'
import attestationWorkflow from '../../services/AttestationWorkflow'
import { Contact } from '../../types/Contact'
import { ICTypeWithMetadata } from '../../types/Ctype'

import './CtypeView.scss'

type Props = RouteComponentProps<{ cTypeHash: string }> & {}

type State = {}

class CtypeView extends React.Component<Props, State> {
  private selectAttestersModal: SelectContactsModal | null
  private cTypeToLegitimate: ICTypeWithMetadata

  constructor(props: Props) {
    super(props)
    this.requestTerm = this.requestTerm.bind(this)

    this.cancelSelectAttesters = this.cancelSelectAttesters.bind(this)
    this.finishSelectAttesters = this.finishSelectAttesters.bind(this)
  }

  public render() {
    const { cTypeHash } = this.props.match.params

    return (
      <section className="CtypeView">
        <h1>CTYPEs</h1>
        {cTypeHash && <CTypeDetailView cTypeHash={cTypeHash} />}
        {!cTypeHash && (
          <CTypeListView onRequestTerm={this.requestTerm} />
        )}
        <SelectContactsModal
          ref={el => {
            this.selectAttestersModal = el
          }}
          placeholder="Select attester#{multi}…"
          onCancel={this.cancelSelectAttesters}
          onConfirm={this.finishSelectAttesters}
        />
      </section>
    )
  }

  private requestTerm(cType: ICTypeWithMetadata) {
    if (cType && this.selectAttestersModal) {
      this.cTypeToLegitimate = cType
      this.selectAttestersModal.show()
    }
  }

  private cancelSelectAttesters() {
    delete this.cTypeToLegitimate
    if (this.selectAttestersModal) {
      this.selectAttestersModal.hide()
    }
  }

  private finishSelectAttesters(selectedAttesters: Contact[]) {
    if (this.cTypeToLegitimate.cType.hash) {
      attestationWorkflow.requestTerms(
        [{ cTypeHash: this.cTypeToLegitimate.cType.hash }],
        selectedAttesters.map(
          (contact: Contact) => contact.publicIdentity.address
        )
      )
    }
  }
}

export default withRouter(CtypeView)
