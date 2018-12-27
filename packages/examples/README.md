# An example transforming with ttypescript

## Usage

```
yarn install
yarn build
```

The `build` command will create the output the `lib` folder

## Input
```ts
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

```

## Output ES2015
```js
import { flow as flow_1 } from "mobx";
export const fn = (input) => { return flow_1(function* fn() {
    return yield Promise.resolve(input);
}).call(this); };
export const fn2 = function test(input) { return flow_1(function* test() {
    return yield Promise.resolve(input);
}).call(this); };
export const fn3 = function (input) { return flow_1(function* fn3() {
    return yield Promise.resolve(input);
}).call(this); };
export class Test {
    constructor() {
        this.value = '';
        this.funcBound = (input) => { return flow_1(function* funcBound() {
            this.value = yield Promise.resolve(input);
        }).call(this); };
        this.funcNonBound = function (input) { return flow_1(function* funcNonBound() {
            return yield Promise.resolve(input);
        }).call(this); };
        var nestedFlow = () => { return flow_1(function* nestedFlow() {
            var anotherNestedFlow = () => { return flow_1(function* anotherNestedFlow() {
                return yield Promise.resolve('5');
            }).call(this); };
            yield anotherNestedFlow();
        }).call(this); };
    }
    func(input) { return flow_1(function* func() {
        this.value = yield Promise.resolve(input);
    }).call(this); }
}
```
