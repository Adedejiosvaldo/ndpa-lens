import type { PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/** Validate a body/query/param with a Zod schema; ZodError becomes validation_failed. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    return this.schema.parse(value);
  }
}
