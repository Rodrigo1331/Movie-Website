import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const serverRoot = fileURLToPath(new URL('..', import.meta.url));
export const repoRoot = path.resolve(serverRoot, '..');

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  tmdbToken: string | null;
  clientDistPath: string;
}

/** Loads `.env` from the repository root (if present) and validates configuration. */
export function loadConfig(): AppConfig {
  const envFile = path.join(repoRoot, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${process.env.PORT}". Expected an integer between 1 and 65535.`);
  }

  const dbEnv = process.env.DATABASE_PATH?.trim();
  const databasePath = dbEnv
    ? dbEnv === ':memory:' ? dbEnv : path.resolve(repoRoot, dbEnv)
    : path.join(serverRoot, 'data', 'movies.db');

  return {
    port,
    host: process.env.HOST?.trim() || '127.0.0.1',
    databasePath,
    tmdbToken: process.env.TMDB_API_TOKEN?.trim() || null,
    clientDistPath: path.join(repoRoot, 'client', 'dist'),
  };
}
