// This will not cause an import in the generated JavaScript,
// but fixes "Invalid module name in augmentation, module 'mobx' cannot be found."
import {} from 'mobx';

declare module 'mobx/lib/api/flow' {
type AsyncToCancellable<
  T extends (...args: any[]) => Promise<any>
> = T extends (...args: infer P) => Promise<infer R>
  ? (...args: P) => CancellablePromise<R>
  : never;

/**
 * Marks an `async` functions to transform into a generator function wrapped with `mobx.flow`
 * @example
```
// in:
const fn = flow(async (input) => {
  return await callApi(input);
})

// out:
import { flow as flow_1 } from 'mobx';

const fn = (input) => {
  return flow_1(function* fn() {
    return yield callApi(input);
  }).call(this);
}
```
 */
function flow<T extends (...args: any[]) => Promise<any>>(
  asyncFunction: T,
): AsyncToCancellable<T>;

/**
 * Marks an `async` method to transform into a generator function wrapped with `mobx.flow`
 * @example
```
// in:
class Test {
  @flow
  async fn(input) {
    return await callApi(input);
  }
}

// out:
import { flow as flow_1 } from 'mobx';

class Test {
  fn(input) {
    return flow_1(function* fn() {
      return yield callApi(input);
    }).call(this);
  }
}
```
 */
function flow<T extends (...args: any[]) => Promise<any>>(
  target: Object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>,
): TypedPropertyDescriptor<T> | void;  // TypedPropertyDescriptor<AsyncToCancellable<T>> | void

/**
 * Marks an `async` property function to transform into a generator function wrapped with `mobx.flow`
 * @example
```
// in:
class Test {
  @flow
  fn = async (input) => {
    return await callApi(input);
  }
}

// out:
import { flow as flow_1 } from 'mobx';

class Test {
  constructor() {
    // typescript moves property functions inside the constructor
    this.fn = (input) => {
      return flow_1(function* fn() {
        return yield callApi(input);
      }).call(this);
    };
  }
}
```
 */
function flow(target: Object, propertyKey: string | symbol): void;
}
