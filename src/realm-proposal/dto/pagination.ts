import { ObjectType, registerEnumType } from '@nestjs/graphql';

import { EdgeType, ConnectionType } from '@lib/gqlTypes/Connection';

import { RealmProposal } from './RealmProposal';

@ObjectType()
export class RealmProposalEdge extends EdgeType('RealmProposal', RealmProposal) {}

@ObjectType()
export class RealmProposalConnection extends ConnectionType<RealmProposalEdge>(
  'RealmProposal',
  RealmProposalEdge,
) {}

export enum RealmProposalSort {
  Alphabetical = 'Alphabetical',
  Relevance = 'Relevance',
  Time = 'Time',
}

registerEnumType(RealmProposalSort, {
  name: 'RealmProposalSort',
  description: 'Sort order for a list of Realm proposals',
});
