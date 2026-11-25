CREATE TABLE "delegaties" (
	"project_id" uuid NOT NULL,
	"gebruiker_id" uuid NOT NULL,
	"actief" boolean DEFAULT true NOT NULL,
	"sinds" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delegaties_project_id_gebruiker_id_pk" PRIMARY KEY("project_id","gebruiker_id")
);
--> statement-breakpoint
CREATE TABLE "document_objecten" (
	"document_id" uuid NOT NULL,
	"object_id" uuid NOT NULL,
	CONSTRAINT "document_objecten_document_id_object_id_pk" PRIMARY KEY("document_id","object_id")
);
--> statement-breakpoint
CREATE TABLE "document_uitsluitingen" (
	"document_id" uuid NOT NULL,
	"registratie_id" uuid NOT NULL,
	"reden" text NOT NULL,
	"door" uuid NOT NULL,
	"op" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_uitsluitingen_document_id_registratie_id_pk" PRIMARY KEY("document_id","registratie_id")
);
--> statement-breakpoint
CREATE TABLE "documenten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"nummer" text NOT NULL,
	"titel" text NOT NULL,
	"discipline" text,
	"revisie" text NOT NULL,
	"status" text NOT NULL,
	"fase_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fasen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"volgorde" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gebruikers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"naam" text NOT NULL,
	"email" text NOT NULL,
	CONSTRAINT "gebruikers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "historie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"gebruiker_id" uuid NOT NULL,
	"entiteit" text NOT NULL,
	"entiteit_id" uuid NOT NULL,
	"actie" text NOT NULL,
	"oud" jsonb,
	"nieuw" jsonb,
	"op" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "melding_objecten" (
	"melding_id" uuid NOT NULL,
	"object_id" uuid NOT NULL,
	CONSTRAINT "melding_objecten_melding_id_object_id_pk" PRIMARY KEY("melding_id","object_id")
);
--> statement-breakpoint
CREATE TABLE "meldingen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"nummer" text NOT NULL,
	"titel" text NOT NULL,
	"omschrijving" text NOT NULL,
	"fase_id" uuid NOT NULL,
	"status" text DEFAULT 'nieuw' NOT NULL,
	"bron_soort" text DEFAULT 'waarneming' NOT NULL,
	"bron_ref" text,
	"gemeld_door" uuid NOT NULL,
	"gemeld_op" timestamp with time zone DEFAULT now() NOT NULL,
	"vervallen_reden" text,
	"beoordeeld_door" uuid
);
--> statement-breakpoint
CREATE TABLE "nummerteller" (
	"project_id" uuid NOT NULL,
	"soort" text NOT NULL,
	"laatste" integer NOT NULL,
	CONSTRAINT "nummerteller_project_id_soort_pk" PRIMARY KEY("project_id","soort")
);
--> statement-breakpoint
CREATE TABLE "object_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"fase_id" uuid NOT NULL,
	"bestandsnaam" text NOT NULL,
	"uitgevoerd_door" uuid NOT NULL,
	"uitgevoerd_op" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objecten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"naam" text NOT NULL,
	"niveau" integer NOT NULL,
	"objecttype" text NOT NULL,
	"toepassing" text,
	"locatie" text,
	"ouder_id" uuid,
	"extern" boolean DEFAULT false NOT NULL,
	"eigenaar_organisatie" text,
	"eigenaar_id" uuid,
	"actief" boolean DEFAULT true NOT NULL,
	"laatste_import_id" uuid,
	CONSTRAINT "objecten_project_id_code_unique" UNIQUE("project_id","code")
);
--> statement-breakpoint
CREATE TABLE "projecten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"naam" text NOT NULL,
	"nummer" text NOT NULL,
	"actieve_fase_id" uuid,
	"inbox_signaal_werkdagen" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectleden" (
	"project_id" uuid NOT NULL,
	"gebruiker_id" uuid NOT NULL,
	"rol" text NOT NULL,
	CONSTRAINT "projectleden_project_id_gebruiker_id_pk" PRIMARY KEY("project_id","gebruiker_id")
);
--> statement-breakpoint
CREATE TABLE "raakvlak_kanten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registratie_id" uuid NOT NULL,
	"object_id" uuid NOT NULL,
	"verantwoordelijke_id" uuid,
	"afgestemd_op" timestamp with time zone,
	"afgestemd_bron" text,
	"verwerkt_op" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rapport_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"revisie" text NOT NULL,
	"vastgelegd_door" uuid NOT NULL,
	"vastgelegd_op" timestamp with time zone DEFAULT now() NOT NULL,
	"inhoud" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registratie_bronnen" (
	"registratie_id" uuid NOT NULL,
	"melding_id" uuid NOT NULL,
	CONSTRAINT "registratie_bronnen_registratie_id_melding_id_pk" PRIMARY KEY("registratie_id","melding_id")
);
--> statement-breakpoint
CREATE TABLE "registratie_koppelingen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registratie_id" uuid NOT NULL,
	"soort" text NOT NULL,
	"object_id" uuid,
	"objecttype" text,
	"toepassing" text,
	"bereik_object_id" uuid,
	"te_herkoppelen" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registratie_relaties" (
	"van_id" uuid NOT NULL,
	"naar_id" uuid NOT NULL,
	"soort" text NOT NULL,
	CONSTRAINT "registratie_relaties_van_id_naar_id_soort_pk" PRIMARY KEY("van_id","naar_id","soort")
);
--> statement-breakpoint
CREATE TABLE "registraties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" text NOT NULL,
	"nummer" text NOT NULL,
	"titel" text NOT NULL,
	"omschrijving" text DEFAULT '' NOT NULL,
	"fase_id" uuid NOT NULL,
	"status" text NOT NULL,
	"discipline" text,
	"eigenaar_id" uuid,
	"aangemaakt_door" uuid NOT NULL,
	"aangemaakt_op" timestamp with time zone DEFAULT now() NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goedgekeurd_door" uuid,
	"goedgekeurd_onder_delegatie" boolean DEFAULT false NOT NULL,
	"goedgekeurd_op" timestamp with time zone,
	"afwijs_toelichting" text,
	"verwerkt_door" uuid,
	"verwerkt_op" timestamp with time zone,
	"vervangen_door_id" uuid
);
--> statement-breakpoint
ALTER TABLE "delegaties" ADD CONSTRAINT "delegaties_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegaties" ADD CONSTRAINT "delegaties_gebruiker_id_gebruikers_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_objecten" ADD CONSTRAINT "document_objecten_document_id_documenten_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documenten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_objecten" ADD CONSTRAINT "document_objecten_object_id_objecten_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."objecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uitsluitingen" ADD CONSTRAINT "document_uitsluitingen_document_id_documenten_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documenten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uitsluitingen" ADD CONSTRAINT "document_uitsluitingen_registratie_id_registraties_id_fk" FOREIGN KEY ("registratie_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uitsluitingen" ADD CONSTRAINT "document_uitsluitingen_door_gebruikers_id_fk" FOREIGN KEY ("door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documenten" ADD CONSTRAINT "documenten_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documenten" ADD CONSTRAINT "documenten_fase_id_fasen_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."fasen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fasen" ADD CONSTRAINT "fasen_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historie" ADD CONSTRAINT "historie_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historie" ADD CONSTRAINT "historie_gebruiker_id_gebruikers_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "melding_objecten" ADD CONSTRAINT "melding_objecten_melding_id_meldingen_id_fk" FOREIGN KEY ("melding_id") REFERENCES "public"."meldingen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "melding_objecten" ADD CONSTRAINT "melding_objecten_object_id_objecten_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."objecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meldingen" ADD CONSTRAINT "meldingen_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meldingen" ADD CONSTRAINT "meldingen_fase_id_fasen_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."fasen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meldingen" ADD CONSTRAINT "meldingen_gemeld_door_gebruikers_id_fk" FOREIGN KEY ("gemeld_door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meldingen" ADD CONSTRAINT "meldingen_beoordeeld_door_gebruikers_id_fk" FOREIGN KEY ("beoordeeld_door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nummerteller" ADD CONSTRAINT "nummerteller_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_imports" ADD CONSTRAINT "object_imports_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_imports" ADD CONSTRAINT "object_imports_fase_id_fasen_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."fasen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_imports" ADD CONSTRAINT "object_imports_uitgevoerd_door_gebruikers_id_fk" FOREIGN KEY ("uitgevoerd_door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objecten" ADD CONSTRAINT "objecten_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objecten" ADD CONSTRAINT "objecten_ouder_id_objecten_id_fk" FOREIGN KEY ("ouder_id") REFERENCES "public"."objecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objecten" ADD CONSTRAINT "objecten_eigenaar_id_gebruikers_id_fk" FOREIGN KEY ("eigenaar_id") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objecten" ADD CONSTRAINT "objecten_laatste_import_id_object_imports_id_fk" FOREIGN KEY ("laatste_import_id") REFERENCES "public"."object_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projectleden" ADD CONSTRAINT "projectleden_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projectleden" ADD CONSTRAINT "projectleden_gebruiker_id_gebruikers_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raakvlak_kanten" ADD CONSTRAINT "raakvlak_kanten_registratie_id_registraties_id_fk" FOREIGN KEY ("registratie_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raakvlak_kanten" ADD CONSTRAINT "raakvlak_kanten_object_id_objecten_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."objecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raakvlak_kanten" ADD CONSTRAINT "raakvlak_kanten_verantwoordelijke_id_gebruikers_id_fk" FOREIGN KEY ("verantwoordelijke_id") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapport_snapshots" ADD CONSTRAINT "rapport_snapshots_document_id_documenten_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documenten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapport_snapshots" ADD CONSTRAINT "rapport_snapshots_vastgelegd_door_gebruikers_id_fk" FOREIGN KEY ("vastgelegd_door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registratie_bronnen" ADD CONSTRAINT "registratie_bronnen_registratie_id_registraties_id_fk" FOREIGN KEY ("registratie_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registratie_bronnen" ADD CONSTRAINT "registratie_bronnen_melding_id_meldingen_id_fk" FOREIGN KEY ("melding_id") REFERENCES "public"."meldingen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registratie_koppelingen" ADD CONSTRAINT "registratie_koppelingen_registratie_id_registraties_id_fk" FOREIGN KEY ("registratie_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registratie_koppelingen" ADD CONSTRAINT "registratie_koppelingen_object_id_objecten_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."objecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registratie_koppelingen" ADD CONSTRAINT "registratie_koppelingen_bereik_object_id_objecten_id_fk" FOREIGN KEY ("bereik_object_id") REFERENCES "public"."objecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registratie_relaties" ADD CONSTRAINT "registratie_relaties_van_id_registraties_id_fk" FOREIGN KEY ("van_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registratie_relaties" ADD CONSTRAINT "registratie_relaties_naar_id_registraties_id_fk" FOREIGN KEY ("naar_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registraties" ADD CONSTRAINT "registraties_project_id_projecten_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projecten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registraties" ADD CONSTRAINT "registraties_fase_id_fasen_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."fasen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registraties" ADD CONSTRAINT "registraties_eigenaar_id_gebruikers_id_fk" FOREIGN KEY ("eigenaar_id") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registraties" ADD CONSTRAINT "registraties_aangemaakt_door_gebruikers_id_fk" FOREIGN KEY ("aangemaakt_door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registraties" ADD CONSTRAINT "registraties_goedgekeurd_door_gebruikers_id_fk" FOREIGN KEY ("goedgekeurd_door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registraties" ADD CONSTRAINT "registraties_verwerkt_door_gebruikers_id_fk" FOREIGN KEY ("verwerkt_door") REFERENCES "public"."gebruikers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registraties" ADD CONSTRAINT "registraties_vervangen_door_id_registraties_id_fk" FOREIGN KEY ("vervangen_door_id") REFERENCES "public"."registraties"("id") ON DELETE no action ON UPDATE no action;