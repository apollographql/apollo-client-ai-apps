import * as recast from "recast";
import type { ManifestExtraInput } from "../../types/application-manifest.js";

const b = recast.types.builders;

export type TSInterfaceBody = Parameters<typeof b.tsInterfaceBody>[0];

export function buildImportStatement(
  specifiers: string[],
  source: string,
  importKind: "type" | "value" = "value"
) {
  return b.importDeclaration(
    specifiers.map((s) => b.importSpecifier(b.identifier(s))),
    b.stringLiteral(source),
    importKind
  );
}

type TSTypeAnnotation = Parameters<typeof b.tsTypeAnnotation>[0];
const VALID_IDENTIFIER = /^[$_a-zA-Z][a-zA-Z0-9_$]*$/;

export function buildPropertySignature(
  keyName: string,
  value: TSTypeAnnotation,
  optional = false
) {
  return b.tsPropertySignature(
    VALID_IDENTIFIER.test(keyName) ?
      b.identifier(keyName)
    : b.stringLiteral(keyName),
    b.tsTypeAnnotation(value),
    optional
  );
}

// Type that tracks any reference to a type literal so that we can create an AST
// node from it
type SupportedLiteralTypes = ManifestExtraInput["type"];

export function buildKeywordLiteral(type: SupportedLiteralTypes) {
  switch (type) {
    case "string":
      return b.tsStringKeyword();
    case "boolean":
      return b.tsBooleanKeyword();
    case "number":
      return b.tsNumberKeyword();
    default: {
      const _: never = type;
      throw new Error(`Unexpected input type: ${_}`);
    }
  }
}

export function printRecast(ast: recast.types.ASTNode) {
  return recast.prettyPrint(ast, { tabWidth: 2, quote: "double" }).code;
}
