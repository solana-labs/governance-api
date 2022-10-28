import { Injectable, OnModuleInit } from '@nestjs/common';
import { DialectSdk } from './dialect-sdk';
import { Dapp } from '@dialectlabs/sdk';

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
    recipients?: string[],
  ) {
    try {
      if (!this.realmsDapp) {
        throw new Error('realmsDapp was not loaded from Dialect sdk');
      }
      if (!recipients) {
        // broadcast
        this.realmsDapp?.messages.send({
          title,
          message,
        });
      } else if (recipients.length === 1) {
        // unicast
        this.realmsDapp?.messages.send({
          title,
          message,
          recipient: recipients[0],
        });
      } else {
        // multicast
        this.realmsDapp?.messages.send({
          title,
          message,
          recipients,
        });
      }
    } catch (e) {
      console.error(
        `Dialect Error: Failed to send notification: ${JSON.stringify(e)}`,
      );
    }
  }
}
