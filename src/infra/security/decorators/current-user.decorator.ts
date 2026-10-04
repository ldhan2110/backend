import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessPayload } from '../services/token.service';

/** Resolves to `req.user` ({ sub, jti }), set by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessPayload =>
    ctx.switchToHttp().getRequest().user,
);
