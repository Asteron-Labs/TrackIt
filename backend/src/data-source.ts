import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './common/config';

/**
 * The single TypeORM DataSource for the application. Used both by the running API
 * and by the TypeORM CLI for migrations (`npm run migration:run|revert`).
 *
 * `synchronize` is off permanently — schema changes go through migrations only.
 * The entity and migration globs use `__dirname` so they resolve both under
 * ts-node-dev (`src/**`) and after a build (`dist/**`).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  username: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  entities: [__dirname + '/modules/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
});
