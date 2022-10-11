import { Args, Int, ResolveField, Resolver, Root } from '@nestjs/graphql';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';

import { EitherResolver } from '@lib/decorators/EitherResolver';
import * as errors from '@lib/errors/gql';
import { ClippedRichTextDocument } from '@src/lib/gqlTypes/ClippedRichTextDocument';
import { clipRichTextDocument } from '@src/lib/textManipulation/clipRichTextDocument';

import { RealmPost } from './dto/RealmPost';

@Resolver(() => RealmPost)
export class RealmPostResolver {
  @ResolveField(() => ClippedRichTextDocument, {
    description: 'A clipped version of the post document',
  })
  @EitherResolver()
  clippedDocument(
    @Args('charLimit', {
      type: () => Int,
      description: 'The character count to clip the document at',
      nullable: true,
      defaultValue: 400,
    })
    charLimit = 400,
    @Args('attachmentLimit', {
      type: () => Int,
      description: 'The maximum number of attachments to include',
      nullable: true,
      defaultValue: 0,
    })
    attachmentLimit = 0,
    @Root() post: RealmPost,
  ) {
    return FN.pipe(
      EI.tryCatch(
        () => clipRichTextDocument(post.document, charLimit, attachmentLimit),
        (e) => new errors.Exception(e),
      ),
    );
  }
}
