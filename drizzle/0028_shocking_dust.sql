CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message_content" json NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp
);
