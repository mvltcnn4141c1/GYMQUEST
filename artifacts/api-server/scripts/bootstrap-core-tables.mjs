import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.characters (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT 'Rookie',
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      weekly_xp INTEGER NOT NULL DEFAULT 0,
      gym_coins INTEGER NOT NULL DEFAULT 0,
      gold INTEGER NOT NULL DEFAULT 0,
      gems INTEGER NOT NULL DEFAULT 0,
      hp INTEGER NOT NULL DEFAULT 100,
      stamina INTEGER NOT NULL DEFAULT 100,
      strength INTEGER NOT NULL DEFAULT 10,
      league TEXT NOT NULL DEFAULT 'iron',
      referral_code TEXT,
      friend_code TEXT,
      referral_count INTEGER NOT NULL DEFAULT 0,
      referred_by TEXT,
      timezone TEXT DEFAULT 'UTC',
      tier TEXT NOT NULL DEFAULT 'common',
      has_accepted_disclaimer BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'common';
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS has_accepted_disclaimer BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS league TEXT NOT NULL DEFAULT 'iron';
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS referred_by TEXT;
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS class TEXT NOT NULL DEFAULT 'fighter';
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'global';
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS instagram_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS twitter_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE public.characters
    DROP COLUMN IF EXISTS race;
  `);

  await pool.query(`
    ALTER TABLE public.workouts
    ADD COLUMN IF NOT EXISTS is_liftoff_template BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.auth_tokens (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.workouts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      reps INTEGER NOT NULL DEFAULT 0,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      intensity TEXT DEFAULT 'medium',
      earned_xp INTEGER NOT NULL DEFAULT 0,
      earned_coins INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.exercise_library (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      exercise_name TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      category TEXT NOT NULL,
      default_sets INTEGER NOT NULL DEFAULT 3,
      default_reps INTEGER NOT NULL DEFAULT 10,
      default_duration_min INTEGER NOT NULL DEFAULT 0,
      how_to_tip TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const exerciseLibrarySeed = [
    // Gogus (10)
    ["bench-press", "Bench Press", "bench_press", "gogus", "strength", 4, 8, 0, "Kurek kemiklerini sikistir, ayaklari yere sabitle, bar yolunu gogus ortasinda kontrol et."],
    ["incline-bench-press", "Incline Bench Press", "incline_bench_press", "gogus", "strength", 4, 8, 0, "45 dereceyi gecme, dirsekleri omuz hatti altinda tut, barı ust goguse kontrollu indir."],
    ["decline-bench-press", "Decline Bench Press", "decline_bench_press", "gogus", "strength", 3, 10, 0, "Bel boslugunu koru, barı alt goguse indirirken omuzlari bankta sabit tut."],
    ["dumbbell-fly", "Dumbbell Fly", "dumbbell_fly", "gogus", "hypertrophy", 3, 12, 0, "Dirsekleri hafif kir, avuclari ayni hizada tutup hareketi yay cizer gibi kapat."],
    ["cable-fly", "Cable Fly", "cable_fly", "gogus", "hypertrophy", 3, 12, 0, "Gogsu onde birlestirirken omuzlari yukari cekme, hareket boyunca core aktif kalsin."],
    ["push-up", "Push-Up", "push_up", "gogus", "bodyweight", 4, 15, 0, "Vucudu plank cizgisinde tut, gogus yere yaklasirken kalca dusmesin."],
    ["dips", "Dips", "dips", "gogus", "bodyweight", 3, 10, 0, "Govdeyi hafif one eg, dirsekleri kilitlemeden yukari it, omuz kontrolunu bozma."],
    ["machine-chest-press", "Machine Chest Press", "machine_chest_press", "gogus", "strength", 3, 12, 0, "Koltuk yuksekligini meme hizasina ayarla, itis sonunda dirsekleri tam kilitleme."],
    ["pec-deck", "Pec Deck", "pec_deck", "gogus", "hypertrophy", 3, 12, 0, "Kurek kemiklerini geride tut, kollari hizla degil sabit tempoda birlestir."],
    ["close-grip-push-up", "Close Grip Push-Up", "close_grip_push_up", "gogus", "bodyweight", 3, 12, 0, "Elleri omuz altinda tut, dirsekleri govdeye yakin indirip coreu sik."],
    // Sirt (10)
    ["deadlift", "Deadlift", "deadlift", "sirt", "strength", 5, 5, 0, "Bari bacağa yakin tut, kalca-ve-gogus ayni anda kalksin, bel dogal kaviste kalsin."],
    ["pull-up", "Pull-Up", "pull_up", "sirt", "bodyweight", 4, 8, 0, "Omuzlari kulaktan uzaklastir, gogsu bara dogru cek, salinimle tekrar calma."],
    ["barbell-row", "Barbell Row", "barbell_row", "sirt", "strength", 4, 8, 0, "Bel acisini sabit tut, bari alt goguse cek, boynu omurga hatti ile hizala."],
    ["seated-cable-row", "Seated Cable Row", "seated_cable_row", "sirt", "hypertrophy", 3, 12, 0, "Cekis sonunda kurekleri sik, omuzlari onde birakmadan kontrollu geri don."],
    ["lat-pulldown", "Lat Pulldown", "lat_pulldown", "sirt", "hypertrophy", 3, 10, 0, "Bari enseye degil gogus ustune cek, dirsekleri asagi ve geriye sur."],
    ["single-arm-row", "Single Arm Row", "single_arm_row", "sirt", "hypertrophy", 3, 12, 0, "Kalca rotasyonunu engelle, dambili kalcaya dogru cek, karnini aktif tut."],
    ["t-bar-row", "T-Bar Row", "t_bar_row", "sirt", "strength", 4, 10, 0, "Govde acisini sabitle, cekisi dirsekle yonlendir, boynu norel pozisyonda koru."],
    ["face-pull", "Face Pull", "face_pull", "sirt", "prehab", 3, 15, 0, "Ipi yuze cekerken dirsekleri yuksek tut, omuz arkalarinda sikismayi hisset."],
    ["reverse-fly", "Reverse Fly", "reverse_fly", "sirt", "hypertrophy", 3, 15, 0, "Kucuk agirlikla basla, hareketi salinimsiz yap, scapula kontrolunu koru."],
    ["straight-arm-pulldown", "Straight Arm Pulldown", "straight_arm_pulldown", "sirt", "hypertrophy", 3, 12, 0, "Dirsek acisini sabit tut, lati asagi bastirarak hareket et, beli oynatma."],
    // Bacak (10)
    ["back-squat", "Back Squat", "squat", "bacak", "strength", 5, 5, 0, "Ayaklar omuz genisligi, dizler ayak ucuyla ayni yonde, coreu nefesle kilitle."],
    ["front-squat", "Front Squat", "front_squat", "bacak", "strength", 4, 6, 0, "Dirsekleri yuksek tut, gogsu dusurme, cıkışta orta ayaktan kuvvet aktar."],
    ["leg-press", "Leg Press", "leg_press", "bacak", "strength", 4, 10, 0, "Belini koltuga tam yasla, dizleri iceri kacirma, platformu kontrollu it."],
    ["romanian-deadlift", "Romanian Deadlift", "romanian_deadlift", "bacak", "strength", 4, 8, 0, "Kalca menteşesi yap, bari bacağa yakin indir, hamstring gerilimini koru."],
    ["walking-lunge", "Walking Lunge", "lunge", "bacak", "bodyweight", 3, 12, 0, "Adimi fazla uzun atma, on diz ayakla hizali olsun, govde dik kal."],
    ["bulgarian-split-squat", "Bulgarian Split Squat", "bulgarian_split_squat", "bacak", "hypertrophy", 3, 10, 0, "Arka ayagi sabitle, one agirlik ver, alt noktada dengeyi bozmadan kalk."],
    ["hip-thrust", "Hip Thrust", "hip_thrust", "bacak", "strength", 4, 10, 0, "Ceneyi hafif iceri al, ustte kalcayi tam sık, beli asiri arkaya atma."],
    ["leg-curl", "Leg Curl", "leg_curl", "bacak", "hypertrophy", 3, 12, 0, "Kalcalari pedde sabit tut, tekrar sonunu ziplatmadan yavas birak."],
    ["leg-extension", "Leg Extension", "leg_extension", "bacak", "hypertrophy", 3, 12, 0, "Dizi kilitlemeden tepe noktada 1 sn tut, inişi yavaslat."],
    ["calf-raise", "Calf Raise", "calf_raise", "bacak", "hypertrophy", 4, 15, 0, "Alt noktada topugu tamamen indir, ustte baldiri aktif sekilde sik."],
    // Karsilasma/Kardiyo (10)
    ["burpee", "Burpee", "burpee", "karsilasma_kardiyo", "conditioning", 4, 12, 0, "Yere inis-cikis ritmini koru, belini dusurmeden patlayici sekilde yuksel."],
    ["row-erg", "Row Erg", "row", "karsilasma_kardiyo", "conditioning", 5, 1, 4, "Itis gucunu bacaktan baslat, cekisi kalca-govde-kol sirasi ile tamamla."],
    ["running", "Running", "running", "karsilasma_kardiyo", "cardio", 1, 0, 25, "Kisa adim-frekans odakli kos, omuzlari gevsek tut, nefesi ritmik yonet."],
    ["cycling", "Cycling", "cycling", "karsilasma_kardiyo", "cardio", 1, 0, 30, "Sele yuksekligini diz acisina gore ayarla, pedal cevirisini sabit kadansta tut."],
    ["jump-rope", "Jump Rope", "jump_rope", "karsilasma_kardiyo", "conditioning", 6, 1, 2, "Bilekten cevir, dusuk ziplama kullan, omuzlari kasmadan ritmi koru."],
    ["mountain-climber", "Mountain Climber", "mountain_climber", "karsilasma_kardiyo", "conditioning", 4, 20, 0, "Plank cizgini bozma, diz cekisini kalca sallamadan hizli ve kontrollu yap."],
    ["box-jump", "Box Jump", "box_jump", "karsilasma_kardiyo", "power", 5, 6, 0, "Sessiz inis yap, diz-kalca ayni hatta olsun, yuksekligi teknik bozulmadan sec."],
    ["sled-push", "Sled Push", "sled_push", "karsilasma_kardiyo", "conditioning", 6, 1, 1, "Govdeyi one ver, kisa-guclu adimlarla it, topuk yerine orta ayak kullan."],
    ["battle-rope", "Battle Rope", "battle_rope", "karsilasma_kardiyo", "conditioning", 6, 1, 1, "Coreu kilitle, dalga ritmini sabit tut, omuz yorgunlugunda formu bozma."],
    ["assault-bike", "Assault Bike", "assault_bike", "karsilasma_kardiyo", "conditioning", 8, 1, 1, "Ilk 5 sn kontrollu hizlan, direnc yükselince nefesi koruyup cadence tuttur."],
  ];

  for (const exercise of exerciseLibrarySeed) {
    await pool.query(
      `
      INSERT INTO public.exercise_library
      (slug, exercise_name, exercise_type, muscle_group, category, default_sets, default_reps, default_duration_min, how_to_tip, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
      ON CONFLICT (slug) DO UPDATE SET
        exercise_name = EXCLUDED.exercise_name,
        exercise_type = EXCLUDED.exercise_type,
        muscle_group = EXCLUDED.muscle_group,
        category = EXCLUDED.category,
        default_sets = EXCLUDED.default_sets,
        default_reps = EXCLUDED.default_reps,
        default_duration_min = EXCLUDED.default_duration_min,
        how_to_tip = EXCLUDED.how_to_tip,
        is_active = TRUE,
        updated_at = NOW()
      `,
      exercise
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_penalties (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      penalty_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.workout_audit_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      workout_id INTEGER,
      action TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.suspicious_activity (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'equipment',
      icon TEXT NOT NULL DEFAULT 'dumbbell',
      price_coins INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.purchases (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 1,
      currency TEXT NOT NULL DEFAULT 'gym_coin',
      total_cost INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.active_boosts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      boost_type TEXT NOT NULL,
      multiplier INTEGER NOT NULL DEFAULT 1,
      starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_quests (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      quest_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      progress INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMP,
      claimed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.daily_quests (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      quest_date TEXT NOT NULL,
      quest_type TEXT NOT NULL DEFAULT 'daily',
      target INTEGER NOT NULL DEFAULT 1,
      progress INTEGER NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      xp_reward INTEGER NOT NULL DEFAULT 40,
      coin_reward INTEGER NOT NULL DEFAULT 20,
      gem_reward INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.party_members (
      id SERIAL PRIMARY KEY,
      party_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.parties (
      id SERIAL PRIMARY KEY,
      leader_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL,
      max_members INTEGER NOT NULL DEFAULT 4,
      total_xp INTEGER NOT NULL DEFAULT 0,
      league TEXT NOT NULL DEFAULT 'demir',
      clan_battle_points INTEGER NOT NULL DEFAULT 0,
      clan_war_wins INTEGER NOT NULL DEFAULT 0,
      champion_banner_until TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE public.parties
    ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE public.parties
    ADD COLUMN IF NOT EXISTS league TEXT NOT NULL DEFAULT 'demir';
  `);
  await pool.query(`
    ALTER TABLE public.parties
    ADD COLUMN IF NOT EXISTS clan_battle_points INTEGER NOT NULL DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE public.parties
    ADD COLUMN IF NOT EXISTS clan_war_wins INTEGER NOT NULL DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE public.parties
    ADD COLUMN IF NOT EXISTS champion_banner_until TIMESTAMP;
  `);
  await pool.query(`
    ALTER TABLE public.parties
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS champion_banner_until TIMESTAMP;
  `);
  await pool.query(`
    ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS elite_tier_until TIMESTAMP;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.daily_economy (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      economy_date TEXT NOT NULL,
      coins_earned INTEGER NOT NULL DEFAULT 0,
      gems_earned INTEGER NOT NULL DEFAULT 0,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      workout_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_daily_economy_user_date UNIQUE (user_id, economy_date)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.notifications (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.character_achievements (
      id SERIAL PRIMARY KEY,
      character_id INTEGER NOT NULL,
      user_id TEXT,
      achievement_key TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      unlocked_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE public.character_achievements
    ADD COLUMN IF NOT EXISTS achievement_key TEXT;
  `);

  await pool.query(`
    ALTER TABLE public.character_achievements
    ADD COLUMN IF NOT EXISTS user_id TEXT;
  `);

  await pool.query(`
    ALTER TABLE public.character_achievements
    ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.referrals (
      id SERIAL PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      code_used TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE public.referrals
    ADD COLUMN IF NOT EXISTS referrer_id TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.seasons (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      max_level INTEGER NOT NULL DEFAULT 50,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ends_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.weekly_activity (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      workouts_done INTEGER NOT NULL DEFAULT 0,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      rewards_claimed BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_battle_pass (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      season_id INTEGER NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      is_premium BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.battle_pass_claims (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      season_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      track TEXT NOT NULL,
      claimed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.challenges (
      id SERIAL PRIMARY KEY,
      challenger_id TEXT NOT NULL,
      challenged_id TEXT NOT NULL,
      challenger_score INTEGER NOT NULL DEFAULT 0,
      challenged_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.iap_products (
      id TEXT PRIMARY KEY,
      sku TEXT,
      title TEXT NOT NULL,
      description TEXT,
      price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
      gem_amount INTEGER NOT NULL DEFAULT 0,
      coin_amount INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.iap_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      idempotency_key TEXT,
      stripe_payment_intent_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.daily_offers (
      id SERIAL PRIMARY KEY,
      offer_date TEXT NOT NULL,
      product_id TEXT NOT NULL,
      discount_pct INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.purchase_analytics (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      event_type TEXT NOT NULL,
      product_id TEXT,
      amount_usd NUMERIC(10,2),
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'characters', 'auth_tokens', 'workouts', 'user_penalties', 'workout_audit_logs', 'suspicious_activity',
        'items', 'purchases', 'active_boosts', 'user_quests', 'daily_quests', 'party_members', 'daily_economy', 'notifications',
        'character_achievements', 'seasons', 'weekly_activity', 'user_battle_pass', 'battle_pass_claims', 'challenges',
        'iap_products', 'iap_purchases', 'daily_offers', 'purchase_analytics', 'referrals'
      )
    ORDER BY table_name;
  `);

  console.log("Core tables ready:", tables.rows.map((r) => r.table_name).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
