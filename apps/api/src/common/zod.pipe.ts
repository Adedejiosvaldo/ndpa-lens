import type { PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/**
 * Validate a body/query/param with a Zod schema; ZodError becomes validation_failed.
 * Type the parameter as `z.infer<typeof Schema>`, never with a type that shares
 * the schema const's name: Swagger reads the emitted design type and crashes
 * when it is a Zod object instead of a class.
 */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    return this.schema.parse(value);
  }
}
