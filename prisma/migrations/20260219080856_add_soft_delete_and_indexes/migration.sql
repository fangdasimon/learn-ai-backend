-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Note_userId_createdAt_idx" ON "Note"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Note_title_idx" ON "Note"("title");
