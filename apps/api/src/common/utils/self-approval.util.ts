import { ForbiddenException } from '@nestjs/common';
import { AppErrorCode } from '@epms/shared';

/**
 * Ensures that an approving actor is not the same person who submitted the entity.
 * Required by FRD FR-205 (separation of duties).
 */
export function assertNotSelfApproval(actorId: string, submitterId: string): void {
  if (actorId && submitterId && actorId === submitterId) {
    throw new ForbiddenException({
      code: AppErrorCode.SELF_APPROVAL_FORBIDDEN,
      message: 'Self-approval is forbidden: the approver cannot be the submitter.',
    });
  }
}
