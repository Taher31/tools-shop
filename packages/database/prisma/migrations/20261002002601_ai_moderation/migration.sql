-- AlterTable
ALTER TABLE "ProductQuestion" ADD COLUMN     "answeredByAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expertNotice" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "aiNote" TEXT,
ADD COLUMN     "aiVerdict" TEXT;
