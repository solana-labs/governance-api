import { ObjectType, registerEnumType } from '@nestjs/graphql';

import { EdgeType, ConnectionType } from '@lib/gqlTypes/Connection';

import { RealmMember } from './RealmMember';

@ObjectType()
export class RealmMemberEdge extends EdgeType('RealmMember', RealmMember) {}

@ObjectType()
export class RealmMemberConnection extends ConnectionType<RealmMemberEdge>(
  'RealmMember',
  RealmMemberEdge,
) {}

export enum RealmMemberSort {
  Alphabetical = 'Alphabetical',
}

registerEnumType(RealmMemberSort, {
  name: 'RealmMemberSort',
  description: 'Sort order for a list of Realm members',
});
