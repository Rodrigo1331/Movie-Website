import type { Section } from '@moviesite/shared';
import { transaction, type DB } from '../../db/database.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';

interface SectionRow {
  id: number;
  name: string;
  slug: string;
  position: number;
  is_default: number;
  created_at: string;
  movie_count: number;
}

const toSection = (r: SectionRow): Section => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  position: r.position,
  isDefault: r.is_default === 1,
  movieCount: r.movie_count,
  createdAt: r.created_at,
});

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

const SELECT = `
  SELECT s.*, (SELECT COUNT(*) FROM movie_sections ms WHERE ms.section_id = s.id) AS movie_count
  FROM sections s`;

export function createSectionsRepository(db: DB) {
  const listStmt = db.prepare(`${SELECT} ORDER BY s.position, s.id`);
  const getStmt = db.prepare(`${SELECT} WHERE s.id = ?`);
  const nameTakenStmt = db.prepare('SELECT id FROM sections WHERE name = ? AND id != ?');

  function assertNameFree(name: string, exceptId = 0) {
    if (nameTakenStmt.get(name, exceptId)) throw conflict(`A section named "${name}" already exists`);
  }

  function get(id: number): Section {
    const row = getStmt.get(id) as unknown as SectionRow | undefined;
    if (!row) throw notFound('Section');
    return toSection(row);
  }

  return {
    list: (): Section[] => (listStmt.all() as unknown as SectionRow[]).map(toSection),

    get,

    create(name: string): Section {
      assertNameFree(name);
      const { next } = db.prepare('SELECT COALESCE(MAX(position) + 1, 0) AS next FROM sections').get() as { next: number };
      const result = db
        .prepare('INSERT INTO sections (name, slug, position, is_default) VALUES (?, ?, ?, 0)')
        .run(name, slugify(name), next);
      return get(Number(result.lastInsertRowid));
    },

    rename(id: number, name: string): Section {
      get(id);
      assertNameFree(name, id);
      db.prepare('UPDATE sections SET name = ?, slug = ? WHERE id = ?').run(name, slugify(name), id);
      return get(id);
    },

    reorder(ids: number[]): Section[] {
      const all = listStmt.all() as unknown as SectionRow[];
      const unique = new Set(ids);
      if (unique.size !== ids.length || ids.length !== all.length || all.some((s) => !unique.has(s.id))) {
        throw badRequest('ids must list every section exactly once');
      }
      const update = db.prepare('UPDATE sections SET position = ? WHERE id = ?');
      transaction(db, () => ids.forEach((id, index) => update.run(index, id)));
      return (listStmt.all() as unknown as SectionRow[]).map(toSection);
    },

    delete(id: number): void {
      const result = db.prepare('DELETE FROM sections WHERE id = ?').run(id);
      if (result.changes === 0) throw notFound('Section');
    },

    /** Throws a 400 if any of the ids do not exist. */
    assertExist(ids: number[]): void {
      if (ids.length === 0) return;
      const missing = db
        .prepare('SELECT value FROM json_each(?) WHERE value NOT IN (SELECT id FROM sections)')
        .all(JSON.stringify(ids))
        .map((r) => Number(r.value));
      if (missing.length) throw badRequest(`Unknown section id(s): ${missing.join(', ')}`, { missing });
    },
  };
}

export type SectionsRepository = ReturnType<typeof createSectionsRepository>;
