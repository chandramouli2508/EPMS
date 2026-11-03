import { ForbiddenException } from '@nestjs/common';
import { assertNotSelfApproval } from '../self-approval.util';

describe('assertNotSelfApproval', () => {
  it('should throw ForbiddenException if actorId equals submitterId', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    expect(() => assertNotSelfApproval(userId, userId)).toThrow(ForbiddenException);
  });

  it('should pass without error if actorId is different from submitterId', () => {
    const actorId = '11111111-1111-1111-1111-111111111111';
    const submitterId = '22222222-2222-2222-2222-222222222222';
    expect(() => assertNotSelfApproval(actorId, submitterId)).not.toThrow();
  });
});
