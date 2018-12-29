/**
 * Inspired by
 * - [ts-transform-async-to-mobx-flow](https://github.com/AurorNZ/ts-transform-async-to-mobx-flow)
 * - [ts-import-plugin](https://github.com/Brooooooklyn/ts-import-plugin/blob/master/src/index.ts)
 *
 * 1. Check whether the source file imports flow or as alis from mobx
 * 2. Look for async functions marked as @flow or flow(...)
 * 3. Transform them to generator functions
 */

import ts from 'typescript';

export interface Options {
  mobxPackage: string;
}

const FLOW_IDENTIFIER = 'flow';

/** ts-jest calls this method for their astTransformers */
export function factory() {
  return createTransformer();
}

// ts-jest config
export const name = '@crayonzx/mobx-utils/ts-transform-async-to-flow-generator';
// ts-jest config: increment this each time the code is modified
export const version = 2;

/** Entry for the transformer plugin */
export default function createTransformer({
  mobxPackage = 'mobx',
}: Partial<Options> = {}): ts.TransformerFactory<ts.SourceFile> {
  return context => file => visitSourceFile(mobxPackage, file, context);
}

function visitSourceFile(
  mobxPackage: string,
  source: ts.SourceFile,
  context: ts.TransformationContext,
): ts.SourceFile {
  const flowIdentifiers = CheckFlowImportAndReturnFlowIdentifiers(mobxPackage, source, context);
  if (!flowIdentifiers.length) {
    return source;
  }

  let transformed = false;

  const visitor: ts.Visitor = node => {
    if (ts.isImportDeclaration(node)) {
      return node;
    }

    if (checkFlowCallExpression(node, flowIdentifiers)) {
      const fn = node.arguments[0];

      if (isGeneratorFunction(fn)) {
        // already is a generator function
        return ts.visitEachChild(node, visitor, context);
      }

      if (!isAsyncFunction(fn)) {
        throw new Error(
          errorMessage(`Could not resolve expression as async function: ${node.getFullText()}`),
        );
      }

      if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
        transformed = true;

        const name = resolveFunctionName(node, fn);
        const newFunctionBlock = createNewFunctionBlock(
          node.expression, // flowIdentifier,
          name,
          ts.visitEachChild(fn.body, visitor, context),
          context,
        );

        return transformFunction(fn, newFunctionBlock);
      }
    }

    if (
      ts.isMethodDeclaration(node) &&
      hasFlowDecorators(node.decorators, flowIdentifiers) &&
      node.body
    ) {
      if (!isGeneratorFunction(node) && !isAsyncFunction(node)) {
        throw new Error(
          errorMessage(`Could not resolve expression as async function: ${node.getFullText()}`),
        );
      }

      transformed = true;

      const newFunctionBlock = createNewFunctionBlock(
        flowIdentifiers[0],
        ts.isIdentifier(node.name) ? node.name : undefined,
        ts.visitEachChild(node.body, visitor, context),
        context,
      );

      return transformMethodDeclaration(node, newFunctionBlock, flowIdentifiers);
    }

    if (
      ts.isPropertyDeclaration(node) &&
      hasFlowDecorators(node.decorators, flowIdentifiers) &&
      node.initializer
    ) {
      const fn = node.initializer;

      if (!isGeneratorFunction(fn) && !isAsyncFunction(fn)) {
        throw new Error(
          errorMessage(`Could not resolve expression as async function: ${node.getFullText()}`),
        );
      }

      if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
        transformed = true;
        const newFunctionBlock = createNewFunctionBlock(
          flowIdentifiers[0],
          ts.isIdentifier(node.name) ? node.name : undefined,
          ts.visitEachChild(fn.body, visitor, context),
          context,
        );

        return transformPropertyDeclaration(
          node,
          transformFunction(fn, newFunctionBlock),
          flowIdentifiers
        );
      }
    }

    return ts.visitEachChild(node, visitor, context);
  };

  const convertToFlowResult = ts.visitEachChild(source, visitor, context);

  if (transformed) {
    return convertToFlowResult;
  }

  return source;
}

function createNewFunctionBlock(
  flowExpression: ts.Expression,
  name: ts.Identifier | undefined,
  body: ts.ConciseBody,
  context: ts.TransformationContext,
) {
  const replaceYieldAndCheckNested: ts.Visitor = node => {
    if (ts.isAwaitExpression(node)) {
      return ts.createYield(node.expression);
    }

    return ts.visitEachChild(node, replaceYieldAndCheckNested, context);
  };

  const convertedBody = replaceYieldAndCheckNested(body) as ts.ConciseBody;

  return createWrappedFunctionBlock(flowExpression, name, convertedBody);
}

/**
 * adds `import * as mobx_1 from 'mobx';`
 * It is possible to try to reuse and existing import statement, but adding one seems simpler for now
 */
function addImportMobxStatement(
  source: ts.SourceFile,
  mobxPackage: string,
  mobxNamespaceImport: ts.Identifier,
) {
  const importFlowStatement = ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(undefined, ts.createNamespaceImport(mobxNamespaceImport)),
    ts.createLiteral(mobxPackage),
  );
  return ts.updateSourceFileNode(
    source,
    [importFlowStatement, ...source.statements],
    source.isDeclarationFile,
    source.referencedFiles,
    source.typeReferenceDirectives,
    source.hasNoDefaultLib,
    source.libReferenceDirectives,
  );
}

/**
 *  Checks whether the node is a method call wrapped into flow method
 * @example
```
const a = flow(async (input) => {
  await this.delay(this.input)
});
// or
const b = flow(async function (input) {
  await this.delay(this.input)
});
```
 */
function checkFlowCallExpression(
  node: ts.Node,
  flowIdentifiers: ts.Identifier[],
): node is ts.CallExpression {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    const nodeExpr = node.expression;
    return flowIdentifiers.some((flowId) => nodeExpr.text === flowId.text);
  }
  return false;
}

/**
 * A helper to update function and strip the async keyword from modifiers
 */
function transformFunction(
  fn: ts.FunctionExpression | ts.ArrowFunction,
  newFunctionBlock: ts.Block,
) {
  if (ts.isArrowFunction(fn)) {
    return ts.updateArrowFunction(
      fn,
      filterOutAsyncModifier(fn.modifiers),
      fn.typeParameters,
      fn.parameters,
      fn.type,
      fn.equalsGreaterThanToken,
      newFunctionBlock,
    );
  } else {
    return ts.updateFunctionExpression(
      fn,
      filterOutAsyncModifier(fn.modifiers),
      undefined,
      fn.name,
      fn.typeParameters,
      fn.parameters,
      fn.type,
      newFunctionBlock,
    );
  }
}

/**
 * A helper to update method declaration and strip the async keyword from modifiers
 */
function transformMethodDeclaration(
  node: ts.MethodDeclaration,
  newFunctionBlock: ts.Block,
  flowIdentifiers: ts.Identifier[]
) {
  const otherDecorators = filterOutFlowDecorators(node.decorators, flowIdentifiers);

  return ts.updateMethod(
    node,
    otherDecorators,
    filterOutAsyncModifier(node.modifiers),
    node.asteriskToken,
    node.name,
    node.questionToken,
    node.typeParameters,
    node.parameters,
    node.type,
    newFunctionBlock,
  );
}

/**
 * A helper to update property declaration and strip the async keyword from modifiers
 */
function transformPropertyDeclaration(
  node: ts.PropertyDeclaration,
  newFunctionBlock: ts.ArrowFunction | ts.FunctionExpression,
  flowIdentifiers: ts.Identifier[]
) {
  const otherDecorators = filterOutFlowDecorators(node.decorators, flowIdentifiers);

  return ts.updateProperty(
    node,
    otherDecorators,
    filterOutAsyncModifier(node.modifiers),
    node.name,
    node.questionToken,
    node.type,
    newFunctionBlock,
  );
}

/**
 * creating a function block, eg
 * @example
 ```ts
// in:
await this.delay(this.input)

// out:
return flow_1(function*() {
  yield this.delay(this.input)
}).call(this);
```
 */
function createWrappedFunctionBlock(
  flowExpression: ts.Expression,
  name: ts.Identifier | undefined,
  convertedBody: ts.ConciseBody,
) {
  return ts.createBlock([
    ts.createReturn(
      ts.createCall(
        ts.createPropertyAccess(
          ts.createCall(flowExpression, undefined, [
            ts.createFunctionExpression(
              undefined,
              ts.createToken(ts.SyntaxKind.AsteriskToken),
              name,
              undefined,
              undefined,
              undefined,
              ts.isBlock(convertedBody)
                ? convertedBody
                : ts.createBlock([ts.createStatement(convertedBody)]),
            ),
          ]),
          'call',
        ),
        undefined,
        [ts.createThis()],
      ),
    ),
  ]);
}

/**
 * try to resolve arrow function name from variable declaration, eg:
 * @example
 ```ts
// in:
const fn = flow(async (input) => {
  await this.delay(this.input)
})
// out:
const fn = (input) => {
  return flow_1(function* fn() { // notice the function name is set here
    yield this.delay(this.input)
  }).call(this);
}
```
 */
function resolveFunctionName(node: ts.Node, fn: ts.FunctionExpression | ts.ArrowFunction) {
  let name = fn.name;

  if (
    !fn.name &&
    node.parent &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  ) {
    name = node.parent.name;
  }
  return name;
}

function hasFlowDecorators(
  decorators: ts.NodeArray<ts.Decorator> | undefined,
  flowIdentifiers: ts.Identifier[]
): boolean {
  return (
    decorators !== undefined &&
    decorators.some(({ expression }) => {
      if (ts.isIdentifier(expression)) {
        return flowIdentifiers.some((flowId) => expression.text === flowId.text);
      }
      return false;
    })
  );
}

/**
 * Returns all the decorators except for @flow
 * Ensures to return undefined if the array is empty
 */
function filterOutFlowDecorators(
  decorators: ts.NodeArray<ts.Decorator> | undefined,
  flowIdentifiers: ts.Identifier[]
): ts.Decorator[] | undefined {
  if (decorators) {
    const filtered = decorators.filter(({ expression }) => {
      return !(
        ts.isIdentifier(expression) &&
        flowIdentifiers.some((flowId) => expression.text === flowId.text)
      );
    })
    if (filtered.length) {
      return filtered;
    }
  }
  return undefined;
}

/**
 * Returns all the modifiers except for async
 * Ensures to return undefined if the array is empty
 */
function filterOutAsyncModifier(
  modifiers: ts.NodeArray<ts.Modifier> | undefined,
): ts.Modifier[] | undefined {
  return (
    modifiers &&
    modifiers.reduce<ts.Modifier[] | undefined>((acc, x) => {
      // skip async modifier
      if (x.kind === ts.SyntaxKind.AsyncKeyword) {
        return acc;
      }

      return acc ? [...acc, x] : [x];
    }, undefined)
  );
}

function isAsyncFunction(node: ts.Node): boolean {
  return (ts as any).isAsyncFunction(node);
}

function errorMessage(message: string): string {
  return `[${name}]: ${message}`;
}

function isGeneratorFunction(node: ts.Node): boolean {
  // Maybe no need to check isArrowFunction
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return node.asteriskToken !== undefined;
  }
  return false;
}

/**
 * Checks whether the source file imports flow from mobx
 * Returns the imported flow expression or undefined if not found
 */
function CheckFlowImportAndReturnFlowIdentifiers(
  mobxPackage: string,
  source: ts.SourceFile,
  context: ts.TransformationContext
): ts.Identifier[] {
  let flowIdentifiers: ts.Identifier[] = [];

  const searchFlowIdentifier = (node: ts.ImportDeclaration) => {
    node.forEachChild((importChild) => {
      if (ts.isImportClause(importChild)) {
        if (importChild.namedBindings && ts.isNamedImports(importChild.namedBindings)) {
          importChild.namedBindings.forEachChild((namedBinding) => {
            // ts.NamedImports.elements will always be ts.ImportSpecifier
            const importSpecifier = namedBinding as ts.ImportSpecifier;

            if ((importSpecifier.propertyName || importSpecifier.name).text === FLOW_IDENTIFIER) {
              // Support name alias import
              // e.g. import { flow } from 'mobx' => name is flow
              // e.g. import { flow as name } from 'mobx' => propertyName is flow
              flowIdentifiers.push(importSpecifier.name);
            }
          })
        }
      }
    })
  }

  const visitor: ts.Visitor = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      if (moduleName === 'mobx' || moduleName === mobxPackage) {
        searchFlowIdentifier(node);
      }
    }
    return node;
  }

  ts.visitEachChild(source, visitor, context);

  return flowIdentifiers;
}
