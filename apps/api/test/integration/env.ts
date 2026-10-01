import { integrationEnv } from './test-env';

// Runs in each test worker before any application module is imported.
Object.assign(process.env, integrationEnv());
