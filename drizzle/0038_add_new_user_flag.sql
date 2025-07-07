ALTER TABLE "mew_user" ADD COLUMN "new_user" boolean NOT NULL DEFAULT true;
UPDATE "mew_user" SET "new_user"=false;