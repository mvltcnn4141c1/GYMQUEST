import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import type { CharacterClass, LeagueTier, CharacterTier } from "@/context/GameContext";
import { useGame } from "@/context/GameContext";
import { CLASS_COLORS, COLORS } from "@/constants/colors";

type Props = {
  characterClass: CharacterClass;
  level: number;
  league: LeagueTier;
  streakActive?: boolean;
  equippedAura?: string | null;
  size?: number;
  showTierLabel?: boolean;
  tier?: CharacterTier;
  variant?: "compact" | "hero";
  forceTier3?: boolean;
  /** 0: yok, 1: plastik, 2: çelik, 3: altın shaker (assets/avatars) */
  equippedShakerTier?: number;
  /** Sonraki antrenmanda günlük turbo (+10% XP) uygulanacaksa */
  isTurboActive?: boolean;
};

const TIER_IMAGE_SVG: Record<string, string> = {
  common: "#9AA0AA",
  uncommon: "#49C46B",
  rare: "#4DA3FF",
  epic: "#B97CFF",
  legendary: "#FFB84D",
  mythic: "#FF5EC9",
};

const TIER_GLOW_PRESETS: Record<string, { color: string; opacity: number; radius: number; scale: number }> = {
  common: { color: "#9AA0AA", opacity: 0.2, radius: 8, scale: 1.06 },
  uncommon: { color: "#49C46B", opacity: 0.24, radius: 10, scale: 1.08 },
  rare: { color: "#4DA3FF", opacity: 0.32, radius: 13, scale: 1.1 },
  epic: { color: "#B97CFF", opacity: 0.4, radius: 16, scale: 1.12 },
  legendary: { color: "#FFB84D", opacity: 0.5, radius: 20, scale: 1.15 },
  mythic: { color: "#FF5EC9", opacity: 0.58, radius: 24, scale: 1.18 },
};

const LEVEL_STAGE_LABELS = ["INITIATE", "VETERAN", "CHAMPION", "MYTHIC"] as const;
export const TIER4_ASSET_PATHS: Record<string, string> = {
  fighter: "../assets/avatars/fighter-tier-4.png",
  barbarian: "../assets/avatars/barbarian-tier-4.png",
  yuce_insan: "../assets/avatars/yuce-insan-tier-4.png",
  gece_elfi: "../assets/avatars/gece-elfi-tier-4.png",
  buyucu: "../assets/avatars/buyucu-tier-4.png",
  suikastci: "../assets/avatars/suikastci-tier-4.png",
};

const CLASS_GLOW_COLOR: Record<string, string> = {
  barbarian: "#FF6A3D",
  fighter: "#F28C52",
  warrior: "#F28C52",
  paladin: "#F4C542",
  rogue: "#6AD3FF",
  archer: "#66D97A",
  ranger: "#66D97A",
  mage: "#4DA3FF",
  wizard: "#4DA3FF",
  cleric: "#8ED5FF",
};

const AURA_COLOR_MAP: Record<string, string> = {
  aura_gri: "#C0C0C0",
  gri: "#C0C0C0",
  aura_alev: "#FF6B35",
  alev: "#FF6B35",
  aura_buz: "#7EC8E3",
  buz: "#7EC8E3",
  aura_firtina: "#9B59B6",
  firtina: "#9B59B6",
  aura_altin: "#FFD700",
  altin: "#FFD700",
  aura_elmas: "#B9F2FF",
  elmas: "#B9F2FF",
  aura_sampiyonluk: "#FF4DFF",
  sampiyonluk: "#FF4DFF",
};

const CLASS_ICON_MAP: Record<string, string> = {
  fighter: "sword-cross",
  warrior: "sword",
  barbarian: "hammer-war",
  paladin: "shield-crown",
  rogue: "knife-military",
  archer: "bow-arrow",
  ranger: "bow-arrow",
  mage: "magic-staff",
  wizard: "wizard-hat",
  cleric: "hand-heart",
};

const LEAGUE_AURA_COLOR: Record<string, string> = {
  iron: "#7A7F88",
  bronze: "#B0724A",
  silver: "#DDE3EF",
  gold: "#F4C542",
  platinum: "#8ED5FF",
  diamond: "#5EA2FF",
  master: "#C47AFF",
  demir: "#7A7F88",
  bronz: "#B0724A",
  gumus: "#DDE3EF",
  altin: "#F4C542",
  platin: "#8ED5FF",
  sampiyonluk: "#F4C542",
};

const AVATAR_BY_CLASS_AND_TIER = {
  fighter: {
    1: require("../assets/avatars/fighter-tier-1.png"),
    2: require("../assets/avatars/fighter-tier-2.png"),
    3: require("../assets/avatars/fighter-tier-3.png"),
  },
  barbarian: {
    1: require("../assets/avatars/barbarian-tier-1.png"),
    2: require("../assets/avatars/barbarian-tier-2.png"),
    3: require("../assets/avatars/barbarian-tier-3.png"),
  },
  yuce_insan: {
    1: require("../assets/avatars/yuce-insan-tier-1.png"),
    2: require("../assets/avatars/yuce-insan-tier-2.png"),
    3: require("../assets/avatars/yuce-insan-tier-3.png"),
  },
  gece_elfi: {
    1: require("../assets/avatars/gece-elfi-tier-1.png"),
    2: require("../assets/avatars/gece-elfi-tier-2.png"),
    3: require("../assets/avatars/gece-elfi-tier-3.png"),
  },
  buyucu: {
    1: require("../assets/avatars/buyucu-tier-1.png"),
    2: require("../assets/avatars/buyucu-tier-2.png"),
    3: require("../assets/avatars/buyucu-tier-3.png"),
  },
  suikastci: {
    1: require("../assets/avatars/suikastci-tier-1.png"),
    2: require("../assets/avatars/suikastci-tier-2.png"),
    3: require("../assets/avatars/suikastci-tier-3.png"),
  },
} as const;

/** Shaker overlay: false yaparsan katman cizilmez (require'lar yine paketlenir). */
const USE_SHAKER_ASSETS = true;

const SHAKER_SOURCES = {
  1: require("../assets/avatars/shaker-tier-1.png"),
  2: require("../assets/avatars/shaker-tier-2.png"),
  3: require("../assets/avatars/shaker-tier-3.png"),
} as const;

function resolveAvatarTier(level: number): 1 | 2 | 3 {
  if (level >= 21) return 3;
  if (level >= 11) return 2;
  return 1;
}

function resolveEvolutionStage(level: number): 1 | 2 | 3 | 4 {
  if (level >= 50) return 4;
  if (level >= 25) return 3;
  if (level >= 10) return 2;
  return 1;
}

function normalizeAvatarClass(rawClass: string): keyof typeof AVATAR_BY_CLASS_AND_TIER {
  const normalized = String(rawClass || "")
    .trim()
    .toLowerCase()
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u")
    .replace(/[\s-]+/g, "_");

  if (["barbar", "barbarian"].includes(normalized)) return "barbarian";
  if (["yuce_insan", "human", "warrior"].includes(normalized)) return "yuce_insan";
  if (["gece_elfi", "night_elf", "elf"].includes(normalized)) return "gece_elfi";
  if (["buyucu", "mage", "wizard"].includes(normalized)) return "buyucu";
  if (["suikastci", "assassin", "rogue"].includes(normalized)) return "suikastci";
  return "fighter";
}

export function CharacterImage({
  characterClass,
  level,
  league,
  equippedAura,
  size = 120,
  tier = "common",
  showTierLabel = false,
  variant = "compact",
  forceTier3 = false,
  equippedShakerTier = 0,
  isTurboActive = false,
}: Props) {
  const { highGraphicsEnabled, lowPerformanceDevice } = useGame();
  const graphicsScale = (!highGraphicsEnabled || lowPerformanceDevice) ? 0.3 : 1;
  const pulseAnim = useMemo(() => new Animated.Value(0), []);
  const evolveAnim = useMemo(() => new Animated.Value(1), []);
  const turboPulse = useMemo(() => new Animated.Value(0), []);
  const [primaryImageFailed, setPrimaryImageFailed] = useState(false);
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false);
  const [displayAvatarSource, setDisplayAvatarSource] = useState<any>(null);
  const [incomingAvatarSource, setIncomingAvatarSource] = useState<any>(null);
  const prevAvatarClassRef = useRef<string | null>(null);
  const color = CLASS_COLORS[characterClass] || COLORS.gold;
  const tierKey = String(tier || "common").toLowerCase();
  const tierRingColor = TIER_IMAGE_SVG[tierKey] || TIER_IMAGE_SVG.common;
  const glowPreset = TIER_GLOW_PRESETS[tierKey] || TIER_GLOW_PRESETS.common;
  const classKey = String(characterClass || "").toLowerCase();
  const classIcon = CLASS_ICON_MAP[classKey] || "shield-account";
  const avatarClass = useMemo(() => normalizeAvatarClass(classKey), [classKey]);
  const avatarTier = useMemo(() => (forceTier3 ? 3 : resolveAvatarTier(level)), [level, forceTier3]);
  const evolutionStage = useMemo(() => (forceTier3 ? 4 : resolveEvolutionStage(level)), [level, forceTier3]);
  const isHero = variant === "hero";
  const primaryAvatarSource = AVATAR_BY_CLASS_AND_TIER[avatarClass][avatarTier];
  const targetAvatarSource = primaryImageFailed ? null : primaryAvatarSource;
  const avatarImageSource = displayAvatarSource || targetAvatarSource;
  const canRenderAvatarImage = !!avatarImageSource && !fallbackImageFailed;
  const displayIcon = classIcon;
  const auraColor = level >= 2 ? color : tierRingColor;
  const leagueAura = LEAGUE_AURA_COLOR[String(league || "iron").toLowerCase()] || tierRingColor;
  const classGlowColor = CLASS_GLOW_COLOR[classKey] || color;
  const glowBaseColor = glowPreset.color;
  const glowMixColor = level >= 11 ? classGlowColor : glowBaseColor;
  const isTier3Avatar = avatarTier === 3;
  const equippedAuraKey = String(equippedAura || "").toLowerCase();
  const auraFxColor = AURA_COLOR_MAP[equippedAuraKey] || null;

  useEffect(() => {
    setPrimaryImageFailed(false);
    setFallbackImageFailed(false);
  }, [classKey, level]);

  useEffect(() => {
    const prev = prevAvatarClassRef.current;
    if (prev != null && prev !== avatarClass) {
      setPrimaryImageFailed(false);
      setFallbackImageFailed(false);
      setIncomingAvatarSource(null);
      evolveAnim.setValue(1);
      setDisplayAvatarSource(AVATAR_BY_CLASS_AND_TIER[avatarClass][avatarTier]);
    }
    prevAvatarClassRef.current = avatarClass;
  }, [avatarClass, avatarTier, evolveAnim]);

  useEffect(() => {
    if (!displayAvatarSource) {
      setDisplayAvatarSource(targetAvatarSource);
      return;
    }
    if (displayAvatarSource === targetAvatarSource) return;
    setIncomingAvatarSource(targetAvatarSource);
    evolveAnim.setValue(0);
    Animated.timing(evolveAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setDisplayAvatarSource(targetAvatarSource);
        setIncomingAvatarSource(null);
      }
    });
  }, [displayAvatarSource, targetAvatarSource, evolveAnim]);

  useEffect(() => {
    if (!isTurboActive) {
      turboPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(turboPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(turboPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isTurboActive, turboPulse]);

  useEffect(() => {
    if (!highGraphicsEnabled || lowPerformanceDevice) {
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [highGraphicsEnabled, lowPerformanceDevice, pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.02, glowPreset.scale],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [glowPreset.opacity * 0.45, glowPreset.opacity],
  });
  const innerGlowScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.03],
  });
  const auraPulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.95],
  });
  const heroScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, variant === "hero" ? 1.03 : 1.01],
  });
  const badgePulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.72],
  });

  const stageLabel = LEVEL_STAGE_LABELS[evolutionStage - 1];
  const imageSizeRatio = isHero ? 0.86 : 0.72;
  const frameRadius = isHero ? 22 : 999;
  const frameBg = isHero ? "#0E1522" : COLORS.surfaceElevated;
  const containerHeight = isHero ? size * 1.28 : size;
  const innerGlowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, Math.min(0.6, glowPreset.opacity + 0.08)],
  });

  const shakerTier = Math.min(3, Math.max(0, Math.floor(Number(equippedShakerTier) || 0)));
  const shakerSource =
    USE_SHAKER_ASSETS && shakerTier > 0 ? SHAKER_SOURCES[shakerTier as 1 | 2 | 3] : null;
  const shakerSize = size * (isHero ? 0.34 : 0.36);
  const turboRingOpacity = turboPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.48],
  });
  const turboRingScale = turboPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const turboBadgeOpacity = turboPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const handleAvatarImageError = () => {
    if (!primaryImageFailed) {
      setPrimaryImageFailed(true);
      return;
    }
    if (isHero) {
      setPrimaryImageFailed(true);
      setFallbackImageFailed(false);
      return;
    }
    setFallbackImageFailed(true);
  };

  return (
    <View style={[styles.wrap, { width: size, height: containerHeight }]}>
      {isTurboActive ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.turboBackRing,
            {
              width: size * 1.14,
              height: size * 1.14,
              top: isHero ? size * 0.06 : size * 0.02,
              opacity: turboRingOpacity,
              transform: [{ scale: turboRingScale }],
            },
          ]}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tierPulseGlow,
          {
            zIndex: 2,
            width: isHero ? size * 1.06 : size * 1.2,
            height: isHero ? size * 1.06 : size * 1.2,
            borderColor: `${glowMixColor}99`,
            shadowColor: glowMixColor,
            shadowOpacity: glowPreset.opacity * graphicsScale,
            shadowRadius: glowPreset.radius * graphicsScale,
          },
          {
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.innerBreathGlow,
          {
            zIndex: 3,
            width: isHero ? size * 0.94 : size * 0.98,
            height: isHero ? size * 0.94 : size * 0.98,
            backgroundColor: `${glowMixColor}33`,
          },
          {
            opacity: innerGlowOpacity,
            transform: [{ scale: innerGlowScale }],
          },
        ]}
      />
      {isTier3Avatar ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tier3ConquerorAura,
            {
              zIndex: 4,
              width: isHero ? size * 1.22 : size * 1.28,
              height: isHero ? size * 1.22 : size * 1.28,
              borderColor: `${glowMixColor}DD`,
              shadowColor: glowMixColor,
              opacity: auraPulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
      ) : null}
      {auraFxColor ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.auraGlow,
            {
              zIndex: 4,
              width: isHero ? size * 1.14 : size * 1.2,
              height: isHero ? size * 1.14 : size * 1.2,
              borderColor: `${auraFxColor}CC`,
              borderWidth: isHero ? 4 : 3,
              backgroundColor: `${auraFxColor}1F`,
              shadowColor: auraFxColor,
              shadowOpacity: 0.9,
              shadowRadius: isHero ? 24 : 18,
              elevation: 10,
              opacity: auraPulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
      ) : null}
      {level >= 2 ? (
        <View
          style={[
            styles.leagueAura,
            {
              zIndex: 5,
              width: isHero ? size * 1.03 : size * 1.1,
              height: isHero ? size * 1.03 : size * 1.1,
              borderColor: `${leagueAura}77`,
              shadowColor: leagueAura,
              shadowOpacity: 0.45 * graphicsScale,
              shadowRadius: 14 * graphicsScale,
            },
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.circle,
          {
            zIndex: 10,
            borderColor: tierRingColor,
            shadowColor: tierRingColor,
            shadowOpacity: (isHero ? 0.32 : 0.25) * graphicsScale,
            shadowRadius: (isHero ? 14 : 10) * graphicsScale,
            borderRadius: frameRadius,
            backgroundColor: frameBg,
          },
          isHero ? styles.heroFrame : null,
          { transform: [{ scale: heroScale }] },
        ]}
      >
        {canRenderAvatarImage ? (
          <View style={{ width: size * imageSizeRatio, height: size * imageSizeRatio }}>
            <Animated.View style={[styles.crossFadeLayer, { opacity: incomingAvatarSource ? 1 : evolveAnim }]}>
              <ExpoImage
                key={`avatar-out-${avatarClass}-${avatarTier}`}
                source={avatarImageSource}
                style={[
                  styles.rankImage,
                  {
                    width: size * imageSizeRatio,
                    height: size * imageSizeRatio,
                    borderRadius: 16,
                  },
                ]}
                contentFit={isHero ? "contain" : "cover"}
                contentPosition="center"
                transition={120}
                priority="high"
                cachePolicy="memory-disk"
                onError={handleAvatarImageError}
              />
            </Animated.View>
            {incomingAvatarSource ? (
              <Animated.View style={[styles.crossFadeLayer, { opacity: evolveAnim }]}>
                <ExpoImage
                  key={`avatar-in-${avatarClass}-${avatarTier}`}
                  source={incomingAvatarSource}
                  style={[
                    styles.rankImage,
                    {
                      width: size * imageSizeRatio,
                      height: size * imageSizeRatio,
                      borderRadius: 16,
                    },
                  ]}
                  contentFit={isHero ? "contain" : "cover"}
                  contentPosition="center"
                  transition={150}
                  priority="high"
                  cachePolicy="memory-disk"
                />
              </Animated.View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.fallbackSilhouette, { borderColor: `${tierRingColor}99` }]}>
            <MaterialCommunityIcons name={displayIcon as any} size={size * 0.34} color={auraColor} />
          </View>
        )}
        {isHero ? (
          <View style={styles.iconOverlay}>
            <MaterialCommunityIcons
              name={(canRenderAvatarImage ? "star-circle" : "shield-sword") as any}
              size={size * 0.2}
              color={color}
            />
          </View>
        ) : null}
        {isHero ? (
          <View style={[styles.levelBadge, { borderColor: `${glowMixColor}AA`, backgroundColor: `${glowMixColor}24` }]}>
            <MaterialCommunityIcons name="star-four-points" size={12} color={glowMixColor} />
            <Text style={[styles.levelBadgeText, { color: glowMixColor }]}>{`LV ${level}`}</Text>
            <Animated.View style={[styles.levelBadgePulse, { backgroundColor: `${glowMixColor}66`, opacity: badgePulseOpacity }]} />
          </View>
        ) : null}
      </Animated.View>
      {auraFxColor ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.auraForegroundRing,
            {
              zIndex: 22,
              width: isHero ? size * 1.01 : size * 1.04,
              height: isHero ? size * 1.01 : size * 1.04,
              borderColor: auraFxColor,
              shadowColor: auraFxColor,
              opacity: 1,
            },
          ]}
        />
      ) : null}
      {isHero ? (
        <View style={[styles.heroLabelStack, { zIndex: 25 }]}>
          {showTierLabel ? <Text style={[styles.tierLabelHero, { color: tierRingColor }]}>{tierKey.toUpperCase()}</Text> : null}
          <Text style={[styles.stageLabel, { color: glowMixColor }]}>{stageLabel}</Text>
        </View>
      ) : (
        <View style={[styles.compactLabelStack, { zIndex: 25 }]}>
          {showTierLabel ? <Text style={[styles.tierLabel, { color: tierRingColor }]}>{tierKey.toUpperCase()}</Text> : null}
          <Text style={styles.lvl}>Lv.{level}</Text>
        </View>
      )}
      {shakerSource ? (
        <View
          pointerEvents="none"
          style={[
            styles.shakerLayer,
            {
              width: shakerSize,
              height: shakerSize,
              left: isHero ? 6 : 4,
              bottom: isHero ? (size * 0.14 + 8) : size * 0.08 + 6,
            },
          ]}
        >
          {shakerTier === 3 ? (
            <View style={styles.shakerGoldGlowShell}>
              <ExpoImage
                source={shakerSource}
                style={[styles.shakerImage, { width: shakerSize, height: shakerSize }]}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </View>
          ) : (
            <ExpoImage
              source={shakerSource}
              style={[styles.shakerImage, { width: shakerSize, height: shakerSize }]}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
        </View>
      ) : null}
      {isTurboActive ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.turboBadgeWrap,
            {
              top: isHero ? size * 0.1 : 6,
              right: 2,
              opacity: turboBadgeOpacity,
            },
          ]}
        >
          <View style={styles.turboBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={11} color="#1a0f00" />
            <Text style={styles.turboBadgeText}>x1.1</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

export const CharacterAvatar = CharacterImage;

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  compactLabelStack: {
    alignItems: "center",
    width: "100%",
  },
  turboBackRing: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255, 120, 40, 0.55)",
    backgroundColor: "#00000000",
    zIndex: 1,
    shadowColor: "#FF7A2E",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  shakerLayer: {
    position: "absolute",
    zIndex: 43,
    elevation: 24,
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  shakerImage: {
    borderRadius: 8,
  },
  shakerGoldGlowShell: {
    borderRadius: 12,
    padding: 2,
    backgroundColor: "#00000000",
    shadowColor: "#FFB84D",
    shadowOpacity: 0.95,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  turboBadgeWrap: {
    position: "absolute",
    zIndex: 46,
    elevation: 26,
  },
  turboBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255, 140, 60, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 200, 120, 0.95)",
  },
  turboBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#1a0f00",
    letterSpacing: 0.2,
  },
  tierPulseGlow: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: "#00000000",
    shadowOffset: { width: 0, height: 0 },
  },
  auraGlow: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: "#00000000",
  },
  innerBreathGlow: {
    position: "absolute",
    borderRadius: 999,
  },
  leagueAura: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  circle: {
    flex: 1,
    width: "100%",
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceElevated,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  heroFrame: {
    width: "100%",
    borderWidth: 2,
    paddingVertical: 8,
  },
  auraForegroundRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: "#00000000",
    shadowOpacity: 0.95,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  lvl: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  iconOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#00000066",
    borderRadius: 999,
    padding: 4,
  },
  tierLabel: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  fallbackSilhouette: {
    width: "72%",
    height: "72%",
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E1320",
  },
  rankImage: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 0,
    borderColor: "#FFFFFF00",
  },
  crossFadeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  tier3ConquerorAura: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: "#FF9A3A22",
    shadowOpacity: 0.95,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  levelBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    overflow: "hidden",
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  levelBadgePulse: {
    ...StyleSheet.absoluteFillObject,
  },
  stageLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1.6,
    textShadowColor: "#000000AA",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  heroLabelStack: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tierLabelHero: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
});
