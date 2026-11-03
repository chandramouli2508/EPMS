// apps/api/src/modules/notifications/channels/in-app.channel.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationPayload,
} from '../notification-channel.interface';

/**
 * In-app notification channel.
 * Phase 0: logs the notification. Phase 8 will write a DB record and push via SSE.
 *
 * This is the only channel implementation currently. EmailChannel will implement
 * the same NotificationChannel interface when email is added, with zero changes
 * to business modules that call NotificationService.
 */
@Injectable()
export class InAppChannel implements NotificationChannel {
  readonly channelName = 'in-app';
  private readonly logger = new Logger(InAppChannel.name);

  async send(payload: NotificationPayload): Promise<void> {
    // Phase 0 stub — will be replaced with DB write + SSE push in Phase 8
    this.logger.debug(
      `[in-app] → ${payload.recipientId}: ${payload.title} | ${payload.body}`,
    );
  }
}
