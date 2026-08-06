import { z } from "zod";

const clientEnvironmentSchema = z.object({});

export const clientEnvironment = clientEnvironmentSchema.parse({});
