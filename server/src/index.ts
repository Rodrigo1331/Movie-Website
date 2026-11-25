import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { createTmdbClient } from './modules/tmdb/client.ts';
import { createOmdbClient } from './modules/external/omdb.ts';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const app = await buildApp({
  db,
  tmdb: createTmdbClient({ token: config.tmdbToken }),
  omdb: createOmdbClient({ apiKey: config.omdbApiKey }),
  clientDistPath: config.clientDistPath,
  logger: { level: 'info' },
});

app.log.info(`Database: ${config.databasePath}`);
if (!config.tmdbToken) {
  app.log.warn('TMDB_API_TOKEN is not set — TMDB search is disabled (manual entry still works). See README.');
}
if (!config.omdbApiKey) {
  app.log.warn('OMDB_API_KEY is not set — IMDb / Rotten Tomatoes / Metacritic scores are disabled. See README.');
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  db.close();
  process.exit(1);
}
