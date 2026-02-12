export declare namespace ApolloAiAppsConfig {
  export type AppTarget = "mcp" | "openai";

  export type Mode = "development" | "production" | (string & {});

  export interface Config {
    /**
     * The name of the app. If not provided, the `name` from your package.json
     * is used.
     */
    name?: string;

    /**
     * A short description of the app. If not provided, the `description` from
     * your package.json is used.
     */
    description?: string;

    /**
     * Specifies the entrypoint to the application for a given mode. When a
     * string is provided for a mode, that value will be used for every
     * configured app target. If this property is empty or a value is not
     * configured for the current mode, the vite plugin will determine the value
     * for you.
     *
     * Must be a url or pointer to an html file.
     */
    entry?: EntryPoint;

    /**
     * Specifies the version of the app. If not provided, the `version` from
     * your package.json is used.
     */
    version?: string;

    /** CSP settings for the app */
    csp?: ApolloAiAppsConfig.Csp;

    /**
     * Widget settings for the app
     */
    widgetSettings?: ApolloAiAppsConfig.WidgetSettings;

    /**
     * Label settings for the app.
     *
     * NOTE: Only available with `openai` apps.
     */
    labels?: ApolloAiAppsConfig.Labels;
  }

  export type EntryPoint = Partial<
    Record<
      ApolloAiAppsConfig.Mode,
      string | Partial<Record<ApolloAiAppsConfig.AppTarget, string>>
    >
  >;

  export interface Csp {
    connectDomains?: string[];
    frameDomains?: string[];
    redirectDomains?: string[];
    resourceDomains?: string[];
  }

  export interface WidgetSettings {
    prefersBorder?: boolean;
    description?: string;
    domain?: string;
  }

  export interface Labels {
    toolInvocation?: {
      invoking?: string;
      invoked?: string;
    };
  }
}
