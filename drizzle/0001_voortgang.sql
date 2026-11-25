CREATE TABLE "voortgang" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registratie_id" uuid NOT NULL,
	"tekst" text NOT NULL,
	"door" uuid NOT NULL,
	"op" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voortgang" ADD CONSTRAINT "voortgang_registratie_id_registraties_id_fk" FOREIGN KEY ("registratie_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voortgang" ADD CONSTRAINT "voortgang_door_gebruikers_id_fk" FOREIGN KEY ("door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;