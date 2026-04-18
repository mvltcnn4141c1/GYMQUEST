import { pgTable, text, integer, boolean, timestamp, jsonb, serial, numeric } from "drizzle-orm/pg-core";

export const charactersTable = pgTable("characters", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull().default("Rookie"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  weeklyXp: integer("weekly_xp").notNull().default(0),
  gymCoins: integer("gym_coins").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  gems: integer("gems").notNull().default(0),
  hp: integer("hp").notNull().default(100),
  stamina: integer("stamina").notNull().default(100),
  strength: integer("strength").notNull().default(10),
  league: text("league").notNull().default("iron"),
  referralCode: text("referral_code"),
  friendCode: text("friend_code"),
  referralCount: integer("referral_count").notNull().default(0),
  referredBy: text("referred_by"),
  timezone: text("timezone").default("UTC"),
  class: text("class").notNull().default("fighter"),
  region: text("region").notNull().default("global"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  championBannerUntil: timestamp("champion_banner_until"),
  eliteTierUntil: timestamp("elite_tier_until"),
  tier: text("tier").notNull().default("common"),
  hasAcceptedDisclaimer: boolean("has_accepted_disclaimer").notNull().default(false),
  lastWorkoutAt: timestamp("last_workout_at"),
  /** Takvim günü bazlı günlük turbo (ilk antrenman) kontrolü için son antrenman zamanı */
  lastWorkoutDate: timestamp("last_workout_date"),
  /** Kuplu (shaker) görünüm / bonus katmanı için ekipman seviyesi (0 = yok) */
  equippedShakerTier: integer("equipped_shaker_tier").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const questsTable = pgTable("quests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  questType: text("quest_type").notNull().default("daily"),
  objectiveType: text("objective_type").notNull().default("workout_count"),
  targetValue: integer("target_value").notNull().default(1),
  rewardXp: integer("reward_xp").notNull().default(50),
  rewardCoins: integer("reward_coins").notNull().default(25),
  rewardGems: integer("reward_gems").notNull().default(0),
  difficulty: text("difficulty").notNull().default("normal"),
  dayNumber: integer("day_number").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userQuestsTable = pgTable("user_quests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  questId: integer("quest_id").notNull(),
  status: text("status").notNull().default("active"),
  progress: integer("progress").notNull().default(0),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyQuestsTable = pgTable("daily_quests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  questDate: text("quest_date").notNull(),
  questType: text("quest_type").notNull().default("daily"),
  target: integer("target").notNull().default(1),
  progress: integer("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  xpReward: integer("xp_reward").notNull().default(40),
  coinReward: integer("coin_reward").notNull().default(20),
  gemReward: integer("gem_reward").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workoutsTable = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  exerciseType: text("exercise_type").notNull(),
  isLiftoffTemplate: boolean("is_liftoff_template").notNull().default(false),
  reps: integer("reps").notNull().default(0),
  durationSec: integer("duration_sec").notNull().default(0),
  intensity: text("intensity").default("medium"),
  earnedXp: integer("earned_xp").notNull().default(0),
  earnedCoins: integer("earned_coins").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const partiesTable = pgTable("parties", {
  id: serial("id").primaryKey(),
  leaderUserId: text("leader_user_id").notNull(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull(),
  maxMembers: integer("max_members").notNull().default(4),
  totalXp: integer("total_xp").notNull().default(0),
  league: text("league").notNull().default("demir"),
  clanBattlePoints: integer("clan_battle_points").notNull().default(0),
  clanWarWins: integer("clan_war_wins").notNull().default(0),
  championBannerUntil: timestamp("champion_banner_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const partyMembersTable = pgTable("party_members", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const bossEventsTable = pgTable("boss_events", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull(),
  bossName: text("boss_name").notNull(),
  hpTotal: integer("hp_total").notNull().default(1000),
  hpRemaining: integer("hp_remaining").notNull().default(1000),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export const eventContributionsTable = pgTable("event_contributions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: text("user_id").notNull(),
  damage: integer("damage").notNull().default(0),
  workoutsCount: integer("workouts_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const seasonsTable = pgTable("seasons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  maxLevel: integer("max_level").notNull().default(50),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userBattlePassTable = pgTable("user_battle_pass", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  seasonId: integer("season_id").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  isPremium: boolean("is_premium").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const battlePassClaimsTable = pgTable("battle_pass_claims", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  seasonId: integer("season_id").notNull(),
  level: integer("level").notNull(),
  track: text("track").notNull(),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
});

export const iapProductsTable = pgTable("iap_products", {
  id: text("id").primaryKey(),
  sku: text("sku"),
  title: text("title").notNull(),
  description: text("description"),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  gemAmount: integer("gem_amount").notNull().default(0),
  coinAmount: integer("coin_amount").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iapPurchasesTable = pgTable("iap_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  idempotencyKey: text("idempotency_key"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  itemType: text("item_type").notNull(),
  itemId: text("item_id").notNull(),
  amount: integer("amount").notNull().default(1),
  currency: text("currency").notNull().default("coins"),
  totalCost: integer("total_cost").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const itemsTable = pgTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("equipment"),
  icon: text("icon").notNull().default("dumbbell"),
  priceCoins: integer("price_coins").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activeBoostsTable = pgTable("active_boosts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  boostType: text("boost_type").notNull(),
  multiplier: integer("multiplier").notNull().default(1),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const workoutAuditLogsTable = pgTable("workout_audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  workoutId: integer("workout_id"),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const characterAchievementsTable = pgTable("character_achievements", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  userId: text("user_id"),
  achievementKey: text("achievement_key").notNull(),
  progress: integer("progress").notNull().default(0),
  unlockedAt: timestamp("unlocked_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyRewardsTable = pgTable("daily_rewards", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  rewardDay: integer("reward_day").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weeklyActivityTable = pgTable("weekly_activity", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStart: text("week_start").notNull(),
  workoutsDone: integer("workouts_done").notNull().default(0),
  xpEarned: integer("xp_earned").notNull().default(0),
  rewardsClaimed: boolean("rewards_claimed").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const comebackRewardsTable = pgTable("comeback_rewards", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull().default("inactive_return"),
  rewardCoins: integer("reward_coins").notNull().default(0),
  rewardGems: integer("reward_gems").notNull().default(0),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authTokensTable = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyOffersTable = pgTable("daily_offers", {
  id: serial("id").primaryKey(),
  offerDate: text("offer_date").notNull(),
  productId: text("product_id").notNull(),
  discountPct: integer("discount_pct").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseAnalyticsTable = pgTable("purchase_analytics", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  eventType: text("event_type").notNull(),
  productId: text("product_id"),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referredUserId: text("referred_user_id").notNull(),
  codeUsed: text("code_used").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analyticsEventsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  eventName: text("event_name").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const friendsTable = pgTable("friends", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  friendId: text("friend_id").notNull(),
  status: text("status").notNull().default("accepted"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const challengesTable = pgTable("challenges", {
  id: serial("id").primaryKey(),
  challengerId: text("challenger_id").notNull(),
  challengedId: text("challenged_id").notNull(),
  challengerScore: integer("challenger_score").notNull().default(0),
  challengedScore: integer("challenged_score").notNull().default(0),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const leaderboardSnapshotsTable = pgTable("leaderboard_snapshots", {
  id: serial("id").primaryKey(),
  metric: text("metric").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suspiciousActivityTable = pgTable("suspicious_activity", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userPenaltiesTable = pgTable("user_penalties", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  penaltyType: text("penalty_type").notNull(),
  reason: text("reason").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyEconomyTable = pgTable("daily_economy", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  earnedCoins: integer("earned_coins").notNull().default(0),
  spentCoins: integer("spent_coins").notNull().default(0),
  earnedGems: integer("earned_gems").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
