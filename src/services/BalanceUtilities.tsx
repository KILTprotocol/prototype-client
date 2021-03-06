import {
  Balance,
  BalanceUtils,
  PublicIdentity,
  BlockchainUtils,
} from '@kiltprotocol/sdk-js'
import { Balances as KiltBalances } from '@kiltprotocol/types'
import BN from 'bn.js'
import React from 'react'
import { Store } from 'redux'
import ContactPresentation from '../components/ContactPresentation/ContactPresentation'
import KiltToken from '../components/KiltToken/KiltToken'
import * as Balances from '../state/ducks/Balances'
import * as Wallet from '../state/ducks/Wallet'
import { persistentStoreInstance } from '../state/PersistentStore'
import errorService from './ErrorService'
import { IContact, IMyIdentity } from '../types/Contact'
import { notify, notifySuccess, notifyFailure } from './FeedbackService'

// any balance below this will we purged
const MIN_BALANCE = BalanceUtils.KILT_COIN.muln(1)

// initial endowment for automatically created accounts
const ENDOWMENT = BalanceUtils.KILT_COIN.muln(30)

// TODO: do we need to do something upon deleting an identity?
class BalanceUtilities {
  public static connect(myIdentity: IMyIdentity): void {
    if (
      Balances.getBalance(
        persistentStoreInstance.store.getState(),
        myIdentity.identity.address
      ) == null
    ) {
      Balance.listenToBalanceChanges(
        myIdentity.identity.address,
        BalanceUtilities.listener
      ).then(() => {
        notify(
          <div>
            Now listening to balance changes of{' '}
            <ContactPresentation address={myIdentity.identity.address} inline />
          </div>
        )
      })
    }
  }

  public static async getMyBalance(identity: IMyIdentity): Promise<BN> {
    const balance: KiltBalances = await Balance.getBalances(
      identity.identity.address
    )
    return balance.free
  }

  public static connectMyIdentities(
    store: Store = persistentStoreInstance.store
  ): void {
    Wallet.getAllIdentities(store.getState()).forEach(
      (myIdentity: IMyIdentity) => {
        BalanceUtilities.connect(myIdentity)
      }
    )
  }

  public static makeTransfer(
    myIdentity: IMyIdentity,
    receiverAddress: IContact['publicIdentity']['address'],
    amount: BN,
    successCallback?: () => void
  ): void {
    const transferAmount = BalanceUtils.asFemtoKilt(amount)
    notify(
      <div>
        <span>Transfer of </span>
        <KiltToken amount={transferAmount} />
        <span> to </span>
        <ContactPresentation address={receiverAddress} /> initiated.
      </div>
    )
    Balance.makeTransfer(receiverAddress, transferAmount)
      .then((tx) =>
        BlockchainUtils.signAndSubmitTx(tx, myIdentity.identity, {
          resolveOn: BlockchainUtils.IS_IN_BLOCK,
        })
      )
      .then(() => {
        notifySuccess(
          <div>
            <span>Successfully transferred </span>
            <KiltToken amount={transferAmount} />
            <span> to </span>
            <ContactPresentation address={receiverAddress} />
          </div>
        )
        if (successCallback) {
          successCallback()
        }
      })
      .catch((error) => {
        errorService.log({
          error,
          message: '1010: Invalid Transaction',
          origin: 'BalanceUtilities.makeTransfer()',
        })
        notifyFailure('1010: Invalid Transaction')
      })
  }

  private static listener(
    account: PublicIdentity['address'],
    balance: KiltBalances,
    change: KiltBalances
  ): void {
    if (!change.free.isZero()) {
      const inDeCreased = `${change.free.gtn(0) ? 'in' : 'de'}creased`

      notify(
        <div>
          Balance of <ContactPresentation address={account} /> {inDeCreased} by{' '}
          <KiltToken amount={change.free} colored />.
        </div>
      )
    }
    persistentStoreInstance.store.dispatch(
      Balances.Store.updateBalance(account, balance.free)
    )
  }
}
export { BalanceUtilities, MIN_BALANCE, ENDOWMENT }
