ALTER TABLE "relation_lists" DROP CONSTRAINT "relation_lists_node_id_relation_id_pinned_unique";--> statement-breakpoint
CREATE TYPE "relation_lists_type" AS ENUM ('pinned', 'noteContent', 'all');
ALTER TABLE "relation_lists" ADD COLUMN "type" "relation_lists_type";--> statement-breakpoint
UPDATE "relation_lists" SET "type" = CASE WHEN "pinned" = true THEN 'pinned'::relation_lists_type ELSE 'all'::relation_lists_type END;
ALTER TABLE "relation_lists" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "relation_lists" DROP COLUMN IF EXISTS "pinned";--> statement-breakpoint
ALTER TABLE "relation_lists" ADD CONSTRAINT "relation_lists_node_id_relation_id_type_unique" UNIQUE("node_id","relation_id","type");