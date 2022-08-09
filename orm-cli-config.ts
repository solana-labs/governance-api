import * as path from 'path';

import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { DataSource } from 'typeorm';

const env = dotenv.config({ path: '.env' });
dotenvExpand.expand(env);

export default new DataSource({
  type: 'postgres',
  connectTimeoutMS: 3000,
  entities: [path.join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: ['./migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_USE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  url: process.env.DATABASE_URL,
  username: process.env.DATABASE_USERNAME,
});
