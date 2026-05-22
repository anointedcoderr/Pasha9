// Built by Anointed Coder.
// PrismaClient singleton. The instance is cached on globalThis in dev so HMR does not
// open a new connection on every reload.

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __pasha9_prisma__: PrismaClient | undefined;
}

const log = process.env.NODE_ENV === 'production'
  ? ['error' as const]
  : ['warn' as const, 'error' as const];

export const db = globalThis.__pasha9_prisma__ ?? new PrismaClient({ log });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pasha9_prisma__ = db;
}

export type { Prisma } from '@prisma/client';
