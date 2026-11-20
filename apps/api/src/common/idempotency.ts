import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { ProblemException } from "./problem.js";

const IDEMPOTENT = "ndpa:idempotency-key-required";

/** Mark a POST that spends credits or money (PRD §8). */
export const RequiresIdempotencyKey = () => SetMetadata(IDEMPOTENT, true);

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Step 05 enforces the header only. Storing and replaying responses per key
 * lands with the first spending endpoint (Step 28).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT, [ctx.getHandler(), ctx.getClass()]);
    if (required) {
      const key = ctx.switchToHttp().getRequest<Request>().header("idempotency-key");
      if (!key || !KEY_RE.test(key)) {
        throw new ProblemException(
          400,
          "idempotency_key_required",
          "An Idempotency-Key header is required",
          "Send a unique Idempotency-Key (8–128 letters, digits, - or _) so a retried request is not charged twice.",
        );
      }
    }
    return next.handle();
  }
}
