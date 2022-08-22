import { Kind, ValueNode, GraphQLScalarType } from 'graphql';

export const NonceScalar = new GraphQLScalarType({
  name: 'Nonce',
  description: 'A random nonsense value',
  // @ts-ignore
  parseLiteral: (ast: ValueNode): string => (ast.kind === Kind.STRING ? ast.value : null),
  parseValue: (value: string): string => value,
  serialize: (value: string): string => value,
});
