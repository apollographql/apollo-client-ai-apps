import { cosmiconfig } from "cosmiconfig";

const moduleName = "apollo-ai-apps";

const supportedExtensions = ["json", "yml", "yaml", "js", "ts", "cjs", "mjs"];
const searchPlaces = supportedExtensions
  .flatMap((extension) => [
    `.${moduleName}.config.${extension}`,
    `${moduleName}.config.${extension}`,
  ])
  .concat("package.json");

export const explorer = cosmiconfig(moduleName, { searchPlaces });
