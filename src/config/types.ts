import { z } from "zod";
import type { ApolloClientAiAppsConfigSchema, AppTarget } from "./schema.js";

export declare namespace ApolloClientAiAppsConfig {
  export type AppTarget = z.infer<typeof AppTarget>;
  export type Config = z.infer<typeof ApolloClientAiAppsConfigSchema>;
}
