import { PublicKey } from '@solana/web3.js';
import { Kind, ValueNode, GraphQLScalarType } from 'graphql';

export const PublicKeyScalar = new GraphQLScalarType({
  name: 'PublicKey',
  description: 'A valid Public Key',
  parseLiteral: (ast: ValueNode): PublicKey =>
    // @ts-ignore
    ast.kind === Kind.STRING ? new PublicKey(ast.value) : null,
  parseValue: (value: string): PublicKey => new PublicKey(value),
  serialize: (value: PublicKey): string => value.toBase58(),
});
