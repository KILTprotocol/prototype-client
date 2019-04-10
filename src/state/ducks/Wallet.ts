import * as sdk from '@kiltprotocol/prototype-sdk'
import Immutable from 'immutable'
import { createSelector } from 'reselect'

import KiltAction from '../../types/Action'
import { MyIdentity } from '../../types/Contact'
import { State as ReduxState } from '../PersistentStore'

interface SaveAction extends KiltAction {
  payload: MyIdentity
}

interface RemoveAction extends KiltAction {
  payload: MyIdentity['identity']['address']
}

interface SelectAction extends KiltAction {
  payload: MyIdentity['identity']['address']
}

type Action = SaveAction | RemoveAction | SelectAction

type Entry = MyIdentity

type State = {
  identities: Immutable.Map<MyIdentity['identity']['address'], MyIdentity>
  selectedIdentity: Entry | null
}

type ImmutableState = Immutable.Record<State>

type SerializedIdentity = {
  did?: MyIdentity['did']
  name: MyIdentity['metaData']['name']
  phrase: MyIdentity['phrase']
}

type SerializedState = {
  identities: SerializedIdentity[]
  selectedAddress?: MyIdentity['identity']['address']
}

class Store {
  public static serialize(state: ImmutableState): SerializedState {
    const wallet: SerializedState = {
      identities: [],
    }

    wallet.identities = state
      .get('identities')
      .toList()
      .map((myIdentity: MyIdentity) => ({
        did: myIdentity.did,
        name: myIdentity.metaData.name,
        phrase: myIdentity.phrase,
      }))
      .toArray()

    const selectedIdentity: MyIdentity | null = state.get('selectedIdentity')
    if (selectedIdentity) {
      wallet.selectedAddress = selectedIdentity.identity.address
    }

    return wallet
  }

  public static deserialize(serializedState: SerializedState): ImmutableState {
    const serializedIdentities: SerializedIdentity[] =
      serializedState &&
      serializedState.identities &&
      Array.isArray(serializedState.identities)
        ? serializedState.identities
        : []
    const identities: { [key: string]: MyIdentity } = {}

    serializedIdentities.forEach((serializedIdentity: SerializedIdentity) => {
      const { did, name, phrase } = serializedIdentity

      // TODO: use real wallet later instead of stored phrase

      const identity = sdk.Identity.buildFromMnemonic(phrase)
      const myIdentity: MyIdentity = {
        did,
        identity,
        metaData: {
          name,
        },
        phrase,
      }

      identities[identity.address] = myIdentity
    })

    const { selectedAddress } = serializedState
    let selectedIdentity = null
    if (selectedAddress) {
      selectedIdentity = identities[selectedAddress]
    }

    return Store.createState({
      identities: Immutable.Map(identities),
      selectedIdentity,
    })
  }

  public static reducer(
    state: ImmutableState = Store.createState(),
    action: Action
  ): ImmutableState {
    switch (action.type) {
      case Store.ACTIONS.SAVE_IDENTITY:
        const myIdentity = (action as SaveAction).payload
        return state.setIn(['identities', myIdentity.identity.address], {
          ...myIdentity,
          createdAt: Date.now(),
        })
      case Store.ACTIONS.REMOVE_IDENTITY:
        const removeAddress = (action as RemoveAction).payload
        return state.deleteIn(['identities', removeAddress])
      case Store.ACTIONS.SELECT_IDENTITY:
        const selectAddress = (action as SelectAction).payload
        const selectedIdentity = state.getIn(['identities', selectAddress])
        return state.set('selectedIdentity', selectedIdentity)
      default:
        return state
    }
  }

  public static saveIdentityAction(myIdentity: MyIdentity): SaveAction {
    return {
      payload: myIdentity,
      type: Store.ACTIONS.SAVE_IDENTITY,
    }
  }

  public static removeIdentityAction(
    address: MyIdentity['identity']['address']
  ): RemoveAction {
    return {
      payload: address,
      type: Store.ACTIONS.REMOVE_IDENTITY,
    }
  }

  public static selectIdentityAction(
    address: MyIdentity['identity']['address']
  ): SelectAction {
    return {
      payload: address,
      type: Store.ACTIONS.SELECT_IDENTITY,
    }
  }

  public static createState(obj?: State): ImmutableState {
    return Immutable.Record({
      identities: Immutable.Map<
        MyIdentity['identity']['address'],
        MyIdentity
      >(),
      selectedIdentity: null,
    } as State)(obj)
  }

  private static ACTIONS = {
    REMOVE_IDENTITY: 'client/wallet/REMOVE_IDENTITY',
    SAVE_IDENTITY: 'client/wallet/SAVE_IDENTITY',
    SELECT_IDENTITY: 'client/wallet/SELECT_IDENTITY',
  }
}

const _getSelectedIdentity = (state: ReduxState) =>
  state.wallet.get('selectedIdentity')

const getSelectedIdentity = createSelector(
  [_getSelectedIdentity],
  (selectedIdentity: MyIdentity) => selectedIdentity
)

const _getAllIdentities = (state: ReduxState) =>
  state.wallet
    .get('identities')
    .toList()
    .toArray()

const getAllIdentities = createSelector(
  [_getAllIdentities],
  (entries: Entry[]) =>
    entries.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) {
        return 0
      } else if (!a.createdAt) {
        return 1
      } else if (!b.createdAt) {
        return -1
      } else {
        return a.createdAt - b.createdAt
      }
    })
)

const _getIdentity = (
  state: ReduxState,
  address: sdk.PublicIdentity['address']
) => state.wallet.get('identities').get(address)

const getIdentity = createSelector(
  [_getIdentity],
  (entry: Entry) => entry
)

export {
  Store,
  ImmutableState,
  SerializedState,
  Entry,
  Action,
  getSelectedIdentity,
  getAllIdentities,
  getIdentity,
}
