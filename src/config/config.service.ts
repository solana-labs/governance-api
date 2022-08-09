import { Injectable } from '@nestjs/common';
import type { Path } from '@nestjs/config';
import { ConfigService as _ConfigService } from '@nestjs/config';

export interface Config {
  app: {
    port: number;
    host?: string;
  };
  database: {
    password: string | undefined;
    url: string;
    username: string | undefined;
    useSsl: boolean;
  };
  jwt: {
    userSecret: string;
  };
}

@Injectable()
export class ConfigService extends _ConfigService<Config, true> {
  get<P extends Path<Config>>(path: P) {
    const value = super.get(path, { infer: true });
    return value;
  }
}
