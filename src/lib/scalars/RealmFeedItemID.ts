import { Kind, ValueNode, GraphQLScalarType } from 'graphql';

const RADIX = 36;

export const RealmFeedItemIDScalar = new GraphQLScalarType({
  name: "RealmFeedItemID",
  description: 'An opaque id used to identify `RealmFeedItem`s',
  // @ts-ignore
  parseLiteral: (ast: ValueNode): string => {
    // @ts-ignore
    return ast.kind === Kind.STRING ? parseInt(ast.value, RADIX) : null;
  },
  // @ts-ignore
  parseValue: (value: string): number => {
    return parseInt(value, RADIX);
  },
  // @ts-ignore
  serialize: (value: number): string => {
    return value.toString(RADIX);
  },
})
