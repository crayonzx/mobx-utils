import ts from 'typescript';
import fs from 'fs';

import createTransformer from '../src/ts-transform-async-to-flow-generator';

it('Does not convert function not marked as flow', () => {
  const path = require.resolve('./fixtures/no-async-decorated');

  const source = fs.readFileSync(path).toString('utf8');
  const result = getTransformedOutput(source);

  expect(result).toMatchSnapshot();
});

it('Converts function marked as flow', () => {
  const path = require.resolve('./fixtures/all-async-decorated');

  const source = fs.readFileSync(path).toString('utf8');
  const result = getTransformedOutput(source);

  expect(result).toMatchSnapshot();
});

describe('Throw error when cannot parse body of the flow', () => {
  it('non-async arrow function', () => {
    const source = `
import { flow } from 'mobx';
const fn = flow(input => {
  this.delay(input);
});`;

    expect(() => getTransformedOutput(source)).toThrowError(
      'Could not resolve expression as async function',
    );
  });

  it('non-async function', () => {
    const source = `
import { flow } from 'mobx';
const fn = flow(function test (input) {
  this.delay(input);
});`;

    expect(() => getTransformedOutput(source)).toThrowError(
      'Could not resolve expression as async function',
    );
  });

  it('function passed as parameter', () => {
    const source = `
import { flow } from 'mobx';
const fn = flow(randomFunction);
`;

    expect(() => getTransformedOutput(source)).toThrowError(
      'Could not resolve expression as async function',
    );
  });

  describe('class context', () => {
    it('non-async function', () => {
      const source = `
import { flow } from 'mobx';
class Test {
  // non-async function
  @flow
  func() {
    this.test = 5;
  }
}`;
      expect(() => getTransformedOutput(source)).toThrowError(
        'Could not resolve expression as async function',
      );
    });

    it('non-async arrow function', () => {
      const source = `
  import { flow } from 'mobx';
  class Test {
    // non-async arrow function
    @flow
    funcBound = () => {
      this.test = 5;
    };
  }`;
      expect(() => getTransformedOutput(source)).toThrowError(
        'Could not resolve expression as async function',
      );
    });

    it('function passed as parameter', () => {
      const source = `
  import { flow } from 'mobx';
  class Test {
    // function passed as parameter
    @flow
    funcNonBound = randomFunction;
  }`;
      expect(() => getTransformedOutput(source)).toThrowError(
        'Could not resolve expression as async function',
      );
    });
  });
});

it('Recognize flow alias import', () => {
  const source = `
import { flow as asyncAction } from 'mobx';
const fn = asyncAction(async input => {
  return await Promise.resolve(input);
});
`;
  const expectedOutput = `
import { flow as asyncAction } from 'mobx';
const fn = (input) => { return asyncAction(function* fn() {
    return yield Promise.resolve(input);
}).call(this); };
`;

  verifyOutput(getTransformedOutput(source), expectedOutput);
});

it('Transpiled correctly to ES5', () => {
  const source = `
import { flow } from 'mobx';
const fn = flow(async input => {
  return await Promise.resolve(input);
});
  `;
    const expectedOutput = `
"use strict";
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var mobx_1 = require("mobx");
var fn = function (input) { return mobx_1.flow(function fn() {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.resolve(input)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}).call(_this); };
  `;

    verifyOutput(getTranspiledOutput(source, ts.ScriptTarget.ES5), expectedOutput);
})

function verifyOutput(transformedOutput: string, expectedOutput: string) {
  expect(removeEmptyLines(transformedOutput)).toBe(removeEmptyLines(expectedOutput));
}

function getTranspiledOutput(sourceCode: string, target: ts.ScriptTarget): string {
  const result = ts.transpileModule(sourceCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES5,
      noEmitHelpers: true,
    },
    transformers: { before: [createTransformer()] },
  });

  return result.outputText;
}

function getTransformedOutput(sourceCode: string): string {
  const printer = ts.createPrinter();

  const source = ts.createSourceFile('', sourceCode, ts.ScriptTarget.ESNext, true);
  const result = ts.transform(source, [createTransformer()]);
  const transformedSourceFile = result.transformed[0];
  const resultCode = printer.printFile(transformedSourceFile);
  return resultCode;
}

function removeEmptyLines(input: string) {
  return input
    .split(/[\n\r]/g)
    .filter(x => !/^\s*$/.test(x))
    .join('\n');
}
