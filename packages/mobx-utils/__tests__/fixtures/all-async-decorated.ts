import {} from '@crayonzx/mobx-utils';
import { flow } from 'mobx';

declare let randomDecorator: any;

export const fn = flow(async input => {
  return await Promise.resolve(input);
});
export const fn2 = flow(async function test(input) {
  return await Promise.resolve(input);
});
export const fn3 = flow(async function(input) {
  return await Promise.resolve(input);
});
export const fn4 = flow(function* (input) {
  return yield Promise.resolve(input);
})
export const fn5 = flow(function* test(input) {
  yield flow(async input => {
    return await Promise.resolve(input);
  });
  return yield Promise.resolve(input);
})
export class Test {
  test: number = 0;
  constructor() {
    var nestedFlow = flow(async () => {
      var anotherNestedFlow = flow(async () => {
        this.test = 5;
        await Promise.resolve(100);
      });
      this.test = 5;
      await anotherNestedFlow();
    });
  }

  @flow
  async func() {
    this.test = 5;
    await Promise.resolve(100);
  }

  @flow
  funcBound = async () => {
    this.test = 5;
    await Promise.resolve(100);
  };

  @randomDecorator
  @flow
  funcNonBound = async function(this: Test) {
    this.test = 5;
    await Promise.resolve(100);
  };

  rawFlow = flow(function *(this: Test) {
    this.test = 5;
    yield flow(async function(input) {
      return await Promise.resolve(input);
    });
    yield Promise.resolve(100);
  })
}
