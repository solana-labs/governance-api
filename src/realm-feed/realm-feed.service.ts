import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import { RealmFeedItemType } from '@src/realm-feed-item/dto/RealmFeedItemType';
import { RealmProposalService } from '@src/realm-proposal/realm-proposal.service';

@Injectable()
export class RealmFeedService {
  constructor(private readonly realmProposalService: RealmProposalService) {}

  /**
   * Returns the first n items in the realm feed
   */
  getFirstNItems(realmPublicKey: PublicKey, n: number) {
    return FN.pipe(
      this.realmProposalService.getProposalsForRealm(realmPublicKey),
      TE.map(AR.takeLeft(n)),
      TE.map(
        AR.map((proposal) => ({
          proposal,
          type: RealmFeedItemType.Proposal,
          id: proposal.publicKey.toBase58(),
        })),
      ),
    );
  }

  /**
   * Returns the last n items in the realm feed
   */
  getLastNItems(realmPublicKey: PublicKey, n: number) {
    return FN.pipe(
      this.realmProposalService.getProposalsForRealm(realmPublicKey),
      TE.map(AR.takeRight(n)),
      TE.map(
        AR.map((proposal) => ({
          proposal,
          type: RealmFeedItemType.Proposal,
          id: proposal.publicKey.toBase58(),
        })),
      ),
    );
  }
}
