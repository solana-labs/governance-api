import { Injectable } from '@nestjs/common';

import { RealmProposalService } from '@src/realm-proposal/realm-proposal.service';

@Injectable()
export class RealmFeedService {
  constructor(private readonly realmProposalService: RealmProposalService) {}
}
