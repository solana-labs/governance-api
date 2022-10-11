import { Args, Int, ResolveField, Resolver, Root, Query } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import * as errors from '@lib/errors/gql';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { ClippedRichTextDocument } from '@src/lib/gqlTypes/ClippedRichTextDocument';
import { clipRichTextDocument } from '@src/lib/textManipulation/clipRichTextDocument';

import { RealmProposalConnection, RealmProposalSort } from './dto/pagination';
import { RealmProposal } from './dto/RealmProposal';
import { RealmProposalGQLService, RealmProposalCursor } from './realm-proposal.gql.service';

@Resolver(() => RealmProposal)
export class RealmProposalResolver {
  constructor(private readonly realmProposalGQLService: RealmProposalGQLService) {}

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
    @Root() proposal: RealmProposal,
  ) {
    return FN.pipe(
      EI.tryCatch(
        () => clipRichTextDocument(proposal.document, charLimit, attachmentLimit),
        (e) => new errors.Exception(e),
      ),
    );
  }

  @Query(() => RealmProposalConnection, {
    description: 'A list of proposals for a Realm',
  })
  @EitherResolver()
  proposals(
    @Args() args: ConnectionArgs,
    @Args('realm', {
      description: 'Public key of the Realm',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
    @Args('sort', {
      type: () => RealmProposalSort,
      description: 'Sort order for the list',
      defaultValue: RealmProposalSort.Time,
      nullable: true,
    })
    sort: RealmProposalSort = RealmProposalSort.Alphabetical,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmProposalGQLService.getGQLProposalList(
      realm,
      user ? user.publicKey : null,
      sort,
      environment,
      args.after as RealmProposalCursor | undefined,
      args.before as RealmProposalCursor | undefined,
      args.first,
      args.last,
    );
  }
}
