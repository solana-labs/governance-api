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
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import * as crypto from "crypto";

import { ConfigService } from '@src/config/config.service';

import { ValidatorDiscordUserService } from './validator-discord-user.service';

const DELAY_DURATION = 15_000;

const connection = new Connection(process.env.RPC_ENDPOINT as string);


@Controller()
export class ValidatorDiscordUserController {
    private logger = new Logger(ValidatorDiscordUserService.name);
    constructor(
        private readonly validatorDiscordUserService: ValidatorDiscordUserService,
        private readonly configService: ConfigService,
  ) {}

  @Post('/verify-gossip-keypair')
  @HttpCode(200)
  async validatorPayload(
    @Body() body: {code: string, publicKey: string},
    // @Headers() headers,
    // @Req() req: Request,
    // @Res() res,
  ) {
        const { code, publicKey } = body;
        const payload = {
            code: code,
            publicKey: publicKey
        };

        return payload;
  }
  

    @Post('/verify-gossip-keypair/:publicKey/:discordauthorizationcode')
    @HttpCode(200)
    async validatorVerify(
        @Body() body: {signature: string},
        @Param('publicKey') publicKey: string,
        @Param('discordauthorizationcode') discordauthorizationcode: string,
    ) {

        const { signature } = body;

        const tokens = await this.validatorDiscordUserService.getOAuthTokens(discordauthorizationcode);

        // 2. Uses the Discord Access Token to fetch the user profile
        const meData = await this.validatorDiscordUserService.getUserData(tokens);
        const userId = meData.user.id;        

        await this.validatorDiscordUserService.createDiscordUser(userId, new PublicKey(publicKey), tokens.refresh_token);

        const metadata = await this.validatorDiscordUserService.calculateMetadata(publicKey);

        console.log(metadata);

        await this.validatorDiscordUserService.pushMetadata(userId, tokens, metadata);



        

        // await this.validatorDiscordUserService.updateMetadata(userId);

        //console.log(data);



        // let msg = "\xffsolana offchain test";
        // let sig = "N6o6k9zvryQMoFuY46GqyAjCf1TYjwNmVupXBULyp2Gg8zXP32yr2wiUVn5ptbUKN567fMSt8qVSKrLjCMuuFo5"
        // let pub = "8LZFLp757XCQ5vu8FFC8KLDtXrAUqjxQHgbzUkiFG2Dg"

        // const messageUint8 = new TextEncoder().encode(msg);
        // const s = nacl.sign.detached(messageUint8, new Uint8Array([103,123,31,18,47,50,241,98,61,216,105,230,249,168,141,160,137,75,154,13,184,27,39,125,73,177,138,237,125,215,77,83,109,4,78,83,99,239,178,194,115,20,102,140,9,166,146,226,224,49,76,247,17,112,120,106,39,86,86,94,22,38,7,27]));
        // console.log('signature = ', bs58.encode(s));
        


        // // Hash the message with SHA256
        // let hashedMsg = crypto.createHash('sha256').update(Buffer.from(msg, 'ascii')).digest();

        // // Convert base58-encoded signature and public key to Uint8Array
        // let decodedSignature = new Uint8Array(bs58.decode(s));
        // let decodedPublicKey = new Uint8Array(bs58.decode(p));

        // // Verify the signature
        // let isValid = nacl.sign.detached.verify(
        //     new TextEncoder().encode(msg),
        //     decodedSignature,
        //     decodedPublicKey);

        // console.log(isValid);

        // return isValid;
    }
  }