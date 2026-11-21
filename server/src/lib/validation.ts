import { z } from 'zod';
import { badRequest } from './errors.ts';

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = issues[0];
    throw badRequest(first ? `${first.path || 'request'}: ${first.message}` : 'Invalid request', issues);
  }
  return result.data;
}

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Invalid calendar date');

const nullableDate = z.preprocess(blankToNull, isoDate.nullable()).optional();
const nullableText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable()).optional();
const nullableUrl = z
  .preprocess(blankToNull, z.string().trim().max(2000).regex(/^https?:\/\/\S+$/i, 'Must be an http(s) URL').nullable())
  .optional();

export const ratingSchema = z
  .number()
  .min(0, 'Rating must be between 0 and 10')
  .max(10, 'Rating must be between 0 and 10')
  .transform((v) => Math.round(v * 10) / 10);

const idList = z.array(z.number().int().positive()).max(200);

export const movieInputSchema = z.object({
  tmdbId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(300),
  releaseDate: nullableDate,
  releaseYear: z.number().int().min(1870).max(2100).nullable().optional(),
  director: nullableText(300),
  description: nullableText(5000),
  posterUrl: nullableUrl,
  backdropUrl: nullableUrl,
  runtime: z.number().int().min(0).max(2000).nullable().optional(),
  genres: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  rating: ratingSchema.nullable().optional(),
  review: nullableText(20000),
  dateWatched: nullableDate,
  sectionIds: idList.optional(),
});

export const movieUpdateSchema = movieInputSchema.partial();

export const reviewInputSchema = z.object({
  rating: ratingSchema.nullable(),
  body: z.string().max(20000).default(''),
  dateWatched: nullableDate,
});

export const movieSectionsSchema = z.object({ sectionIds: idList });

const optionalNumber = <T extends z.ZodType>(inner: T) => z.preprocess(blankToUndefined, inner.optional());

export const listQuerySchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(200).optional()),
  genre: z.preprocess(blankToUndefined, z.string().trim().max(50).optional()),
  year: optionalNumber(z.coerce.number().int().min(1800).max(2200)),
  minRating: optionalNumber(z.coerce.number().min(0).max(10)),
  maxRating: optionalNumber(z.coerce.number().min(0).max(10)),
  section: optionalNumber(z.coerce.number().int().positive()),
  sort: z.preprocess(blankToUndefined, z.enum(['rating', 'release', 'title', 'added', 'reviewed']).default('added')),
  order: z.preprocess(blankToUndefined, z.enum(['asc', 'desc']).optional()),
  limit: optionalNumber(z.coerce.number().int().min(1).max(500)),
});

export const sectionNameSchema = z.string().trim().min(1, 'Section name is required').max(60);
export const sectionCreateSchema = z.object({ name: sectionNameSchema });
export const sectionUpdateSchema = z.object({ name: sectionNameSchema.optional() });
export const sectionOrderSchema = z.object({ ids: idList.min(1) });

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
