-- characters: shaker tier + günlük turbo (ilk antrenman) takibi
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS equipped_shaker_tier integer NOT NULL DEFAULT 0;
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS last_workout_date timestamptz;
