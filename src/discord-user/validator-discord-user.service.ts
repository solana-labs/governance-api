import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { Repository } from 'typeorm';

import { ConfigService } from '@src/config/config.service';
import axios from "axios";
import { ValidatorDiscordUser } from './entities/ValidatorDiscordUser.entity';

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
            //await storage.storeDiscordTokens(userId, tokens);
            return tokens.access_token;
        } else {
            throw new Error(`Error refreshing access token: [${response.status}] ${response.statusText}`);
        }
        }
        return tokens.access_token;
    }

    // async updateMetadata(userId) {
    //     // Fetch the Discord tokens from storage
    //     const tokens = await storage.getDiscordTokens(userId);
          
    //     let metadata = {};
    //     try {
    //       // Fetch the new metadata you want to use from an external source. 
    //       // This data could be POST-ed to this endpoint, but every service
    //       // is going to be different.  To keep the example simple, we'll
    //       // just generate some random data. 
    //       metadata = {
    //         cookieseaten: 1483,
    //         allergictonuts: 0, // 0 for false, 1 for true
    //         firstcookiebaked: '2003-12-20',
    //       };
    //     } catch (e) {
    //       e.message = `Error fetching external data: ${e.message}`;
    //       console.error(e);
    //       // If fetching the profile data for the external service fails for any reason,
    //       // ensure metadata on the Discord side is nulled out. This prevents cases
    //       // where the user revokes an external app permissions, and is left with
    //       // stale linked role data.
    //     }
      
    //     // Push the data to Discord.
    //     await discord.pushMetadata(userId, tokens, metadata);
    //   }
      

    async pushMetadata(userId, tokens, metadata) {
        // PUT /users/@me/applications/:id/role-connection
        const url = `https://discord.com/api/v10/users/@me/applications/${this.configService.get('validatorDiscord.clientId')}/role-connection`;
        const accessToken = await this.getAccessToken(userId, tokens);
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
        const { client_id, client_secret } = this.getDiscordApplicationCredentials();
        const body = new URLSearchParams({
          client_id,
          client_secret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString();
    
        const response = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });
    
        const { access_token: accessToken, refresh_token } = await response.json();
        return { accessToken, refreshToken: refresh_token };
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
