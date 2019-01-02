import { flow } from 'mobx';
import { flow as asyncAction } from 'mobx';

const someFunction: any = () => null;

export const fn = flow(async input => {
  return await Promise.resolve(input);
});

export const fn2 = flow(async function test(input) {
  return await Promise.resolve(input);
});

export const fn3 = flow(async function(input) {
  return await Promise.resolve(input);
});

/** This will throw an Error: Could not resolve expression as async function */
// export const fn4 = flow(someFunction);

export const fn5 = flow(function* fn5(input) {
  yield Promise.resolve(input);
  return yield flow(async (input) => {
    return await Promise.resolve(input);
  })
});

export const fn6 = asyncAction(function* fn5(input) {
  yield Promise.resolve(input);
  return yield asyncAction(async (input) => {
    return await Promise.resolve(input);
  })
});

export const fn7 = asyncAction(async function(input) {
  await asyncAction(async (input) => {
    return await Promise.resolve(input);
  });
  return await Promise.resolve(input);
});

export class Test {
  value: string = '';

  constructor() {
    var nestedFlow = flow(async () => {
      var anotherNestedFlow = flow(async () => {
        return await Promise.resolve('5');
      });
      await anotherNestedFlow();
    });
  }

  @someFunction
  @flow
  async func(input: string) {
    this.value = await Promise.resolve(input);
  }

  @flow
  @someFunction
  funcBound = async (input: string) => {
    this.value =  await Promise.resolve(input);
  };

  @flow
  funcNonBound = async function(input: string) {
    return await Promise.resolve(input);
  };

  @someFunction
  @asyncAction
  async func2(input: string) {
    this.value = await Promise.resolve(input);
  }

  @asyncAction
  @someFunction
  func3 = function* (this: Test, input: string) {
    this.value = yield asyncAction(async function(input: string) {
      return await Promise.resolve(input);
    });
  }
}
