import { z } from "zod";

export const AppTarget = z.literal(["mcp", "openai"]);

const Mode = z
  .literal(["development", "production"])
  .or(z.custom<string & {}>((value) => typeof value === "string"));

const labelsInput = z.exactOptional(
  z.strictObject({
    toolInvocation: z.exactOptional(
      z.strictObject({
        invoking: z.string().exactOptional(),
        invoked: z.string().exactOptional(),
      })
    ),
  })
);

const labelsOutput = z.exactOptional(
  z.strictObject({
    "toolInvocation/invoking": z.string().exactOptional(),
    "toolInvocation/invoked": z.string().exactOptional(),
  })
);

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
  labels: z.codec(labelsInput, labelsOutput, {
    encode: () => {
      // encode is currently not used so we can skip the business logic and
      // return an empty object which satisfies the type. If we need to encode
      // labels back to the original form, this will need to be implemented
      return {};
    },
    decode: ({ toolInvocation }) => {
      const config: z.infer<typeof labelsOutput> = {};

      if (toolInvocation?.invoking) {
        config["toolInvocation/invoking"] = toolInvocation.invoking;
      }

      if (toolInvocation?.invoked) {
        config["toolInvocation/invoked"] = toolInvocation.invoked;
      }

      return config;
    },
  }),
});
