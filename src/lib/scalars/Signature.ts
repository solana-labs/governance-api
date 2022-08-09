import { Buffer } from "buffer";

import { Kind, ValueNode, GraphQLScalarType } from 'graphql';

export const SignatureScalar = new GraphQLScalarType({
  name: "Signature",
  description: 'The output of a message signed by a private key, represented as a Hex string',
  parseLiteral: (ast: ValueNode): Buffer => ast.kind === Kind.STRING ? Buffer.from(ast.value, 'hex') : null,
  parseValue: (value: string): Buffer => Buffer.from(value, 'hex'),
  serialize: (value: Buffer) => value.toString('hex')
})
