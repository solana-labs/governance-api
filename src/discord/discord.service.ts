import { Injectable } from '@nestjs/common';
import { Client, GatewayIntentBits } from 'discord.js';

import { ConfigService } from '@src/config/config.service';

@Injectable()
export class DiscordService {
  private readonly getClient: Promise<Client>;

  constructor(private readonly configService: ConfigService) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.login(configService.get('external.discordBotKey'));

    this.getClient = new Promise((res) => {
      client.on('ready', (client) => {
        res(client);
      });
    });
  }

  async getMessage(messageUrl: string) {
    const parts = messageUrl.split('/');
    const messageId = parts[parts.length - 1];
    const channedId = parts[parts.length - 2];
    const guildId = parts[parts.length - 3];

    try {
      const client = await this.getClient;
      const server = await client.guilds.fetch(guildId);
      const channel = await server.channels.fetch(channedId);

      if (channel) {
        if (channel.isTextBased()) {
          const message = await channel.messages.fetch(messageId);
          return message;
        }
      }
    } catch {
      return null;
    }
  }
}
