import * as sdk from '@kiltprotocol/prototype-sdk'
import {
  IPartialClaim,
  IRequestAttestationForClaim,
  IRequestLegitimations,
  ISubmitAttestationForClaim,
  MessageBodyType,
} from '@kiltprotocol/prototype-sdk'
import { Error } from 'tslint/lib/error'

import attestationService from '../services/AttestationService'
import * as Attestations from '../state/ducks/Attestations'
import { MyDelegation, MyRootDelegation } from '../state/ducks/Delegations'
import * as Wallet from '../state/ducks/Wallet'
import persistentStore from '../state/PersistentStore'
import { Contact } from '../types/Contact'
import ContactRepository from './ContactRepository'
import MessageRepository from './MessageRepository'

class AttestationWorkflow {
  /**
   * Sends a legitimation request for attesting claims to attesters
   *
   * @param claim the partial claim we request legitimation for
   * @param attesters the attesters to send the legitimation request to
   */
  public static async requestLegitimations(
    claim: IPartialClaim,
    attesters: Contact[]
  ): Promise<void> {
    const messageBody = {
      content: claim,
      type: MessageBodyType.REQUEST_LEGITIMATIONS,
    } as IRequestLegitimations

    return MessageRepository.sendToAddress(
      attesters.map((attester: Contact) => attester.publicIdentity.address),
      messageBody
    )
  }

  /**
   * Sends back the legitimation along with the originally given (partial)
   * claim to the claimer.
   *
   * @param claim the (partial) claim to attest
   * @param legitimations the list of legitimations to be included in the
   *   attestation
   * @param receiverAddress claimers address who requested the legitimation
   * @param delegation delegation to add to legitimations
   */
  public static async submitLegitimations(
    claim: IPartialClaim,
    legitimations: sdk.IAttestedClaim[],
    receiverAddress: Contact['publicIdentity']['address'],
    delegation?: MyDelegation | MyRootDelegation
  ): Promise<void> {
    const messageBody: sdk.ISubmitLegitimations = {
      content: { claim, legitimations },
      type: sdk.MessageBodyType.SUBMIT_LEGITIMATIONS,
    }

    if (delegation) {
      messageBody.content.delegationId = delegation.id
    }

    return MessageRepository.sendToAddress(receiverAddress, messageBody)
  }

  /**
   * Sends back attested claims to verifier.
   *
   * @param attestedClaims the list of attested claims to be included in the
   *   attestation
   * @param receiverAddress verifiers address who requested the attested claims
   */
  public static async submitClaimsForCtype(
    attestedClaims: sdk.IAttestedClaim[],
    receiverAddress: Contact['publicIdentity']['address']
  ): Promise<void> {
    const messageBody: sdk.ISubmitClaimsForCtype = {
      content: attestedClaims,
      type: sdk.MessageBodyType.SUBMIT_CLAIMS_FOR_CTYPE,
    }

    return MessageRepository.sendToAddress(receiverAddress, messageBody)
  }

  /**
   * Creates the request for claim attestation and sends it to the attester.
   *
   * @param claim - the claim to attest
   * @param attesters - the attesters to send the request to
   * @param [legitimations] - the legitimations the claimer requested
   *   beforehand from attester
   */
  public static async requestAttestationForClaim(
    claim: sdk.IClaim,
    attesters: Contact[],
    legitimations: sdk.AttestedClaim[] = []
  ): Promise<void> {
    const identity: sdk.Identity = Wallet.getSelectedIdentity(
      persistentStore.store.getState()
    ).identity
    const requestForAttestation: sdk.IRequestForAttestation = new sdk.RequestForAttestation(
      claim,
      legitimations,
      identity
    )
    const messageBody = {
      content: requestForAttestation,
      type: MessageBodyType.REQUEST_ATTESTATION_FOR_CLAIM,
    } as IRequestAttestationForClaim

    return MessageRepository.send(attesters, messageBody)
  }

  /**
   * Verifies the given request for attestation, creates an attestation on
   * chain and sends it to the claimer.
   *
   * @param requestForAttestation the request for attestation to be verified
   *   and attested
   * @param claimerAddress the contacts address who wants his claim to be attested
   */
  public static async approveAndSubmitAttestationForClaim(
    requestForAttestation: sdk.IRequestForAttestation,
    claimerAddress: Contact['publicIdentity']['address']
  ): Promise<void> {
    return ContactRepository.findByAddress(claimerAddress).then(
      (claimer: Contact) => {
        return attestationService
          .attestClaim(requestForAttestation)
          .then((attestedClaim: sdk.IAttestedClaim) => {
            // store attestation locally
            attestationService.saveInStore({
              attestation: attestedClaim.attestation,
              cTypeHash: attestedClaim.request.claim.cType,
              claimerAddress: attestedClaim.request.claim.owner,
              claimerAlias: claimer.metaData.name,
            } as Attestations.Entry)

            // build 'claim attested' message and send to claimer
            const attestationMessageBody: ISubmitAttestationForClaim = {
              content: attestedClaim,
              type: MessageBodyType.SUBMIT_ATTESTATION_FOR_CLAIM,
            }
            return MessageRepository.send(claimer, attestationMessageBody)
          })
      }
    )
  }

  /**
   * informs the delegate about the created delegation node
   *
   * @param delegationNodeId id of the just created delegation node
   * @param delegateAddress owner of the just created delegation node
   */
  public static async informCreateDelegation(
    delegationNodeId: sdk.DelegationNode['id'],
    delegateAddress: Contact['publicIdentity']['address']
  ): Promise<void> {
    const messageBody: sdk.IInformCreateDelegation = {
      content: delegationNodeId,
      type: sdk.MessageBodyType.INFORM_CREATE_DELEGATION,
    }

    return MessageRepository.sendToAddress(delegateAddress, messageBody)
  }
}

export default AttestationWorkflow
