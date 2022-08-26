import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import { GraphQLScalarType, GraphQLScalarLiteralParser, GraphQLScalarSerializer, GraphQLScalarValueParser } from 'graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import { PathReporter } from 'io-ts/PathReporter';

import { RichTextDocument as ioRichTextDocument } from '@lib/ioTypes/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';

export const RichTextDocumentScalar = new GraphQLScalarType<object, RichTextDocument>({
  name: 'RichTextDocument',
  description: 'A json object representing a Rich Text Document',
  parseLiteral: GraphQLJSONObject.parseLiteral as GraphQLScalarLiteralParser<object>,
  parseValue: ((value: object): RichTextDocument => {
    const result = FN.pipe(
      value,
      ioRichTextDocument.decode,
    );

    if (EI.isLeft(result)) {
      throw new TypeError(PathReporter.report(EI.left(result.left)).join('\n'))
    }

    return result.right;
  }) as GraphQLScalarValueParser<object>,
  serialize: GraphQLJSONObject.serialize as GraphQLScalarSerializer<RichTextDocument>,
})
