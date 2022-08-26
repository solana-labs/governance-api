import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { RealmMember } from '@src/realm-member/dto/RealmMember';

import { RealmProposalState } from './RealmProposalState';
import { RealmProposalUserVote } from './RealmProposalUserVote';

@ObjectType({
  description: 'A proposal in a Realm',
})
export class RealmProposal {
  @Field(() => RealmMember, {
    description: 'The creator of the proposal',
    nullable: true,
  })
  author?: RealmMember;

  @Field(() => Date, {
    description: 'Creation timestamp',
  })
  created: Date;

  @Field(() => String, {
    description: 'On-chain description for the proposal',
  })
  description: string;

  @Field(() => RichTextDocumentScalar, {
    description: 'Proposal body text',
  })
  document: RichTextDocument;

  @Field(() => PublicKeyScalar, {
    description: 'Public Key address for the proposal',
  })
  publicKey: PublicKey;

  @Field(() => RealmProposalUserVote, {
    description: "The requesting user's vote",
    nullable: true,
  })
  myVote?: RealmProposalUserVote | null;

  @Field(() => RealmProposalState, {
    description: 'Current state of the proposal',
  })
  state: RealmProposalState;

  @Field(() => String, {
    description: 'Title for the proposal',
  })
  title: string;

  @Field(() => Date, {
    description: 'Update timestamp',
  })
  updated: Date;
}
