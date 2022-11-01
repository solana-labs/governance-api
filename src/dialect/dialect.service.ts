import { Injectable, OnModuleInit } from '@nestjs/common';
import { DialectSdk } from './dialect-sdk';
import { Dapp } from '@dialectlabs/sdk';

// TODO add notificationTypeId's after running script
export const DIALECT_NOTIF_TYPE_ID_UPVOTE = 'TODO';
export const DIALECT_NOTIF_TYPE_ID_REPLY = 'TODO';

@Injectable()
export class DialectService implements OnModuleInit {
  private realmsDapp: Dapp | null;

  constructor(
    private readonly sdk: DialectSdk,
  ) {}

  async onModuleInit() {
    this.realmsDapp = await this.sdk.dapps.find();
    if (!this.realmsDapp) {
      console.error(`Dialect Error: unable to load dapp from sdk ${this.sdk}`);
    }
  }

  /**
   * Send a message to subscriber(s)
   */
  async sendMessage(
    title: string,
    message: string,
    notificationTypeId: string,
    recipients?: string[],
  ) {
    try {
      if (!this.realmsDapp) {
        throw new Error('realmsDapp was not loaded from Dialect sdk');
      }
      if (!recipients) {
        // TODO add broadcast when needed (no recipient param = broadcast)
        // this.realmsDapp?.messages.send({
        //   title,
        //   message,
        //   notificationTypeId,
        // });
      } else if (recipients.length === 1) {
        // unicast
        this.realmsDapp?.messages.send({
          title,
          message,
          recipient: recipients[0],
          notificationTypeId,
        });
      } else {
        // multicast
        this.realmsDapp?.messages.send({
          title,
          message,
          recipients,
          notificationTypeId,
        });
      }
    } catch (e) {
      console.error(
        `Dialect Error: Failed to send notification: ${JSON.stringify(e)}`,
      );
    }
  }
}
