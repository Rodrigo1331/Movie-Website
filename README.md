# Reelbook — personal movie reviews

A personal film library: organise movies into sections, rate them 0–10 (one decimal), write reviews, and browse
a dark, poster-first UI. Movie data can be pulled from TMDB.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 · Node.js + Fastify 5 · SQLite (Node's built-in `node:sqlite`)

### Spoilers in reviews

Wrap any part of a review in double bars to hide it: `Loved it. ||The ending is a dream.|| Go see it.`
In the editor, select text and click **Mark as spoiler** (or press `Ctrl+Shift+S`). Use **Preview** to check how it looks.
On the movie page, hidden passages show as blacked-out bars that reveal on click, and there's a **Reveal all / Hide all**
toggle. The dashboard quote keeps spoilers hidden too.

### Movie roulette

**Roulette** (`/roulette`) spins a poster reel and picks a random film from your **Want to Watch** section
(or any section you choose), optionally filtered by genre and maximum runtime. Picks use the Web Crypto API, so they're
fair and unbiased. "Don't repeat picks" cycles through every film before any repeats. **Watch it now** adds the winner
to *Currently Watching* without removing it from Want to Watch.

### Aspect ratings

Below the overall rating, tick **Rate aspects separately** to also score story/plot, characters, acting, soundtrack
and enjoyment (0–10, each optional). Once any aspect is rated, the overall rating is
calculated automatically: the average of the rated aspects, rounded **up** to the next 0.5 (9.0 → 9, 9.1 → 9.5,
9.6 → 10). The movie page shows the breakdown. Unticking the box removes the aspect scores when you save.

### Light / dark theme

The sun/moon button in the header switches between the dark (default) and light theme. Your choice is saved in the
browser and applied before the page paints, so there's no flash.

## Requirements

- **Node.js 23.6 or newer** (developed on Node 26). The server runs TypeScript directly via Node's type stripping
  and uses the built-in SQLite driver, so there are no native modules to compile.

## Getting started

```bash
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# (optional) put your TMDB token in .env — see below
npm run dev
```

Open **http://localhost:5173**. The API runs on http://127.0.0.1:3001, and Vite proxies `/api` to it.

### Production-style run (single process)

```bash
npm run build     # builds the React app into client/dist
npm start         # Fastify serves the API and the built app at http://127.0.0.1:3001
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (auto-restarts on changes) + Vite dev server |
| `npm run build` | Type-check and build the client |
| `npm start` | Run the server, serving `client/dist` if it exists |
| `npm test` | API test suite (Node test runner; in-memory DB, mocked TMDB) |
| `npm run typecheck` | Type-check server and client |

## TMDB API key — secure configuration

1. Create a free account at <https://www.themoviedb.org/> → **Settings → API** → request an API key (personal use).
2. Copy the **API Read Access Token** (the long v4 token starting with `eyJ…`). A v3 "API Key" also works.
3. Put it in `.env` at the project root:
   ```
   TMDB_API_TOKEN=eyJhbGciOi...
   ```
4. Restart the server. The **Add movie** page now shows TMDB search.

How the key is kept safe:

- **It only lives in `.env`**, and `.env` is in `.gitignore`. `.env.example` documents the variable without a value.
- **Only the Node server reads it.** The browser calls our own `/api/tmdb/*` endpoints, and the server calls TMDB.
  The token never appears in client code, the built bundle or the browser's network tab.
- **Nothing is named `VITE_*`.** Vite inlines `VITE_`-prefixed variables into the browser bundle, so never name a
  secret that way.
- If the token is missing, the app still works with manual entry. If TMDB rejects it, the UI shows a clear error.
- Don't commit `.env` or paste the token into source files. If it ever leaks, regenerate it on TMDB's API settings page.

Posters and backdrops are loaded from TMDB's public image CDN (`image.tmdb.org`). Those URLs aren't secret.
This product uses the TMDB API but is not endorsed or certified by TMDB.

## Configuration (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `TMDB_API_TOKEN` | *(empty)* | TMDB v4 read token or v3 key. Optional. |
| `PORT` | `3001` | API/server port |
| `HOST` | `127.0.0.1` | Bind address (local only by default) |
| `DATABASE_PATH` | `server/data/movies.db` | SQLite file (relative paths are resolved from the repo root) |

## Data & persistence

Everything is stored in `server/data/movies.db` (SQLite, WAL mode), created automatically on first start.
Back it up by copying that file while the server is stopped. Schema migrations run automatically at startup and
are tracked in `schema_migrations`.

| Table | Purpose |
| --- | --- |
| `movies` | Film info: title, dates, director, description, poster/backdrop URLs, runtime, optional `tmdb_id` (unique) |
| `genres`, `movie_genres` | Genres (case-insensitive unique) and the many-to-many link |
| `ratings` | One score per movie, `REAL` with `CHECK (0 ≤ score ≤ 10)` |
| `reviews` | One written review per movie, plus the date watched |
| `aspect_ratings` | Optional per-aspect scores (story, characters, acting, soundtrack, enjoyment), 0–10 |
| `sections`, `movie_sections` | Custom sections (ordered) and many-to-many membership |

Deleting a movie cascades to its rating, aspect scores, review, genres links and section memberships. Deleting a section only
removes the section; its movies stay in your library. The five default sections are seeded once, and you can rename
or delete them.

## Project structure

```
packages/shared/     Shared TypeScript types (API contract)
server/src/
  config.ts          Env loading + validation
  db/                Connection, transactions, migrations
  lib/               Errors, zod validation schemas
  modules/
    movies/          Repository (queries, filters, sorting) + routes
    reviews/         Rating/review endpoints
    sections/        Section CRUD + ordering
    stats/           Dashboard aggregates
    tmdb/            Server-side TMDB client + proxy routes
  app.ts             Fastify app (routes, error handling, static client)
server/test/         API tests
client/src/
  api/               Typed fetch client + TanStack Query hooks
  components/        Poster cards, rating ring/input, section picker, modals, toasts…
  features/          Movie form, TMDB search
  pages/             Dashboard, Library, Movie detail, Add/Edit, Sections
```

## API overview

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/movies?q&genre&year&minRating&maxRating&section&sort&order&limit` | List/filter/sort (`sort`: rating, release, title, added, reviewed) |
| GET | `/api/movies/facets` | Genres (with counts) and years present in the library |
| POST | `/api/movies` | Add a movie (optionally with rating, review, date watched, sections) |
| GET / PATCH / DELETE | `/api/movies/:id` | Read / update / delete |
| PUT / DELETE | `/api/movies/:id/review` | Save or remove rating + review + date watched |
| PUT | `/api/movies/:id/sections` | Set the sections a movie belongs to |
| GET / POST | `/api/sections` | List / create |
| PATCH / DELETE | `/api/sections/:id` | Rename / delete |
| PUT | `/api/sections/order` | Reorder (`{ ids: [...] }`) |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/tmdb/status`, `/api/tmdb/search?q&page`, `/api/tmdb/movie/:tmdbId` | TMDB proxy |
