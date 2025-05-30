/*
  Warnings:

  - You are about to drop the column `highlights` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Note` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Note" DROP COLUMN "highlights",
DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "Tile" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "highlights" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "noteId" TEXT NOT NULL,

    CONSTRAINT "Tile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Tile" ADD CONSTRAINT "Tile_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
