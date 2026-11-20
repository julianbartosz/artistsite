-- Saves the artist's palette from her painting "Blessing" (deep cobalt with an ember accent)
-- as her site colors. Every other saved identity and appearance setting is kept.
DO $$
DECLARE
  palette jsonb := '{"primaryColor": "#1a3a82", "accentColor": "#c4451c", "artworkPalette": {"image": "", "swatches": ["#1a3a82", "#c4451c"]}}';
  identity jsonb;
BEGIN
  BEGIN
    SELECT value::jsonb INTO identity FROM "SiteSetting" WHERE key = 'SITE_IDENTITY_JSON';
  EXCEPTION WHEN others THEN
    identity := NULL;
  END;

  IF identity IS NULL OR jsonb_typeof(identity) <> 'object' THEN
    identity := '{}'::jsonb;
  END IF;

  IF jsonb_typeof(identity -> 'theme') = 'object' THEN
    identity := jsonb_set(identity, '{theme}', (identity -> 'theme') || palette);
  ELSE
    identity := jsonb_set(identity, '{theme}', palette);
  END IF;

  INSERT INTO "SiteSetting" ("key", "value", "encrypted", "updatedAt")
  VALUES ('SITE_IDENTITY_JSON', identity::text, false, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO UPDATE
    SET "value" = EXCLUDED."value", "encrypted" = false, "updatedAt" = CURRENT_TIMESTAMP;
END $$;
