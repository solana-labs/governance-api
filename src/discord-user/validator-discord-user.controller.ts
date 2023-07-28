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

import { ConfigService } from '@src/config/config.service';

import { ValidatorDiscordUserService } from './validator-discord-user.service';
import { access } from 'fs';
import { isValid } from 'date-fns';

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

        return code;
    }

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

    @Post('/verify-gossip-keypair/:publicKey/:discordauthorizationcode')
    @HttpCode(200)
    async validatorVerify(
        @Body() body: {signature: string},
        @Param('publicKey') publicKey: string,
        @Param('discordauthorizationcode') discordauthorizationcode: string,
    ) {

        const { signature } = body;

        // const payload = {
        //   "code": discordauthorizationcode,
        //   "publicKey": publicKey
        // };

        // const messagePayload = JSON.stringify(payload);
        
        const discordUser = await this.validatorDiscordUserService.getDiscordUserByPublicKey(new PublicKey(publicKey));

        if (discordUser) {
            await this.validatorDiscordUserService.updateMetadataForUser(new PublicKey(publicKey));
        }
        else {
            const isValidator = await this.validatorDiscordUserService.isTestnetValidator(publicKey, this.configService.get('helius.apiKey')) ||
                            await this.validatorDiscordUserService.isMainnetValidator(publicKey, this.configService.get('helius.apiKey'));
        
        
            const isValidSignature = await this.verifySignature(publicKey, discordauthorizationcode, signature);

            if (isValidSignature) { // && isValidator for production
                const tokens = await this.validatorDiscordUserService.getOAuthTokens(discordauthorizationcode);

                const meData = await this.validatorDiscordUserService.getUserData(tokens);
                const userId = meData.user.id;

                await this.validatorDiscordUserService.createDiscordUser(userId, new PublicKey(publicKey), tokens.refresh_token);

                const metadata = await this.validatorDiscordUserService.calculateMetadata(publicKey);

                console.log(metadata);

                await this.validatorDiscordUserService.pushMetadata(userId, tokens.access_token, metadata);
            }
        }
    }


      // const pubKey = '8LZFLp757XCQ5vu8FFC8KLDtXrAUqjxQHgbzUkiFG2Dg';
      // const privKey = new Uint8Array([103,123,31,18,47,50,241,98,61,216,105,230,249,168,141,160,137,75,154,13,184,27,39,125,73,177,138,237,125,215,77,83,109,4,78,83,99,239,178,194,115,20,102,140,9,166,146,226,224,49,76,247,17,112,120,106,39,86,86,94,22,38,7,27]);
      // //const message = new Uint8Array([255, 115, 111, 108, 97, 110, 97, 32, 111, 102, 102, 99, 104, 97, 105, 110, 0, 0, 4, 0, 116, 101, 115, 116]);

      // const sig = signMessage(pubKey, privKey, fullSerializedMessage);

      // console.log(bs58.encode(Buffer.from(sig.signature)));

      // const pubKey = '8LZFLp757XCQ5vu8FFC8KLDtXrAUqjxQHgbzUkiFG2Dg';
      // const s = 'N6o6k9zvryQMoFuY46GqyAjCf1TYjwNmVupXBULyp2Gg8zXP32yr2wiUVn5ptbUKN567fMSt8qVSKrLjCMuuFo5';
      // const m = 'test1';

      // const verify = verifySignature(pubKey, m, s);

      // console.log(verify);






      // if (isValidator) {
      //   const discordUser = await this.validatorDiscordUserService.getDiscordUserByPublicKey(new PublicKey(publicKey));

      //   if (discordUser) {
      //     await this.validatorDiscordUserService.updateMetadataForUser(new PublicKey(publicKey));
      //   }
      //   else {
      //     const tokens = await this.validatorDiscordUserService.getOAuthTokens(discordauthorizationcode);

      //     const meData = await this.validatorDiscordUserService.getUserData(tokens);
      //     const userId = meData.user.id;

      //     await this.validatorDiscordUserService.createDiscordUser(userId, new PublicKey(publicKey), tokens.refresh_token);

      //     const metadata = await this.validatorDiscordUserService.calculateMetadata(publicKey);

      //     console.log(metadata);

      //     await this.validatorDiscordUserService.pushMetadata(userId, tokens.access_token, metadata);
      //   }
      // }

















        // check to see if the signature is a validator and signature matches


        // function signMessage(publicKeyStr: string, privateKeyStr: Uint8Array, message: string): string {
        //   // Convert publicKey and privateKey from Base58 string to Uint8Array
        //   const publicKey = new Uint8Array(bs58.decode(publicKeyStr));
        //   const privateKey = privateKeyStr;
        
        //   // Convert message from string to Uint8Array
        //   const messageUint8 = new TextEncoder().encode(message);
        
        //   // Sign the message with the private key
        //   const signature = nacl.sign.detached(messageUint8, privateKey);
        
        //   // Convert the signature from Uint8Array to Base58 string for easier display and transport
        //   const signatureBase58 = bs58.encode(Buffer.from(signature));
        
        //   return signatureBase58;
        // }

      //   enum MessageFormat {
      //     RestrictedAscii = 0,
      //     LimitedUtf8,
      //     ExtendedUtf8,
      //   }

      //   // A helper function to check ASCII string
      //   function isPrintableAscii(data: Uint8Array): boolean {
      //     return [...data].every((char) => char >= 0x20 && char <= 0x7e);
      //   }

      //   // A helper function to check UTF-8 string
      //   function isUtf8(data: Uint8Array): boolean {
      //     try {
      //         new TextDecoder().decode(data);
      //         return true;
      //     } catch {
      //         return false;
      //     }
      //   }

      //   function getFormat(message: Uint8Array): MessageFormat {
      //     if (isPrintableAscii(message)) {
      //         return MessageFormat.RestrictedAscii;
      //     } else if (isUtf8(message)) {
      //         return MessageFormat.LimitedUtf8;
      //     } else {
      //         throw new Error("Invalid Message Format");
      //     }
      //   }

      //   function signMessage(
      //     publicKey: string,
      //     privateKey: Uint8Array,
      //     message: Uint8Array
      // ) {
      
      //     // Sign the message
      //     const signature = nacl.sign.detached(message, privateKey);
      
      //     return { signature };
      // }

      //   // equivalent of "solana offchain" in bytes
      //   const SIGNING_DOMAIN = new Uint8Array([255, 115, 111, 108, 97, 110, 97, 32, 111, 102, 102, 99, 104, 97, 105, 110]);

      //   const version = new Uint8Array([0]); 

      //   const messageFormat = new Uint8Array([0]); 

      //   const messageLength = new Uint8Array([4, 0]); // 4 in 16-bit little-endian format

      //   const message = new TextEncoder().encode('test'); // this encodes the string 'test' into bytes
        
      //   // Concatenate all the parts together to form the full serialized message
      //   const fullSerializedMessage = new Uint8Array([
      //     ...SIGNING_DOMAIN, 
      //     ...version, 
      //     ...messageFormat, 
      //     ...messageLength, 
      //     ...message
      //   ]);
}