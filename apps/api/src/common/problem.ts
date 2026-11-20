import { HttpException } from "@nestjs/common";
import type { ErrorCode } from "@ndpa/schema";

/** Throw this for any error a client may branch on: it carries a stable code. */
export class ProblemException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    title: string,
    readonly detail?: string,
    readonly errors?: { path: string; message: string }[],
  ) {
    super(title, status);
  }
}
