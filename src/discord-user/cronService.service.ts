import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfigService } from '@src/config/config.service';
import axios from "axios";
import { ValidatorDiscordUser } from './entities/ValidatorDiscordUser.entity';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    constructor(
        @InjectRepository(ValidatorDiscordUser)
        private readonly validatorDiscordUserRepository: Repository<ValidatorDiscordUser>,
        private readonly configService: ConfigService,
    ) {}

    // updates cannot be too frequent per Discord API rate limits
    //@Cron("0 0 */2 * *") // every 2 days (approximate length of each Solana epoch)
    @Cron(CronExpression.EVERY_DAY_AT_11PM) // for testing
    async handleCron() {
        try {
            const validatorDiscordUsers = await this.validatorDiscordUserRepository.find();

            validatorDiscordUsers.forEach(async (user) => {
                const publicKey = user.publicKeyStr;
                try {
                    const BASE_URL = this.configService.get('validatorDiscord.refreshUrl');
                    await axios.post(`${BASE_URL}/verify-gossip-keypair/${publicKey}/identitykeyplacerholder/discordauthplaceholder`);
                    console.log(`REFRESHING`);
                } catch (error) {
                    console.error(`Error for publicKey ${publicKey}: `, error);
                }
            });
        } catch (error) {
            console.error(error);
        }
  }
}