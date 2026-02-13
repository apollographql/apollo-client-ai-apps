import type { ArgumentNode, DirectiveNode, TypeNode, ValueNode } from "graphql";
import { Kind } from "graphql";
import { invariant } from "../../utilities/invariant.js";

export function getTypeName(type: TypeNode): string {
  let t = type;
  while (t.kind === Kind.NON_NULL_TYPE || t.kind === Kind.LIST_TYPE) {
    t = t.type;
  }
  return t.name.value;
}

export function getArgumentValue(
  argument: ArgumentNode,
  expectedType: Kind.STRING
): string;

export function getArgumentValue(
  argument: ArgumentNode,
  expectedType: Kind.BOOLEAN
): boolean;

export function getArgumentValue<T = unknown>(
  argument: ArgumentNode,
  expectedType: Kind.LIST
): T[];

export function getArgumentValue<
  T extends Record<string, unknown> = Record<string, unknown>,
>(argument: ArgumentNode, expectedType: Kind.OBJECT): T;

export function getArgumentValue(argument: ArgumentNode, expectedType: Kind) {
  const argumentType = argument.value.kind;

  invariant(
    argumentType === expectedType,
    `Expected argument '${argument.name.value}' to be of type '${expectedType}' but found '${argumentType}' instead.`
  );

  return getRawValue(argument.value);
}

interface GetArgumentNodeOptions {
  required?: boolean;
}

export function getDirectiveArgument(
  argumentName: string,
  directive: DirectiveNode,
  opts: GetArgumentNodeOptions & { required: true }
): ArgumentNode;

export function getDirectiveArgument(
  argumentName: string,
  directive: DirectiveNode,
  opts?: GetArgumentNodeOptions
): ArgumentNode | undefined;

export function getDirectiveArgument(
  argumentName: string,
  directive: DirectiveNode,
  { required = false }: { required?: boolean } = {}
) {
  const argument = directive.arguments?.find(
    (directiveArgument) => directiveArgument.name.value === argumentName
  );

  invariant(
    argument || !required,
    `'${argumentName}' argument must be supplied for @tool`
  );

  return argument;
}

export function maybeGetArgumentValue(
  argument: ArgumentNode | undefined,
  expectedType: Kind.STRING
): string | undefined;

export function maybeGetArgumentValue(
  argument: ArgumentNode | undefined,
  expectedType: Kind.BOOLEAN
): boolean | undefined;

export function maybeGetArgumentValue<T = unknown>(
  argument: ArgumentNode | undefined,
  expectedType: Kind.LIST
): T[] | undefined;

export function maybeGetArgumentValue<
  T extends Record<string, unknown> = Record<string, unknown>,
>(argument: ArgumentNode | undefined, expectedType: Kind.OBJECT): T | undefined;

export function maybeGetArgumentValue(
  argument: ArgumentNode | undefined,
  expectedType: Kind
) {
  if (!argument) {
    return;
  }

  return getArgumentValue(argument, expectedType as any) as any;
}

function getRawValue(node: ValueNode): unknown {
  switch (node.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.LIST:
      return node.values.map(getRawValue);
    case Kind.OBJECT:
      return node.fields.reduce<Record<string, any>>((acc, field) => {
        acc[field.name.value] = getRawValue(field.value);
        return acc;
      }, {});
    default:
      throw new Error(
        `Error when parsing directive values: unexpected type '${node.kind}'`
      );
  }
}
