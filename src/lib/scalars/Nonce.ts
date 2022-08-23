import { Kind, ValueNode, GraphQLScalarType } from 'graphql';

export const NonceScalar = new GraphQLScalarType({
  name: 'Nonce',
  description: 'A random nonsense value',
  // @ts-ignore
  parseLiteral: (ast: ValueNode): string => (ast.kind === Kind.STRING ? ast.value : null),
  // @ts-ignore
  parseValue: (value: string): string => value,
  // @ts-ignore
  serialize: (value: string): string => value,
});
