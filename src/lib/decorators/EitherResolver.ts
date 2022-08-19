import type { Either } from 'fp-ts/Either';
import { isLeft } from 'fp-ts/Either';
import type { TaskEither } from 'fp-ts/TaskEither';

interface EitherFunction {
  (...args: any[]):
    | Either<any, any>
    | Promise<Either<any, any>>
    | TaskEither<any, any>;
}

/**
 * Handle resolvers that return a `TaskEither`
 */
export function EitherResolver() {
  return (
    target: any,
    key: string,
    descriptor: TypedPropertyDescriptor<EitherFunction>,
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
