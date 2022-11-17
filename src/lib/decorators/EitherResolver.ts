import { isLeft } from 'fp-ts/Either';

/**
 * Handle resolvers that return a `TaskEither`
 */
export function EitherResolver() {
  return (
    target: any,
    key: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    if (!descriptor.value) {
      throw new Error('Missing a description for the EitherResolver');
    }

    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let result = original.bind(this)(...args);

      if (typeof result === 'function') {
        result = result();
      }

      if (result instanceof Promise) {
        result = await result;
      }

      if (isLeft(result)) {
        console.error(JSON.stringify(result.left, null, 2));
        throw result.left;
      } else {
        return result.right;
      }
    };
  };
}
