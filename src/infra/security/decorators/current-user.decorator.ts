import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessPayload } from '../types/jwt.type';

/** Resolves to `req.user` ({ sub, jti }), set by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessPayload =>
    ctx.switchToHttp().getRequest().user,
);
