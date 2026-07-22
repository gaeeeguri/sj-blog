import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: baseSchema,
});

const fitness = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/fitness' }),
  schema: baseSchema.extend({
    workoutType: z.enum(['strength', 'cardio', 'mobility', 'hiit', 'other']).optional(),
    durationMinutes: z.number().positive().optional(),
    distanceKm: z.number().positive().optional(),
    paceMinPerKm: z.number().positive().optional(),
    avgHeartRate: z.number().int().positive().optional(),
    elevationM: z.number().optional(),
  }),
});

const hotspotSchema = z.object({
  view: z.enum(['front', 'back']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  label: z.string(),
  description: z.string(),
  image: z.string().optional(),
});

const clothing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/clothing' }),
  schema: baseSchema.extend({
    brand: z.string().optional(),
    category: z.string().optional(),
    madeIn: z.string().optional(),
    price: z.number().nonnegative().optional(),
    purchasedDate: z.coerce.date().optional(),
    purchasePlace: z.string().optional(),
    measurements: z.string().optional(),
    frontImage: z.string().optional(),
    backImage: z.string().optional(),
    story: z.string().optional(),
    storyQuote: z.string().optional(),
    care: z.array(z.string()).default([]),
    hotspots: z.array(hotspotSchema).default([]),
  }),
});

export const collections = { posts, fitness, clothing };
