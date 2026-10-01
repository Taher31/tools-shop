import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';
import { loadEnvFiles, parseEnv } from './env';

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => {
        loadEnvFiles();
        return new AppConfig(parseEnv());
      },
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
