ALTER TABLE "products" ADD COLUMN "final_price_cents" bigint;--> statement-breakpoint
--> Rows that predate the column transacted before negotiated pricing existed, so the listed price is
--> the only defensible value. Hand-added: the constraint below is validated against existing rows.
UPDATE "products" SET "final_price_cents" = "price_cents" WHERE "status" <> 'Available';--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_final_price_matches_status" CHECK (("products"."status" = 'Available') = ("products"."final_price_cents" is null));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_final_price_cents_positive" CHECK ("products"."final_price_cents" is null or "products"."final_price_cents" > 0);