CREATE TYPE "public"."request_policy" AS ENUM('everyone', 'verified_only', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'restricted', 'suspended', 'banned');--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"photo_key" text,
	"home_country" char(2),
	"bio" text,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"show_age" boolean DEFAULT false NOT NULL,
	"show_university" boolean DEFAULT false NOT NULL,
	"request_policy" "request_policy" DEFAULT 'everyone' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_display_name_length" CHECK (char_length("user_profiles"."display_name") between 1 and 50),
	CONSTRAINT "user_profiles_home_country_format" CHECK ("user_profiles"."home_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "user_profiles_bio_length" CHECK (char_length("user_profiles"."bio") <= 300),
	CONSTRAINT "user_profiles_interests_max" CHECK (cardinality("user_profiles"."interests") <= 5)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider_id" text NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"date_of_birth" date NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_provider_id_key" ON "users" USING btree ("auth_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));