import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpException,
    HttpStatus,
    Logger,
    Post,
    Req,
    Res,
    Param
  } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

import { ConfigService } from '@src/config/config.service';

import { ValidatorDiscordUserService } from './validator-discord-user.service';

@Controller()
export class ValidatorDiscordUserController {
    private logger = new Logger(ValidatorDiscordUserService.name);
    constructor(
        private readonly validatorDiscordUserService: ValidatorDiscordUserService,
        private readonly configService: ConfigService,
    ) {}

    // this is for time-bound verification, which is not currently implemented
    // @Post('/verify-gossip-keypair')
    // @HttpCode(200)
    // async validatorPayload(
    //     @Body() body: {code: string, publicKey: string},
    //     // @Headers() headers,
    //     // @Req() req: Request,
    //     // @Res() res,
    // ) {
    //     const { code, publicKey } = body;
    //     const payload = {
    //         code: code,
    //         publicKey: publicKey
    //     };

    //     return code;
    // }

    async verifySignature (publicKeyBase58: string, m: string, signatureBase58: string) {
        // equivalent of "solana offchain" in bytes
        const SIGNING_DOMAIN = new Uint8Array([255, 115, 111, 108, 97, 110, 97, 32, 111, 102, 102, 99, 104, 97, 105, 110]);

        const version = new Uint8Array([0]); 

        const messageFormat = new Uint8Array([0]); 

        const messageLength = new Uint8Array([m.length, 0]);

        const message = new TextEncoder().encode(m);

        // Concatenate all the parts together to form the full serialized message
        const fullSerializedMessage = new Uint8Array([
            ...SIGNING_DOMAIN, 
            ...version, 
            ...messageFormat, 
            ...messageLength, 
            ...message
        ]);

        const publicKey = new Uint8Array(bs58.decode(publicKeyBase58));
        const sig = new Uint8Array(bs58.decode(signatureBase58));

        return nacl.sign.detached.verify(fullSerializedMessage, sig, publicKey);
    }

    async newDiscordUser(publicKey: string, discordAuthorizationCode: string, signature: string) {
        const isValidator = await this.validatorDiscordUserService.isTestnetValidator(publicKey) ||
                        await this.validatorDiscordUserService.isMainnetValidator(publicKey, this.configService.get('helius.apiKey'))
    
        const isValidSignature = await this.verifySignature(publicKey, discordAuthorizationCode, signature);

        if (isValidator && isValidSignature) { // && isValidSignature for production
            const tokens = await this.validatorDiscordUserService.getOAuthTokens(discordAuthorizationCode);

            const meData = await this.validatorDiscordUserService.getUserData(tokens);
            const userId = meData.user.id;

            await this.validatorDiscordUserService.createDiscordUser(userId, new PublicKey(publicKey), tokens.refresh_token);

            const metadata = await this.validatorDiscordUserService.calculateMetadata(publicKey);

            await this.validatorDiscordUserService.pushMetadata(userId, tokens.access_token, metadata);
        }
        else {
            throw new HttpException('Not a validator / invalid signature', HttpStatus.BAD_REQUEST);
        }
    }

    @Post('/verify-gossip-keypair/:publicKey/:discordAuthorizationCode')
    @HttpCode(200)
    async validatorVerify(
        @Body() body: {signature: string},
        @Param('publicKey') publicKey: string,
        @Param('discordAuthorizationCode') discordAuthorizationCode: string,
    ) {

        const { signature } = body;
        
        const discordUser = await this.validatorDiscordUserService.getDiscordUserByPublicKey(new PublicKey(publicKey));

        if (discordUser) {
            try {
                await this.validatorDiscordUserService.updateMetadataForUser(new PublicKey(publicKey));
            } catch (error) { // existing user with Oauth tokens stored but wants to refresh
                await this.validatorDiscordUserService.deleteDiscordUser(new PublicKey(publicKey));
                await this.newDiscordUser(publicKey, discordAuthorizationCode, signature);
            }
        }
        else {
            await this.newDiscordUser(publicKey, discordAuthorizationCode, signature);
        }
    }
}
