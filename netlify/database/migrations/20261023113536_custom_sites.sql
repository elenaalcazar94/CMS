-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "template" TEXT;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "globalFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'blocks';

-- CreateTable
CREATE TABLE "TemplateFile" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "html" TEXT,
    "storageKey" TEXT,
    "title" TEXT,
    "fieldCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateFile_siteId_path_key" ON "TemplateFile"("siteId", "path");

-- AddForeignKey
ALTER TABLE "TemplateFile" ADD CONSTRAINT "TemplateFile_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
