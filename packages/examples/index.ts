export const fn = flow(async input => {
  return await Promise.resolve(input);
});

export const fn2 = flow(async function test(input) {
  return await Promise.resolve(input);
});

export const fn3 = flow(async function(input) {
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

  @flow
  async func(input: string) {
    this.value = await Promise.resolve(input);
  }

  @flow
  funcBound = async (input: string) => {
    this.value =  await Promise.resolve(input);
  };

  @flow
  funcNonBound = async function(input: string) {
    return await Promise.resolve(input);
  };
}
