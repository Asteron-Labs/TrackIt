import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { createApp } from './app';
import { env } from './common/config';

async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`TrackIt API listening on port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start TrackIt API:', err);
  process.exit(1);
});
