import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { type ErrorCode, PROBLEM_CONTENT_TYPE, type Problem } from "@ndpa/schema";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { ProblemException } from "./problem.js";

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: "validation_failed",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "rate_limited",
};

const TITLE_BY_CODE: Partial<Record<ErrorCode, string>> = {
  validation_failed: "The request is not valid",
  unauthenticated: "You need to sign in",
  forbidden: "You don't have permission to do that",
  not_found: "Not found",
  conflict: "That conflicts with the current state",
  rate_limited: "Too many requests",
  internal_error: "Something went wrong on our side",
};

/** Every error leaves the API as RFC 9457 problem+json with a stable `code`. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const problem = this.toProblem(exception);
    problem.instance = req.originalUrl;
    if (req.id) problem.requestId = String(req.id);
    if (problem.status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(problem.status).type(PROBLEM_CONTENT_TYPE).send(JSON.stringify(problem));
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof ProblemException) {
      return {
        type: "about:blank",
        title: exception.message,
        status: exception.getStatus(),
        code: exception.code,
        ...(exception.detail ? { detail: exception.detail } : {}),
        ...(exception.errors ? { errors: exception.errors } : {}),
      };
    }
    if (exception instanceof ZodError) {
      return {
        type: "about:blank",
        title: TITLE_BY_CODE.validation_failed!,
        status: 400,
        code: "validation_failed",
        errors: exception.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = CODE_BY_STATUS[status] ?? (status >= 500 ? "internal_error" : "validation_failed");
      return { type: "about:blank", title: TITLE_BY_CODE[code] ?? exception.message, status, code };
    }
    return { type: "about:blank", title: TITLE_BY_CODE.internal_error!, status: 500, code: "internal_error" };
  }
}
