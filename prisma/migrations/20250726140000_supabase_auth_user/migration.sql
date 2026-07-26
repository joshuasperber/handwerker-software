-- Link Prisma users to Supabase Auth identities.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supabaseUserId" TEXT;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseUserId_key" ON "User"("supabaseUserId");
CREATE INDEX IF NOT EXISTS "User_supabaseUserId_idx" ON "User"("supabaseUserId");
