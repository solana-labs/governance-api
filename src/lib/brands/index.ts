import * as IT from 'io-ts';

export const BrandedString = <N extends string>(
  name: N,
  refinement?: (str: string) => boolean,
) =>
  IT.brand(
    IT.string,
    (str): str is IT.Branded<string, { readonly [x in N]: symbol }> =>
      refinement ? refinement(str) : typeof str === 'string',
    name,
  );

export const Nonce = BrandedString('nonce');
export type Nonce = IT.TypeOf<typeof Nonce>;
