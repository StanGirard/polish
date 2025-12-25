/**
 * Browser Notifications Utility
 *
 * Simple browser notifications for Polish events.
 * Uses the Web Notifications API.
 */

export type NotifiableEvent =
  | 'plan_ready'
  | 'awaiting_approval'
  | 'session_completed'
  | 'session_failed'
  | 'error'

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
  onClick?: () => void
}

// Check if notifications are supported and enabled
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission
  }

  return Notification.permission
}

// Show a notification
export function showNotification(options: NotificationOptions): Notification | null {
  if (!isNotificationSupported()) return null
  if (Notification.permission !== 'granted') return null

  const notification = new Notification(options.title, {
    body: options.body,
    icon: options.icon || '/polish-icon.png',
    tag: options.tag,
    requireInteraction: options.requireInteraction
  })

  if (options.onClick) {
    notification.onclick = () => {
      window.focus()
      options.onClick?.()
      notification.close()
    }
  }

  return notification
}

// Event-specific notification helpers
export function notifyPlanReady(sessionId: string, summary?: string): Notification | null {
  return showNotification({
    title: '📋 Plan Ready for Review',
    body: summary || 'A new implementation plan is ready for your approval.',
    tag: `plan-ready-${sessionId}`,
    requireInteraction: true,
    onClick: () => {
      // Navigate to session if needed
      if (typeof window !== 'undefined') {
        // Could use router here if available
        window.location.hash = `#session-${sessionId}`
      }
    }
  })
}

export function notifyAwaitingApproval(sessionId: string): Notification | null {
  return showNotification({
    title: '⏳ Awaiting Your Approval',
    body: 'Polish is waiting for you to approve or modify the plan.',
    tag: `awaiting-${sessionId}`,
    requireInteraction: true
  })
}

export function notifySessionCompleted(sessionId: string, success: boolean, scoreImprovement?: number): Notification | null {
  if (success) {
    return showNotification({
      title: '✅ Session Completed',
      body: scoreImprovement
        ? `Polish finished! Score improved by ${scoreImprovement.toFixed(1)} points.`
        : 'Polish session completed successfully.',
      tag: `completed-${sessionId}`
    })
  } else {
    return showNotification({
      title: '❌ Session Failed',
      body: 'Polish session encountered an error.',
      tag: `failed-${sessionId}`
    })
  }
}

export function notifyError(sessionId: string, message: string): Notification | null {
  return showNotification({
    title: '⚠️ Error',
    body: message.substring(0, 100), // Limit body length
    tag: `error-${sessionId}`
  })
}

// Hook-friendly notification handler
export function handleEventNotification(
  sessionId: string,
  eventType: string,
  eventData: Record<string, unknown>
): void {
  switch (eventType) {
    case 'plan':
      notifyPlanReady(sessionId, eventData.summary as string | undefined)
      break

    case 'status':
      if (eventData.message === 'Plan ready for review. Waiting for approval...') {
        notifyAwaitingApproval(sessionId)
      }
      break

    case 'result':
      const success = eventData.success as boolean
      const initialScore = eventData.initialScore as number | undefined
      const finalScore = eventData.finalScore as number | undefined
      const improvement = (initialScore !== undefined && finalScore !== undefined)
        ? finalScore - initialScore
        : undefined
      notifySessionCompleted(sessionId, success, improvement)
      break

    case 'error':
      notifyError(sessionId, eventData.message as string || 'Unknown error')
      break
  }
}

// Storage key for notification preferences
const NOTIFICATIONS_ENABLED_KEY = 'polish_notifications_enabled'

export function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true'
}

export function setNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false')
}
