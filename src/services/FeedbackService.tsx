import React, { ReactNode } from 'react'
import { ModalType } from '../components/Modal/Modal'
import * as UiState from '../state/ducks/UiState'
import persistentStore from '../state/PersistentStore'
import {
  BlockingNotification,
  BlockUi,
  Notification,
  NotificationType,
} from '../types/UserFeedback'

class FeedbackService {
  public static getNotificationBase({
    className,
    message,
    type,
  }: Partial<Notification>): Partial<Notification> {
    const created = Date.now()
    const id = [created, type, message].join('-') as string
    return {
      className,
      created,
      id,
      message: message || '',
      type: type || NotificationType.INFO,
    }
  }

  public static addNotification({
    className,
    message,
    type,
  }: Partial<Notification>): Notification {
    const notification: Partial<Notification> = {
      ...FeedbackService.getNotificationBase({ className, message, type }),
    }

    notification.remove = () => {
      FeedbackService.removeNotification(notification.id as Notification['id'])
    }

    // now put this into redux store UiState
    persistentStore.store.dispatch(
      UiState.Store.addNotificationAction(notification as Notification)
    )

    // return completed blockingNotification
    return notification as Notification
  }

  public static removeNotification(id: Notification['id']) {
    persistentStore.store.dispatch(UiState.Store.removeNotificationAction(id))
  }

  public static addBlockingNotification({
    className,
    header,
    message,
    onCancel,
    onConfirm,
    modalType,
    type,
  }: Partial<BlockingNotification>): BlockingNotification {
    const blockingNotification: Partial<BlockingNotification> = {
      ...FeedbackService.getNotificationBase({ className, message, type }),
      header,
      modalType,
      onCancel,
      onConfirm,
    }

    blockingNotification.remove = () => {
      FeedbackService.removeBlockingNotification(
        blockingNotification.id as BlockingNotification['id']
      )
    }

    if (onConfirm) {
      blockingNotification.onConfirm = onConfirm
    }

    // now put this into redux store UiState
    persistentStore.store.dispatch(
      UiState.Store.addBlockingNotificationAction(
        blockingNotification as BlockingNotification
      )
    )

    // return completed blockingNotification
    return blockingNotification as BlockingNotification
  }

  public static removeBlockingNotification(id: BlockingNotification['id']) {
    persistentStore.store.dispatch(
      UiState.Store.removeBlockingNotificationAction(id)
    )
  }

  public static addBlockUi({ headline, message }: Partial<BlockUi>): BlockUi {
    const created = Date.now()
    const id = created + (message || '')
    const blockUi: Partial<BlockUi> = { created, id, headline, message }

    blockUi.remove = () => {
      FeedbackService.removeBlockUi(id)
    }

    blockUi.updateMessage = (newMessage: string) => {
      FeedbackService.updateBlockUi(id, newMessage)
    }

    // now put this into redux store UiState
    persistentStore.store.dispatch(
      UiState.Store.addBlockUiAction(blockUi as BlockUi)
    )

    // return completed blockingNotification
    return blockUi as BlockUi
  }

  public static removeBlockUi(id: BlockUi['id']) {
    persistentStore.store.dispatch(UiState.Store.removeBlockUiAction(id))
  }

  public static updateBlockUi(id: BlockUi['id'], message: BlockUi['message']) {
    persistentStore.store.dispatch(
      UiState.Store.updateBlockUiAction(id, message)
    )
  }
}

function _notify(type: NotificationType, message: string, blocking = false) {
  blocking
    ? FeedbackService.addBlockingNotification({
        message,
        type,
      })
    : FeedbackService.addNotification({ message, type })
}

export function notifySuccess(message: string, blocking = false) {
  _notify(NotificationType.SUCCESS, message, blocking)
}

export function notifyFailure(message: string, blocking = true) {
  _notify(NotificationType.FAILURE, message, blocking)
}

export function notify(message: string, blocking = false) {
  _notify(NotificationType.INFO, message, blocking)
}

export function safeDelete(
  message: ReactNode,
  onConfirm: (notification: BlockingNotification) => void,
  removeNotificationInstantly = true
) {
  FeedbackService.addBlockingNotification({
    header: 'Are you sure?',
    message: <div>Do you want to delete {message}?</div>,
    modalType: ModalType.CONFIRM,
    onConfirm: (notification: BlockingNotification) => {
      onConfirm(notification)
      if (removeNotificationInstantly) {
        notification.remove()
      }
    },
    type: NotificationType.INFO,
  })
}

export default FeedbackService