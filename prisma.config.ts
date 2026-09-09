import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { migrationDatabaseUrl } from './scripts/prisma-database-url.mjs';

// Loaded by Prisma CLI only. The running API still reads the original pooled
// DATABASE_URL from its environment; no additional required secret is introduced.
const directUrl = migrationDatabaseUrl(process.env);
if (directUrl) process.env.DATABASE_URL = directUrl;

export default defineConfig({ schema: 'prisma/schema.prisma' });
