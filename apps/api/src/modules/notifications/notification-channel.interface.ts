// apps/api/src/modules/notifications/notification-channel.interface.ts

/**
 * Strategy interface for notification delivery channels.
 *
 * Only InAppChannel is implemented in Phase 0. Email can be added in a future
 * phase by implementing this interface — no business module code needs changing.
 */
export interface NotificationPayload {
  recipientId: string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
}

export interface NotificationChannel {
  readonly channelName: string;
  send(payload: NotificationPayload): Promise<void>;
}
