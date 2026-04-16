# Tier Validation Checklist

## API Tier Boundaries

- [ ] Level 1 character returns `tier=common`
- [ ] Level 11 character returns `tier=uncommon`
- [ ] Level 21 character returns `tier=rare`
- [ ] Level 31 character returns `tier=epic`
- [ ] Level 41 character returns `tier=legendary`
- [ ] Level 51 character returns `tier=mythic`

## Progression Flow

- [ ] `POST /api/character` sets `tier` from level
- [ ] `POST /api/workouts` updates `tier` when level changes
- [ ] Boss reward level-ups also recalculate `tier`
- [ ] `GET /api/character` always returns a non-empty `tier`

## Data Safety

- [ ] `db:bootstrap` keeps `characters.tier` column present
- [ ] `db:backfill:tier` normalizes old/invalid tier values

## UI Validation

- [ ] Home screen shows tier badge next to character name
- [ ] Badge label matches API tier key
- [ ] Unknown tier falls back to `COMMON` badge safely

