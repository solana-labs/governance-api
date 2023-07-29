import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Repository } from 'typeorm';

import { ConfigService } from '@src/config/config.service';
import axios from "axios";
import { ValidatorDiscordUser } from './entities/ValidatorDiscordUser.entity';

@Injectable()
export class ValidatorDiscordUserService {
    private logger = new Logger(ValidatorDiscordUser.name);

    constructor(
        @InjectRepository(ValidatorDiscordUser)
        private readonly validatorDiscordUserRepository: Repository<ValidatorDiscordUser>,
        private readonly configService: ConfigService,
    ) {}

    async calculateMetadata(publicKey: string) {
        let metadata = {
            is_testnet_validator: 0,
            is_mainnet_validator: 0,
            is_active_testnet_validator: 0,
            is_active_mainnet_validator: 0,
            mainnet_activated_stake: 0,
        };

        if (await this.isTestnetValidator(publicKey, this.configService.get('helius.apiKey'))) {
            metadata.is_testnet_validator = 1;
        }
        if (await this.isMainnetValidator(publicKey, this.configService.get('helius.apiKey'))) {
            metadata.is_mainnet_validator = 1;
        }
        if (await this.isActiveTestnetValidator(publicKey, this.configService.get('helius.apiKey'))) {
            metadata.is_active_testnet_validator = 1;
        }
        if (await this.isActiveMainnetValidator(publicKey, this.configService.get('helius.apiKey'))) {
            metadata.is_active_mainnet_validator = 1;
        }
        metadata.mainnet_activated_stake = await this.getMainnetActivatedStake(publicKey, this.configService.get('helius.apiKey')) || 0


        return metadata;
    }

    async isTestnetValidator(votePubkey: string, apiKey: string) {
        try {
            const response = await axios.post(`https://api.testnet.solana.com`, {
                jsonrpc: "2.0",
                id: 1,
                method: "getVoteAccounts",
                params: [
                    {
                        "votePubkey": votePubkey
                    }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (response.data.result.current[0] != null) {
                return true;
            }
            return false;
            
        } catch (error) {
            console.error('Failed to check validator status:', error);
            return false;
        }
    }
    
    async isMainnetValidator(votePubkey: string, apiKey: string) {
        try {
            const response = await axios.post(`https://rpc.helius.xyz?api-key=${apiKey}`, {
                jsonrpc: "2.0",
                id: 1,
                method: "getVoteAccounts",
                params: [
                    {
                        "votePubkey": votePubkey
                    }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (response.data.result.current[0] != null) {
                return true;
            }
            return false;
    
        } catch (error) {
            console.error('Failed to check validator status:', error);
            return false;
        }
    }
    
    // active is defined if validator has voted in the last epoch
    async isActiveTestnetValidator(votePubkey: string, apiKey: string) {
        try {
            const response = await axios.post(`https://api.testnet.solana.com`, {
                jsonrpc: "2.0",
                id: 1,
                method: "getVoteAccounts",
                params: [
                    {
                        "votePubkey": votePubkey
                    }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (response.data.result.current[0] != null) {
                return response.data.result.current[0].epochVoteAccount;
            }
            
        } catch (error) {
            console.error('Failed to check validator status:', error);
            return false;
        }
    }
    
    // active is defined if validator has voted in the last epoch
    async isActiveMainnetValidator(votePubkey: string, apiKey: string) {
        try {
            const response = await axios.post(`https://rpc.helius.xyz?api-key=${apiKey}`, {
                jsonrpc: "2.0",
                id: 1,
                method: "getVoteAccounts",
                params: [
                    {
                        "votePubkey": votePubkey
                    }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (response.data.result.current[0] != null) {
                return response.data.result.current[0].epochVoteAccount;
            }
    
        } catch (error) {
            console.error('Failed to check validator status:', error);
            return false;
        }
    }

    // get testnet stake weight
    async getMainnetActivatedStake(votePubkey: string, apiKey: string) {
        try {
            if (await this.isMainnetValidator(votePubkey, apiKey)) {
                const response = await axios.post(`https://rpc.helius.xyz?api-key=${apiKey}`, {
                jsonrpc: "2.0",
                id: 1,
                method: "getVoteAccounts",
                params: [
                    {
                        "votePubkey": votePubkey
                    }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (response.data.result.current[0] != null) {
                const lamport_stake = response.data.result.current[0].activatedStake
                return Math.round(lamport_stake / LAMPORTS_PER_SOL);
            }
            return 0;
            }
    
        } catch (error) {
            console.error('Failed to check validator status:', error);
            return 0;
        }
    }

    async getOAuthTokens(code: string) {
        const url = 'https://discord.com/api/v10/oauth2/token';
        const body = new URLSearchParams({
            client_id: this.configService.get('validatorDiscord.clientId'),
            client_secret: this.configService.get('validatorDiscord.clientSecret'),
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.configService.get('validatorDiscord.oauthRedirectUri'),
        });
      
        const response = await fetch(url, {
          body,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        if (response.ok) {
          const data = await response.json();
          return data;
        } else {
          throw new Error(`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`);
        }
    }

    async getUserData(tokens) {
        const url = 'https://discord.com/api/v10/oauth2/@me';
        const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${tokens.access_token}`,
        },
        });
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error(`Error fetching user data: [${response.status}] ${response.statusText}`);
        }
    }

    async getUserDataWithAccessToken(access_token) {
        const url = 'https://discord.com/api/v10/oauth2/@me';
        const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
        });
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error(`Error fetching user data: [${response.status}] ${response.statusText}`);
        }
    }

    async getAccessToken(userId, tokens) {
        if (Date.now() > tokens.expires_at) {
            const url = 'https://discord.com/api/v10/oauth2/token';
            const body = new URLSearchParams({
                client_id: this.configService.get('validatorDiscord.clientId'),
                client_secret: this.configService.get('validatorDiscord.clientSecret'),
                grant_type: 'authorization_code',
                refresh_token: tokens.refresh_token,
            });
            const response = await fetch(url, {
                body,
                method: 'POST',
                headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            if (response.ok) {
                const tokens = await response.json();
                tokens.expires_at = Date.now() + tokens.expires_in * 1000;
                return tokens.access_token;
            } else {
                throw new Error(`Error refreshing access token: [${response.status}] ${response.statusText}`);
            }
        }
        return tokens.access_token;
    }

    async updateMetadataForUser(publicKey: PublicKey) {
        const discordUser = await this.getDiscordUserByPublicKey(publicKey);

        if (discordUser) {
            const accessAndRefreshTokens = await this.getAccessTokenWithRefreshToken(discordUser.refreshToken);

            // update the refresh token
            await this.validatorDiscordUserRepository.update(discordUser.id, {
                refreshToken: accessAndRefreshTokens.refresh_token,
            });

            const metadata = await this.calculateMetadata(publicKey.toBase58());

            const meData = await this.getUserDataWithAccessToken(accessAndRefreshTokens.access_token);
            const userId = meData.user.id;

            await this.pushMetadata(userId, accessAndRefreshTokens.access_token, metadata);
        }
        else {
            this.logger.error(`Discord user for ${publicKey.toBase58()} not found`);
            throw new Error('Discord user not found');
        }
    }

    async pushMetadata(userId, accessToken, metadata) {
        // PUT /users/@me/applications/:id/role-connection
        const url = `https://discord.com/api/v10/users/@me/applications/${this.configService.get('validatorDiscord.clientId')}/role-connection`;
        //const accessToken = await this.getAccessToken(userId, tokens);
        const body = {
            platform_name: 'Validator',
            metadata,
        };
        const response = await fetch(url, {
            method: 'PUT',
            body: JSON.stringify(body),
            headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Error pushing discord metadata: [${response.status}] ${response.statusText}`);
        }
      }

    async getAccessTokenWithRefreshToken(refreshToken: string) {
        const body = new URLSearchParams({
            client_id: this.configService.get('validatorDiscord.clientId'),
            client_secret: this.configService.get('validatorDiscord.clientSecret'),
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }).toString();
    
        const response = await fetch('https://discord.com/api/v10/oauth2/token', {
            body,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        console.log('refresh token 1: ', refreshToken);

        if (response.ok) {
            const tokens = await response.json();

            tokens.expires_at = Date.now() + tokens.expires_in * 1000;

            const access_token = tokens.access_token;
            const refresh_token = tokens.refresh_token;
            console.log('refresh token 2: ', refresh_token);

            return { access_token, refresh_token };
        }
        else {
            const errorText = await response.text();
            console.log("Error text: ", errorText);

            throw new Error(`Error refreshing access token: [${response.status}] ${response.statusText}`);
        }
    }

    getDiscordApplicationCredentials() {
        return {
          client_id: this.configService.get('validatorDiscord.clientId'),
          client_secret: this.configService.get('validatorDiscord.clientSecret'),
          public_key: this.configService.get('validatorDiscord.publicKey'),
        };
      }
    
    /**
    * Creates a new Discord user
    */
    async createDiscordUser(authId: string, publicKey: PublicKey, refreshToken: string) {
        const insertResult = await this.validatorDiscordUserRepository.upsert(
        {
            authId,
            publicKeyStr: publicKey.toBase58(),
            refreshToken,
        },
        { conflictPaths: ['authId'] },
        );

        console.log('initial refresh token: ', refreshToken)

        return insertResult;
  }

  /**
   * Returns a user by their ID
   */
  async getDiscordUserByPublicKey(publicKey: PublicKey) {
    const result = await this.validatorDiscordUserRepository.findOne({
      where: { publicKeyStr: publicKey.toBase58() },
    });
    return result;
  }
}
