import { BigNumber } from 'bignumber.js';
import { Kind, ValueNode, GraphQLScalarType } from 'graphql';

export const BigNumberScalar = new GraphQLScalarType({
  name: 'BigNumber',
  description: 'A potentially large number value',
  parseLiteral: (ast: ValueNode): BigNumber =>
    // @ts-ignore
    ast.kind === Kind.STRING ? new BigNumber(ast.value) : null,
  parseValue: (value: string): BigNumber => new BigNumber(value),
  serialize: (value: BigNumber): string => value.toString(),
})
