import "server-only";

import { validateEnvironment } from "@/validators";

export const serverEnvironment = validateEnvironment({
  NODE_ENV: process.env.NODE_ENV,
});
