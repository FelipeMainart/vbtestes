import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export function validateEnvironment(input: unknown) {
  return environmentSchema.parse(input);
}
