import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Share,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useGame, apiGet, apiPost } from '@/context/GameContext';
import { useNetwork } from '@/context/NetworkContext';
import { COLORS, CLASS_COLORS, LEAGUE_COLORS } from '@/constants/colors';
import { XPBar } from '@/components/XPBar';
import { StatBadge } from '@/components/StatBadge';
import { CharacterImage } from '@/components/CharacterImage';
import { LeagueBadge } from '@/components/LeagueBadge';
import { CharacterClass, LeagueTier } from '@/context/GameContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cacheWorkouts, getCachedWorkouts } from '@/lib/offlineCache';
import * as Clipboard from 'expo-clipboard';

interface Workout {
  id: string;
  exerciseName: string;
  exerciseType: string;
  sets: number;
  reps: number;
  duration: number;
  xpEarned: number;
  earnedCoins?: number;
  estimatedCalories: number;
  estimatedDurationMin: number;
  isVerified: boolean;
  isPendingApproval: boolean;
  createdAt: string;
}

const REGION_LABELS: Record<string, string> = {
  global: 'Global', europe: 'Avrupa', americas: 'Amerika',
  asia: 'Asya', 'middle east': 'Orta Doğu', africa: 'Afrika',
};

function WorkoutHistoryItem({ workout }: { workout: Workout }) {
  const date = new Date(workout.createdAt);
  const dateStr = date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.historyItem}>
      <View style={[
        styles.historyIcon,
        workout.isPendingApproval && { backgroundColor: COLORS.warning + '20' },
      ]}>
        {workout.isPendingApproval ? (
          <MaterialCommunityIcons name="clock-alert" size={18} color={COLORS.warning} />
        ) : workout.isVerified ? (
          <MaterialCommunityIcons name="check-decagram" size={18} color={COLORS.success} />
        ) : (
          <MaterialCommunityIcons name="dumbbell" size={18} color={COLORS.xpBar} />
        )}
      </View>
      <View style={styles.historyInfo}>
        <View style={styles.historyNameRow}>
          <Text style={styles.historyName}>{workout.exerciseName}</Text>
          {workout.isPendingApproval && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Onay Bekliyor</Text>
            </View>
          )}
        </View>
        <Text style={styles.historyMeta}>
          {workout.reps > 0 ? `${workout.sets} × ${workout.reps} tekrar` : `${workout.duration} dk`}
          {workout.estimatedCalories > 0 ? ` · ${workout.estimatedCalories} kal` : ''}
          {' · '}{dateStr} {timeStr}
        </Text>
      </View>
      <View style={styles.xpBadge}>
        <MaterialCommunityIcons name="lightning-bolt" size={12} color={COLORS.gold} />
        <Text style={styles.xpText}>+{workout.xpEarned} XP / +{workout.earnedCoins || 0} Coin</Text>
      </View>
    </View>
  );
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  xpReward: number;
  unlockedAt: string;
}

const RARITY_COLORS: Record<string, string> = {
  common:    COLORS.textSecondary,
  uncommon:  COLORS.success,
  rare:      COLORS.info,
  epic:      COLORS.arcane,
  legendary: COLORS.gold,
};

const RARITY_LABELS: Record<string, string> = {
  common:    'Sıradan',
  uncommon:  'Olağandışı',
  rare:      'Nadir',
  epic:      'Epik',
  legendary: 'Efsanevi',
};

interface ShareCardData {
  shareText: string;
  referralCode: string | null;
  name: string;
  level: number;
  league: string;
  leagueName: string;
  globalRank: number;
  totalPlayers: number;
  totalWorkouts: number;
  streakDays: number;
}

interface ReferralStats {
  referralCode: string;
  referralCount: number;
  maxReferrals: number;
  totalGemsEarned: number;
}

interface NotifResponse {
  unreadCount: number;
}

interface StoreResponse {
  activeBoosts?: Array<{ itemId: string; multiplier: number; expiresAt: string }>;
  itemCatalog?: Array<{ id: string; name: string; description: string; icon: string; price: number }>;
  ownedItemIds?: string[];
}

const BOOST_LABELS: Record<string, string> = {
  itm_protein_shake: 'Protein Shake',
  boost_xp15_1h: 'XP Takviyesi x1.5',
  boost_xp2_2h: 'XP Takviyesi x2',
  boost_xp2_4h_gem: 'XP Takviyesi x2',
  boost_xp3_6h_gem: 'XP Takviyesi x3',
};

const AURA_LABELS: Record<string, string> = {
  aura_gri: 'Gumus Aura',
  aura_alev: 'Alev Aurasi',
  aura_buz: 'Buz Aurasi',
  aura_firtina: 'Firtina Aurasi',
  aura_altin: 'Altin Aurasi',
  aura_elmas: 'Elmas Aurasi',
  aura_sampiyonluk: 'Sampiyonluk Aurasi',
};

const CLASS_SHIELD_ICONS: Record<string, string> = {
  barbarian: 'shield-sword',
  fighter: 'shield-outline',
  paladin: 'shield-crown',
  monk: 'shield-half-full',
  rogue: 'shield-account',
  ranger: 'shield-star-outline',
  wizard: 'shield-moon-outline',
  cleric: 'shield-cross',
  druid: 'shield-leaf',
  sorcerer: 'shield-sun-outline',
  warlock: 'shield-key-outline',
  bard: 'shield',
  warrior: 'shield-sword',
  mage: 'shield-moon-outline',
  archer: 'shield-star-outline',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { character, refreshCharacter, userId } = useGame();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [applyingReferral, setApplyingReferral] = useState(false);

  const { isOnline } = useNetwork();

  const { data: workouts } = useQuery<Workout[]>({
    queryKey: ['workouts', userId],
    queryFn: async () => {
      if (!isOnline) {
        const cached = await getCachedWorkouts();
        return cached || [];
      }
      const data = await apiGet<any[]>(`/workouts?limit=20`);
      const normalized = (data || []).map((w) => ({
        ...w,
        exerciseName: w.exerciseName ?? w.exercise_name ?? w.exerciseType ?? w.exercise_type ?? 'Antrenman',
        duration: Number(w.duration ?? w.durationSec ?? w.duration_sec ?? 0),
        xpEarned: Number(w.xpEarned ?? w.earnedXp ?? w.earned_xp ?? 0),
        earnedCoins: Number(w.earnedCoins ?? w.earned_coins ?? 0),
      }));
      cacheWorkouts(normalized);
      return normalized;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.removeQueries({ queryKey: ['character', userId] });
      queryClient.removeQueries({ queryKey: ['workouts', userId] });
      queryClient.removeQueries({ queryKey: ['store', userId] });
      queryClient.invalidateQueries({ queryKey: ['workouts', userId] });
      queryClient.invalidateQueries({ queryKey: ['character', userId] });
      queryClient.invalidateQueries({ queryKey: ['store', userId] });
      refreshCharacter();
    }, [queryClient, refreshCharacter, userId]),
  );

  const { data: achievements } = useQuery<Achievement[]>({
    queryKey: ['achievements', userId],
    queryFn: () => apiGet(`/achievements`),
    enabled: !!userId && isOnline,
  });

  const { data: notifData } = useQuery<NotifResponse>({
    queryKey: ['notifications-count'],
    queryFn: () => apiGet('/notifications?limit=1'),
    enabled: !!userId && isOnline,
    refetchInterval: isOnline ? 30000 : false,
  });

  const { data: referralStats } = useQuery<ReferralStats>({
    queryKey: ['referral-stats'],
    queryFn: () => apiGet('/referral/stats'),
    enabled: !!userId && isOnline,
  });

  const { data: storeData } = useQuery<StoreResponse>({
    queryKey: ['store', userId],
    queryFn: () => apiGet('/store'),
    enabled: !!userId && isOnline,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshCharacter();
    setRefreshing(false);
  }, [refreshCharacter]);

  const handleShare = async () => {
    try {
      const shareData = await apiGet<ShareCardData>('/share-card');
      await Share.share({ message: shareData.shareText });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyReferral = async () => {
    const code = referralStats?.referralCode || (character as any)?.referralCode;
    if (code) {
      await Clipboard.setStringAsync(code);
      Alert.alert('Kopyalandi', 'Referans kodun panoya kopyalandi!');
    }
  };

  const unreadCount = notifData?.unreadCount || 0;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (!character) return (
    <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={COLORS.gold} />
    </View>
  );

  const classColor = CLASS_COLORS[character.class] || COLORS.gold;
  const classShieldIcon = CLASS_SHIELD_ICONS[String(character.class)] || 'shield-account';
  const championBannerActive = Boolean((character as any)?.championBannerUntil && new Date(String((character as any).championBannerUntil)) > new Date());
  const eliteTierActive = Boolean((character as any)?.eliteTierUntil && new Date(String((character as any).eliteTierUntil)) > new Date());
  const leagueColor = LEAGUE_COLORS[character.league] || COLORS.textMuted;

  const classLabels: Record<string, string> = {
    warrior: 'Savaşçı', mage: 'Büyücü', archer: 'Okçu', paladin: 'Paladin',
  };
  const safeNameUpper = (character?.name || 'Oyuncu').toUpperCase();
  const safeClassUpper = (classLabels[character?.class] || character?.class || 'Sinif').toUpperCase();
  const safeTierUpper = (String(character?.tier || 'common')).toUpperCase();

  const pendingCount = workouts?.filter((w) => w.isPendingApproval).length || 0;
  const recentMatchHistory = (workouts || []).slice(0, 5);
  const activeBoost = storeData?.activeBoosts?.[0];
  const boostLabel = activeBoost ? (BOOST_LABELS[activeBoost.itemId] ?? activeBoost.itemId) : null;
  const ownedEquipment = (storeData?.itemCatalog || []).filter((item) => (storeData?.ownedItemIds || []).includes(item.id));
  const isDebugUser = Boolean((character as any)?.isDebugUser || (character as any)?.isAdmin);
  const equippedAuraLabel = character?.equippedAura ? (AURA_LABELS[String(character.equippedAura)] || String(character.equippedAura)) : null;
  const [debugGrantBusy, setDebugGrantBusy] = useState(false);
  const debugGrantLock = useRef(false);

  React.useEffect(() => {
    setInstagramUrl(String((character as any)?.instagramUrl || ''));
    setTwitterUrl(String((character as any)?.twitterUrl || ''));
  }, [character]);

  const handleDebugGrant = async (action: 'xp' | 'level') => {
    if (debugGrantLock.current) return;
    debugGrantLock.current = true;
    setDebugGrantBusy(true);
    try {
      const res = await apiPost<any>('/character/admin-grant', { action });
      if (!res.ok) {
        Alert.alert('Hata', res.error || 'Debug islemi basarisiz');
        return;
      }
      await refreshCharacter();
      queryClient.invalidateQueries({ queryKey: ['character', userId] });
    } finally {
      debugGrantLock.current = false;
      setDebugGrantBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await apiPost<any>('/character/profile', {
        instagramUrl,
        twitterUrl,
      });
      if (!res.ok) {
        Alert.alert('Hata', res.error || 'Profil guncellenemedi');
        return;
      }
      await refreshCharacter();
      Alert.alert('Basarili', 'Profil bilgileri guncellendi.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.characterShowcase}>
        {championBannerActive ? (
          <View style={styles.championBanner}>
            <MaterialCommunityIcons name="flag-checkered" size={14} color={COLORS.gold} />
            <Text style={styles.championBannerText}>SAMPiYON BANNER AKTiF</Text>
          </View>
        ) : null}
        <View style={styles.showcaseHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{safeNameUpper}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.classBadge, { backgroundColor: classColor + '20', borderColor: classColor + '55' }]}>
                <MaterialCommunityIcons name={classShieldIcon as any} size={11} color={classColor} />
                <Text style={[styles.classBadgeText, { color: classColor }]}>
                  {safeClassUpper}
                </Text>
              </View>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{safeTierUpper}</Text>
              </View>
              <LeagueBadge league={character.league as LeagueTier} size="sm" showName />
            </View>
          </View>
          <View style={styles.regionPill}>
            <MaterialCommunityIcons name="map-marker" size={12} color={COLORS.textMuted} />
            <Text style={styles.regionText}>
              {REGION_LABELS[character.region ?? "global"] || character.region || "Global"}
            </Text>
          </View>
        </View>

        <CharacterImage
          characterClass={character.class as CharacterClass}
          level={character.level}
          league={character.league as LeagueTier}
          streakActive={character.streakActive}
          equippedAura={character.equippedAura}
          equippedShakerTier={character.equippedShakerTier ?? 0}
          isTurboActive={Boolean(character.isTurboActive)}
          tier={character.tier}
          size={260}
          variant="hero"
          showTierLabel
          forceTier3={eliteTierActive}
        />
        {equippedAuraLabel ? (
          <View style={styles.equippedAuraPill}>
            <MaterialCommunityIcons name="shimmer" size={13} color={COLORS.arcane} />
            <Text style={styles.equippedAuraText}>{equippedAuraLabel}</Text>
          </View>
        ) : null}

        <View style={styles.xpSection}>
          <XPBar exp={character.exp} expToNextLevel={character.expToNextLevel} level={character.level} />
        </View>
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialBtn} onPress={() => router.push('/friends' as any)}>
          <MaterialCommunityIcons name="account-group" size={20} color={COLORS.xpBar} />
          <Text style={styles.socialBtnText}>Arkadaslar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialBtn} onPress={() => router.push('/notifications' as any)}>
          <View>
            <MaterialCommunityIcons name="bell" size={20} color={COLORS.gold} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.socialBtnText}>Bildirimler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialBtn} onPress={handleShare}>
          <MaterialCommunityIcons name="share-variant" size={20} color={COLORS.success} />
          <Text style={styles.socialBtnText}>Paylas</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings' as any)}>
        <MaterialCommunityIcons name="cog" size={18} color={COLORS.textSecondary} />
        <Text style={styles.settingsBtnText}>Ayarlar</Text>
      </TouchableOpacity>
      {isDebugUser ? (
        <View style={styles.debugActions}>
          <TouchableOpacity
            style={styles.debugBtn}
            disabled={debugGrantBusy}
            onPress={() => handleDebugGrant('xp')}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={14} color={COLORS.gold} />
            <Text style={styles.debugBtnText}>+5000 XP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debugBtn}
            disabled={debugGrantBusy}
            onPress={() => handleDebugGrant('level')}
          >
            <MaterialCommunityIcons name="arrow-up-bold-circle" size={14} color={COLORS.success} />
            <Text style={styles.debugBtnText}>+1 Level</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.profileEditCard}>
        <Text style={styles.sectionTitle}>Profil Duzenle</Text>
        <View style={styles.socialInputRow}>
          <MaterialCommunityIcons name="instagram" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.socialInput}
            value={instagramUrl}
            onChangeText={setInstagramUrl}
            placeholder="instagram.com/kullanici"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.socialInputRow}>
          <MaterialCommunityIcons name="twitter" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.socialInput}
            value={twitterUrl}
            onChangeText={setTwitterUrl}
            placeholder="x.com/kullanici"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile} disabled={savingProfile}>
          {savingProfile ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={16} color={COLORS.background} />
              <Text style={styles.saveProfileBtnText}>Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.profileEditCard}>
        <Text style={styles.sectionTitle}>Karsilasma Gecmisi</Text>
        {recentMatchHistory.length > 0 ? (
          recentMatchHistory.map((w) => (
            <View key={w.id} style={styles.matchHistoryRow}>
              <View style={styles.matchHistoryLeft}>
                <MaterialCommunityIcons name="sword-cross" size={14} color={COLORS.gold} />
                <Text style={styles.matchHistoryName} numberOfLines={1}>{w.exerciseName}</Text>
              </View>
              <Text style={styles.matchHistoryMeta}>
                +{w.xpEarned} XP · {new Date(w.createdAt).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.matchHistoryEmpty}>Henuz karsilasma kaydi yok.</Text>
        )}
      </View>

      {referralStats?.referralCode && (
        <TouchableOpacity style={styles.referralBox} onPress={handleCopyReferral}>
          <View style={styles.referralLeft}>
            <MaterialCommunityIcons name="gift" size={20} color={COLORS.arcane} />
            <View>
              <Text style={styles.referralLabel}>Referans Kodun</Text>
              <Text style={styles.referralCode}>{referralStats.referralCode}</Text>
            </View>
          </View>
          <View style={styles.referralRight}>
            <Text style={styles.referralCount}>{referralStats.referralCount}/{referralStats.maxReferrals}</Text>
            <MaterialCommunityIcons name="content-copy" size={16} color={COLORS.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      {pendingCount > 0 && (
        <View style={styles.pendingAlert}>
          <MaterialCommunityIcons name="clock-alert-outline" size={18} color={COLORS.warning} />
          <Text style={styles.pendingAlertText}>
            {pendingCount} antrenman onay bekliyor. XP'nin yarısı verildi.
          </Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Özellikler</Text>
      {activeBoost ? (
        <View style={styles.activeBoostBanner}>
          <MaterialCommunityIcons name="flask" size={15} color={COLORS.success} />
          <Text style={styles.activeBoostText}>
            AKTIF BOOST: %{Math.max(0, activeBoost.multiplier - 100)} XP ({boostLabel})
          </Text>
        </View>
      ) : null}
      <View style={styles.statsRow}>
        <StatBadge label="GÜÇ" value={character.strength} icon="arm-flex" color={COLORS.warrior} />
        <StatBadge label="ÇEV" value={character.agility} icon="run-fast" color={COLORS.archer} />
        <StatBadge label="DAY" value={character.endurance} icon="heart-pulse" color={COLORS.paladin} />
      </View>

      <View style={styles.statsGrid}>
        {[
          { label: 'Seviye', value: character.level, icon: 'star', color: leagueColor },
          { label: 'Toplam XP', value: (character.totalXpEarned || 0).toLocaleString(), icon: 'lightning-bolt', color: COLORS.xpBar },
          { label: 'Antrenman', value: character.totalWorkouts, icon: 'dumbbell', color: COLORS.fire },
          { label: 'Kalori', value: ((character.totalCalories || 0)).toLocaleString(), icon: 'fire', color: COLORS.warning },
        ].map((s) => (
          <View key={s.label} style={styles.statBox}>
            <MaterialCommunityIcons name={s.icon as any} size={20} color={s.color} />
            <Text style={[styles.statBoxValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statBoxLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Ekipmanlarim</Text>
      {ownedEquipment.length > 0 ? (
        <View style={styles.equipmentList}>
          {ownedEquipment.map((item) => (
            <View key={item.id} style={styles.equipmentCard}>
              <MaterialCommunityIcons name={(item.icon as any) || 'dumbbell'} size={18} color={COLORS.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.equipmentName}>{item.name}</Text>
                <Text style={styles.equipmentDesc} numberOfLines={1}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyEquipment}>
          <MaterialCommunityIcons name="treasure-chest-outline" size={22} color={COLORS.textMuted} />
          <Text style={styles.emptyEquipmentText}>Marketten aldigin ekipmanlar burada gorunecek.</Text>
        </View>
      )}

      {achievements && achievements.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Başarımlar ({achievements.length})
          </Text>
          <View style={styles.achievementGrid}>
            {achievements.map((ach) => {
              const rarityColor = RARITY_COLORS[ach.rarity] || COLORS.textSecondary;
              return (
                <View key={ach.id} style={[styles.achCard, { borderColor: rarityColor + '44' }]}>
                  <View style={[styles.achIconBox, { backgroundColor: rarityColor + '18' }]}>
                    <MaterialCommunityIcons name={ach.icon as any} size={22} color={rarityColor} />
                  </View>
                  <Text style={[styles.achName, { color: rarityColor }]} numberOfLines={2}>
                    {ach.name}
                  </Text>
                  <Text style={styles.achDesc} numberOfLines={2}>{ach.description}</Text>
                  <View style={styles.achFooter}>
                    <Text style={[styles.achRarity, { color: rarityColor }]}>
                      {RARITY_LABELS[ach.rarity] || ach.rarity}
                    </Text>
                    <View style={styles.achXp}>
                      <MaterialCommunityIcons name="lightning-bolt" size={10} color={COLORS.gold} />
                      <Text style={styles.achXpText}>+{ach.xpReward}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Son Antrenmanlar</Text>
      {workouts && workouts.length > 0 ? (
        <View style={styles.historyList}>
          {workouts.map((w) => (
            <WorkoutHistoryItem key={w.id} workout={w} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyHistory}>
          <MaterialCommunityIcons name="history" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Henüz antrenman yok. Maceraya başla!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20 },
  characterShowcase: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  championBanner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.gold + '1A',
    borderColor: COLORS.gold + '55',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
  },
  championBannerText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: COLORS.gold, letterSpacing: 0.8 },
  showcaseHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroName: { fontFamily: 'Inter_700Bold', fontSize: 24, color: COLORS.text, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  classBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  classBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5 },
  tierBadge: {
    backgroundColor: COLORS.arcane + '1E',
    borderColor: COLORS.arcane + '55',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, color: COLORS.arcane },
  regionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  regionText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textMuted },
  xpSection: { width: '100%' },
  equippedAuraPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.arcane + '18',
    borderWidth: 1,
    borderColor: COLORS.arcane + '45',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: -4,
  },
  equippedAuraText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: COLORS.arcane },

  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.warning + '15',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  pendingAlertText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.warning, flex: 1 },
  activeBoostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.success + '16',
    borderColor: COLORS.success + '44',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  activeBoostText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: COLORS.success },

  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statBox: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statBoxValue: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  statBoxLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },

  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: COLORS.text, marginBottom: 12 },
  historyList: { gap: 8 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.xpBar + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: COLORS.text },
  pendingBadge: {
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.warning + '50',
  },
  pendingText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: COLORS.warning },
  historyMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  xpBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  xpText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: COLORS.gold },
  emptyHistory: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },

  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  achCard: {
    width: '47%',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, gap: 6, alignItems: 'flex-start',
  },
  achIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  achName: { fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16 },
  achDesc: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.textSecondary, lineHeight: 14 },
  achFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 2 },
  achRarity: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  achXp: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  achXpText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: COLORS.gold },
  equipmentList: { gap: 8, marginBottom: 20 },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
  },
  equipmentName: { fontFamily: 'Inter_700Bold', fontSize: 13, color: COLORS.text },
  equipmentDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textSecondary },
  emptyEquipment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 20,
  },
  emptyEquipmentText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textMuted, flex: 1 },

  socialRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  socialBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  socialBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: COLORS.textSecondary },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  settingsBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: COLORS.textSecondary },
  debugActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  debugBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 9,
  },
  debugBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: COLORS.text },
  profileEditCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  socialInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  socialInput: {
    flex: 1,
    color: COLORS.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    paddingVertical: 0,
  },
  saveProfileBtn: {
    marginTop: 4,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveProfileBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: COLORS.background },
  matchHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  matchHistoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  matchHistoryName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: COLORS.text, flex: 1 },
  matchHistoryMeta: { fontFamily: 'Inter_500Medium', fontSize: 11, color: COLORS.textSecondary },
  matchHistoryEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textMuted },
  notifBadge: {
    position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#FFF' },
  referralBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.arcane + '30',
  },
  referralLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  referralLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textSecondary },
  referralCode: { fontFamily: 'Inter_700Bold', fontSize: 16, color: COLORS.arcane, letterSpacing: 2 },
  referralRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  referralCount: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textMuted },
});
