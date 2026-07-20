import ts = require('typescript');

export interface CapabilityParserLimits {
  maxSourceBytes: number;
  maxNodes: number;
  maxDepth: number;
}

type LiteralPrimitive = null | boolean | number | string;
type Literal = LiteralPrimitive | Literal[] | { [key: string]: Literal };

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function fail(message: string): never {
  throw new Error(`Invalid capability registry: ${message}`);
}

/**
 * Parses the remote registry as a deliberately tiny data language. It never evaluates,
 * imports, or resolves any upstream source.
 */
export function parseCapabilityRegistryLiteral(source: string, limits: CapabilityParserLimits): Record<string, Literal> {
  if (Buffer.byteLength(source, 'utf8') > limits.maxSourceBytes) fail('source exceeds byte limit');

  const file = ts.createSourceFile('capability-registry.cjs', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  if ((file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length) fail('source has parse diagnostics');

  let nodes = 0;
  const count = (node: ts.Node): void => {
    nodes += 1;
    if (nodes > limits.maxNodes) fail('AST exceeds node limit');
    ts.forEachChild(node, count);
  };
  count(file);

  const declarations: ts.VariableDeclaration[] = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'configSchema') declarations.push(declaration);
    }
  }
  if (declarations.length !== 1) fail('must declare configSchema exactly once');
  const declaration = declarations[0]!;
  if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) fail('configSchema must be an object literal');

  const read = (node: ts.Expression, depth: number): Literal => {
    if (depth > limits.maxDepth) fail('literal exceeds nesting limit');
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (ts.isNoSubstitutionTemplateLiteral(node)) fail('template literals are not allowed');
      return node.text;
    }
    if (ts.isNumericLiteral(node)) {
      const value = Number(node.text);
      if (!Number.isFinite(value)) fail('number is not finite');
      return value;
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
      const value = -Number(node.operand.text);
      if (!Number.isFinite(value)) fail('number is not finite');
      return value;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const result: Literal[] = [];
      for (const element of node.elements) {
        if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) fail('array elements must be literals');
        result.push(read(element, depth + 1));
      }
      return result;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const result: Record<string, Literal> = Object.create(null) as Record<string, Literal>;
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || property.name === undefined) fail('object properties must be assignments');
        if (ts.isComputedPropertyName(property.name)) fail('computed properties are not allowed');
        let key: string;
        if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) key = property.name.text;
        else fail('object key is not a literal');
        if (UNSAFE_KEYS.has(key)) fail('prototype-sensitive object key');
        if (Object.hasOwn(result, key)) fail('duplicate object key');
        result[key] = read(property.initializer, depth + 1);
      }
      return result;
    }
    fail(`unsupported syntax kind ${ts.SyntaxKind[node.kind]}`);
  };

  return read(declaration.initializer, 0) as Record<string, Literal>;
}
