import { z } from "zod";

export const AppTarget = z.literal(["mcp", "openai"]);

const Mode = z
  .literal(["development", "production"])
  .or(z.custom<string & {}>((value) => typeof value === "string"));

export const ApolloClientAiAppsConfigSchema = z.strictObject({
  name: z.string().exactOptional(),
  description: z.string().exactOptional(),
  version: z.string().exactOptional(),
  entry: z.exactOptional(
    z.partialRecord(
      Mode,
      z.union([z.string(), z.partialRecord(AppTarget, z.string())])
    )
  ),
  csp: z.exactOptional(
    z.strictObject({
      connectDomains: z.array(z.string()).exactOptional(),
      frameDomains: z.array(z.string()).exactOptional(),
      redirectDomains: z.array(z.string()).exactOptional(),
      resourceDomains: z.array(z.string()).exactOptional(),
    })
  ),
  widgetSettings: z.exactOptional(
    z.strictObject({
      prefersBorder: z.boolean().exactOptional(),
      description: z.string().exactOptional(),
      domain: z.string().exactOptional(),
    })
  ),
  labels: z.exactOptional(
    z.strictObject({
      toolInvocation: z.exactOptional(
        z.strictObject({
          invoking: z.string().exactOptional(),
          invoked: z.string().exactOptional(),
        })
      ),
    })
  ),
});
