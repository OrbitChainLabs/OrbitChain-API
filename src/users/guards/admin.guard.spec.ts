import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const createExecutionContext = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as ExecutionContext;

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('allows request when user role is ADMIN', () => {
    const context = createExecutionContext({ role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects request when user is missing', () => {
    const context = createExecutionContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('User not authenticated');
  });

  it('rejects request when user role is not ADMIN', () => {
    const context = createExecutionContext({ role: 'USER' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Admin access required');
  });
});
