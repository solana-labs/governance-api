import { ObjectType } from '@nestjs/graphql';

import { Realm } from './Realm';

@ObjectType({
  description: 'An item in a dropdown list of Realms',
})
export class RealmDropdownListItem extends Realm {}
