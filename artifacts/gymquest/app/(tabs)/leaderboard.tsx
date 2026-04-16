import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useGame, apiGet } from '@/context/GameContext';
import { COLORS, LEAGUE_COLORS, CLASS_COLORS } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import { CharacterClass } from '@/context/GameContext';
import { LeagueTier } from '@/constants/leagues';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  characterName: string;
  characterClass: string;
  level: number;
  totalExp: number;
  totalXpEarned: number;
  totalCalories: number;
  region: string;
  totalWorkouts: number;
  league: LeagueTier;
  leagueName: string;
  leagueOrder: number;
  questStreak: number;
  streakActive: boolean;
  inPromotionZone?: boolean;
  leagueIcon?: string;
}

interface GroupEntry {
  rank: number;
  partyId: number;
  partyName: string;
  totalXp: number;
  memberCount: number;
  league: LeagueTier;
  leagueName: string;
  inPromotionZone?: boolean;
  leagueIcon?: string;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  leagueGroups: string[];
}

interface GroupLeaderboardResponse {
  entries: GroupEntry[];
}

interface ClanEntry {
  rank: number;
  clanId: number | string;
  clanName: string;
  memberCount: number;
  totalXp: number;
  warWins: number;
}

interface ClanLeaderboardResponse {
  entries: ClanEntry[];
}

const LEAGUES: Array<{ id: string; name: string }> = [
  { id: 'all', name: 'Tümü' },
  { id: 'master', name: 'Master' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'platinum', name: 'Platinum' },
  { id: 'gold', name: 'Gold' },
  { id: 'silver', name: 'Silver' },
  { id: 'bronze', name: 'Bronze' },
  { id: 'iron', name: 'Iron' },
];

const REGIONS = ['global', 'europe', 'americas', 'asia', 'middle east', 'africa'];
const REGION_LABELS: Record<string, string> = {
  global: 'Global',
  europe: 'Avrupa',
  americas: 'Amerika',
  asia: 'Asya',
  'middle east': 'Orta Doğu',
  africa: 'Afrika',
};

const CLASS_LABELS: Record<string, string> = {
  warrior: 'Savaşçı', mage: 'Büyücü', archer: 'Okçu', paladin: 'Paladin',
};

const LEAGUE_ICONS: Record<string, string> = {
  master: 'crown',
  diamond: 'diamond-stone',
  platinum: 'shield-crown',
  gold: 'shield-star',
  silver: 'shield',
  bronze: 'shield-sword',
  iron: 'sword',
};

const LEAGUE_ASSET_ICONS: Record<string, any> = {
  iron: require('../../assets/ranks/iron.png'),
  bronze: require('../../assets/ranks/bronze.png'),
  silver: require('../../assets/ranks/silver.png'),
  gold: require('../../assets/ranks/gold.png'),
  platinum: require('../../assets/ranks/platinum.png'),
  diamond: require('../../assets/ranks/diamond.png'),
  master: require('../../assets/ranks/master.png'),
};

const LEAGUE_GLOW_PRESETS: Record<string, { opacity: number; radius: number; bg: string }> = {
  iron: { opacity: 0.08, radius: 2, bg: '#2A2F38' },
  silver: { opacity: 0.36, radius: 9, bg: '#E8EDF820' },
  gold: { opacity: 0.52, radius: 12, bg: '#F4C54224' },
  bronze: { opacity: 0.2, radius: 6, bg: '#B0724A20' },
  platinum: { opacity: 0.42, radius: 10, bg: '#91D7FF24' },
  diamond: { opacity: 0.46, radius: 11, bg: '#63A3FF26' },
  master: { opacity: 0.5, radius: 12, bg: '#C47AFF26' },
};

interface WeeklyEntry {
  rank: number;
  userId: string;
  characterName: string;
  characterClass: string;
  level: number;
  weeklyXp: number;
  league: LeagueTier;
}

interface WeeklyResponse {
  entries: WeeklyEntry[];
  weekStart: string;
  weekEnd: string;
  resetsIn: number;
}

interface StreakEntry {
  rank: number;
  userId: string;
  characterName: string;
  characterClass: string;
  level: number;
  streakDays: number;
  league: LeagueTier;
}

interface StreakResponse {
  entries: StreakEntry[];
}

type MainTab = 'kisisel' | 'klan' | 'top100' | 'haftalik' | 'seri';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <MaterialCommunityIcons name="crown" size={22} color={COLORS.gold} />;
  if (rank === 2) return <MaterialCommunityIcons name="medal" size={22} color="#C0C0C0" />;
  if (rank === 3) return <MaterialCommunityIcons name="medal" size={22} color="#CD7F32" />;
  return <Text style={styles.rankNum}>#{rank}</Text>;
}

function EntryRow({ entry, isMe, graphicsScale }: { entry: LeaderboardEntry; isMe: boolean; graphicsScale: number }) {
  const classColor = CLASS_COLORS[entry.characterClass] || COLORS.gold;
  const leagueColor = LEAGUE_COLORS[entry.league] || COLORS.textMuted;
  const glow = LEAGUE_GLOW_PRESETS[String(entry.league).toLowerCase()] || LEAGUE_GLOW_PRESETS.iron;

  return (
    <View style={[
      styles.entryRow,
      isMe && styles.entryRowMe,
      entry.inPromotionZone && styles.entryRowPromotion,
    ]}>
      {entry.inPromotionZone && !isMe && (
        <View style={styles.promoTag}>
          <MaterialCommunityIcons name="arrow-up-bold" size={10} color={COLORS.success} />
        </View>
      )}
      <View style={styles.rankCell}>
        <RankBadge rank={entry.rank} />
      </View>
      <View style={styles.entryInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.entryName, isMe && { color: COLORS.gold }]} numberOfLines={1}>
            {entry.characterName}{isMe ? ' (Sen)' : ''}
          </Text>
          {entry.streakActive && (
            <MaterialCommunityIcons name="fire" size={14} color={COLORS.fire} />
          )}
        </View>
        <View style={styles.entryMeta}>
          <View style={[styles.leagueGlowBadge, { borderColor: leagueColor + '66', shadowColor: leagueColor, shadowOpacity: glow.opacity * graphicsScale, shadowRadius: glow.radius * graphicsScale, backgroundColor: glow.bg }]}>
            <ExpoImage
              source={LEAGUE_ASSET_ICONS[String(entry.league).toLowerCase()] || LEAGUE_ASSET_ICONS.iron}
              style={styles.leagueAssetIcon}
              contentFit="contain"
              priority="high"
            />
            <Text style={[styles.leagueGlowText, { color: leagueColor }]}>{entry.leagueName}</Text>
          </View>
          <Text style={styles.entryDot}>·</Text>
          <Text style={[styles.entryClass, { color: classColor }]}>
            {CLASS_LABELS[entry.characterClass] || entry.characterClass}
          </Text>
        </View>
      </View>
      <View style={styles.statsCell}>
        <Text style={[styles.levelText, { color: leagueColor }]}>LVL {entry.level}</Text>
        <Text style={styles.expText}>{(entry.totalXpEarned || 0).toLocaleString()} XP</Text>
        {entry.totalCalories > 0 && (
          <Text style={styles.calText}>{entry.totalCalories.toLocaleString()} kal</Text>
        )}
      </View>
    </View>
  );
}

function GroupRow({ entry, graphicsScale }: { entry: GroupEntry; graphicsScale: number }) {
  const leagueColor = LEAGUE_COLORS[entry.league] || COLORS.textMuted;
  const glow = LEAGUE_GLOW_PRESETS[String(entry.league).toLowerCase()] || LEAGUE_GLOW_PRESETS.iron;
  return (
    <View style={[
      styles.entryRow,
      entry.inPromotionZone && styles.entryRowPromotion,
    ]}>
      {entry.inPromotionZone && (
        <View style={styles.promoTag}>
          <MaterialCommunityIcons name="arrow-up-bold" size={10} color={COLORS.success} />
        </View>
      )}
      <View style={styles.rankCell}>
        <RankBadge rank={entry.rank} />
      </View>
      <View style={styles.entryInfo}>
        <View style={styles.nameRow}>
          <MaterialCommunityIcons name="account-group" size={14} color={COLORS.gold} />
          <Text style={styles.entryName} numberOfLines={1}>{entry.partyName}</Text>
        </View>
        <View style={styles.entryMeta}>
          <View style={[styles.leagueGlowBadge, { borderColor: leagueColor + '66', shadowColor: leagueColor, shadowOpacity: glow.opacity * graphicsScale, shadowRadius: glow.radius * graphicsScale, backgroundColor: glow.bg }]}>
            <ExpoImage
              source={LEAGUE_ASSET_ICONS[String(entry.league).toLowerCase()] || LEAGUE_ASSET_ICONS.iron}
              style={styles.leagueAssetIcon}
              contentFit="contain"
              priority="high"
            />
            <Text style={[styles.leagueGlowText, { color: leagueColor }]}>{entry.leagueName}</Text>
          </View>
          <Text style={styles.entryDot}>·</Text>
          <Text style={styles.entryClass}>{entry.memberCount} üye</Text>
        </View>
      </View>
      <View style={styles.statsCell}>
        <Text style={[styles.levelText, { color: leagueColor }]}>
          {(entry.totalXp || 0).toLocaleString()}
        </Text>
        <Text style={styles.expText}>Grup XP</Text>
      </View>
    </View>
  );
}

function Top100Row({ entry, isMe, graphicsScale }: { entry: LeaderboardEntry; isMe: boolean; graphicsScale: number }) {
  const classColor = CLASS_COLORS[entry.characterClass] || COLORS.gold;
  const leagueColor = LEAGUE_COLORS[entry.league] || COLORS.gold;
  const glow = LEAGUE_GLOW_PRESETS[String(entry.league).toLowerCase()] || LEAGUE_GLOW_PRESETS.iron;
  const isPodium = entry.rank <= 3;

  return (
    <View style={[
      styles.top100Row,
      isMe && styles.entryRowMe,
      isPodium && styles.top100Podium,
      entry.rank === 1 && { borderColor: COLORS.gold + '60' },
      entry.rank === 2 && { borderColor: '#C0C0C080' },
      entry.rank === 3 && { borderColor: '#CD7F3280' },
    ]}>
      <View style={styles.rankCell}>
        <RankBadge rank={entry.rank} />
      </View>
      <View style={styles.entryInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.entryName, isMe && { color: COLORS.gold }, isPodium && { fontSize: 15 }]} numberOfLines={1}>
            {entry.characterName}{isMe ? ' (Sen)' : ''}
          </Text>
          {entry.streakActive && <MaterialCommunityIcons name="fire" size={14} color={COLORS.fire} />}
        </View>
        <View style={styles.entryMeta}>
          <View style={[styles.leagueGlowBadge, { borderColor: leagueColor + '66', shadowColor: leagueColor, shadowOpacity: glow.opacity * graphicsScale, shadowRadius: glow.radius * graphicsScale, backgroundColor: glow.bg }]}>
            <ExpoImage
              source={LEAGUE_ASSET_ICONS[String(entry.league).toLowerCase()] || LEAGUE_ASSET_ICONS.iron}
              style={styles.leagueAssetIcon}
              contentFit="contain"
              priority="high"
            />
            <Text style={[styles.leagueGlowText, { color: leagueColor }]}>{entry.leagueName}</Text>
          </View>
          <Text style={styles.entryDot}>·</Text>
          <Text style={[styles.entryClass, { color: classColor }]}>
            {CLASS_LABELS[entry.characterClass] || entry.characterClass}
          </Text>
          <Text style={styles.entryDot}>·</Text>
          <Text style={styles.entryClass}>{REGION_LABELS[entry.region] || entry.region}</Text>
        </View>
      </View>
      <View style={styles.statsCell}>
        <Text style={[styles.levelText, { color: leagueColor }]}>LVL {entry.level}</Text>
        <Text style={styles.expText}>{(entry.totalXpEarned || 0).toLocaleString()} XP</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { userId, highGraphicsEnabled, lowPerformanceDevice } = useGame();
  const graphicsScale = (!highGraphicsEnabled || lowPerformanceDevice) ? 0.3 : 1;
  const [mainTab, setMainTab] = useState<MainTab>('kisisel');
  const [selectedRegion, setSelectedRegion] = useState('global');
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', selectedRegion, selectedLeague],
    queryFn: () => apiGet(`/leaderboard?region=${selectedRegion}&league=${selectedLeague}&limit=100`),
    enabled: mainTab === 'bireysel',
  });

  const { data: groupData, isLoading: groupLoading, refetch: refetchGroups } = useQuery<ClanLeaderboardResponse>({
    queryKey: ['leaderboard-clans'],
    queryFn: () => apiGet(`/leaderboard/clans?limit=100`),
    enabled: mainTab === 'klan',
  });

  const { data: top100Data, isLoading: top100Loading, refetch: refetchTop100 } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard-top100'],
    queryFn: () => apiGet(`/leaderboard/top100?limit=100`),
    enabled: mainTab === 'top100',
  });

  const { data: weeklyData, isLoading: weeklyLoading, refetch: refetchWeekly } = useQuery<WeeklyResponse>({
    queryKey: ['leaderboard-weekly'],
    queryFn: () => apiGet('/leaderboard/weekly?limit=50'),
    enabled: mainTab === 'haftalik',
  });

  const { data: streakData, isLoading: streakLoading, refetch: refetchStreak } = useQuery<StreakResponse>({
    queryKey: ['leaderboard-streak'],
    queryFn: () => apiGet('/leaderboard/streak?limit=50'),
    enabled: mainTab === 'seri',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (mainTab === 'kisisel') await refetch();
    else if (mainTab === 'klan') await refetchGroups();
    else if (mainTab === 'haftalik') await refetchWeekly();
    else if (mainTab === 'seri') await refetchStreak();
    else await refetchTop100();
    setRefreshing(false);
  }, [mainTab, refetch, refetchGroups, refetchTop100, refetchWeekly, refetchStreak]);

  const entries = data?.entries || [];
  const groupEntries = groupData?.entries || [];
  const top100Entries = top100Data?.entries || [];

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const weeklyEntries = weeklyData?.entries || [];
  const streakEntries = streakData?.entries || [];

  const MAIN_TABS: Array<{ id: MainTab; label: string; icon: string }> = [
    { id: 'kisisel', label: 'Kisisel', icon: 'account' },
    { id: 'klan', label: 'Klan', icon: 'shield-sword' },
    { id: 'haftalik', label: 'Haftalik', icon: 'calendar-week' },
    { id: 'seri', label: 'Seri', icon: 'fire' },
    { id: 'top100', label: 'Top 100', icon: 'podium-gold' },
  ];

  return (
    <View style={[styles.screen, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Sıralama Tablosu</Text>
        <Text style={styles.pageSubtitle}>Diyarın en güçlü savaşçıları</Text>
      </View>

      <View style={styles.mainTabRow}>
        {MAIN_TABS.map((tab) => {
          const isActive = mainTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.mainTab, isActive && styles.mainTabActive]}
              onPress={() => setMainTab(tab.id)}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={16}
                color={isActive ? COLORS.gold : COLORS.textMuted}
              />
              <Text style={[styles.mainTabText, isActive && styles.mainTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mainTab === 'kisisel' && (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListHeaderComponent={
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {LEAGUES.map((item) => {
                  const isActive = selectedLeague === item.id;
                  const color = item.id !== 'all' ? LEAGUE_COLORS[item.id] : COLORS.gold;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.leagueTab, isActive && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setSelectedLeague(item.id)}
                    >
                      {item.id !== 'all' && (
                        <MaterialCommunityIcons
                          name={(LEAGUE_ICONS[item.id] || 'shield-outline') as any}
                          size={14}
                          color={isActive ? color : COLORS.textMuted}
                        />
                      )}
                      <Text style={[styles.leagueTabText, isActive && { color, fontFamily: 'Inter_700Bold' }]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                {REGIONS.map((region) => {
                  const isActive = selectedRegion === region;
                  return (
                    <Pressable
                      key={region}
                      style={[styles.regionTab, isActive && styles.regionTabActive]}
                      onPress={() => setSelectedRegion(region)}
                    >
                      <Text style={[styles.regionTabText, isActive && styles.regionTabTextActive]}>
                        {REGION_LABELS[region] || region}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {selectedLeague !== 'all' && (
                <View style={styles.promotionHint}>
                  <MaterialCommunityIcons name="arrow-up-bold" size={14} color={COLORS.success} />
                  <Text style={styles.promotionHintText}>
                    Ligin ilk %20'si bir sonraki haftada üst lige yükselir
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.gold} size="large" />
                <Text style={styles.loadingText}>Sıralama yükleniyor...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="trophy-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Henüz Kimse Yok</Text>
                <Text style={styles.emptyText}>Bu bölgede ilk antrenmanı yapan sen ol!</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <EntryRow entry={item} isMe={item.userId === userId} graphicsScale={graphicsScale} />
          )}
        />
      )}

      {mainTab === 'klan' && (
        <FlatList
          data={groupEntries}
          keyExtractor={(item: any) => String(item.clanId ?? item.partyId)}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListHeaderComponent={
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                {LEAGUES.map((item) => {
                  const isActive = selectedLeague === item.id;
                  const color = item.id !== 'all' ? LEAGUE_COLORS[item.id] : COLORS.gold;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.leagueTab, isActive && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setSelectedLeague(item.id)}
                    >
                      {item.id !== 'all' && (
                        <MaterialCommunityIcons
                          name={(LEAGUE_ICONS[item.id] || 'shield-outline') as any}
                          size={14}
                          color={isActive ? color : COLORS.textMuted}
                        />
                      )}
                      <Text style={[styles.leagueTabText, isActive && { color, fontFamily: 'Inter_700Bold' }]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.groupInfo}>
                <MaterialCommunityIcons name="information-outline" size={14} color={COLORS.info} />
                <Text style={styles.groupInfoText}>
                  Klan siralamasi: Toplam XP + Savas Puani uzerinden hesaplanir.
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            groupLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.gold} size="large" />
                <Text style={styles.loadingText}>Grup sıralaması yükleniyor...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="account-group-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Henüz Grup Yok</Text>
                <Text style={styles.emptyText}>İlk maceracı grubunu kur ve sıralamada zirveye çık!</Text>
              </View>
            )
          }
          renderItem={({ item }: { item: any }) => (
            <View style={styles.entryRow}>
              <View style={styles.rankCell}>
                <RankBadge rank={item.rank} />
              </View>
              <View style={styles.entryInfo}>
                <View style={styles.nameRow}>
                  <MaterialCommunityIcons name="shield-sword" size={14} color={COLORS.gold} />
                  <Text style={styles.entryName} numberOfLines={1}>{item.clanName || item.partyName}</Text>
                </View>
                <View style={styles.entryMeta}>
                  <Text style={styles.entryClass}>{item.memberCount} uye</Text>
                  <Text style={styles.entryDot}>·</Text>
                  <Text style={styles.entryClass}>{(item.totalXp || 0).toLocaleString()} XP</Text>
                  <Text style={styles.entryDot}>·</Text>
                  <Text style={styles.entryClass}>{item.warWins || 0} galibiyet</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {mainTab === 'haftalik' && (
        <FlatList
          data={weeklyEntries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListHeaderComponent={
            <View style={styles.weeklyHeader}>
              <MaterialCommunityIcons name="calendar-week" size={18} color={COLORS.xpBar} />
              <Text style={styles.weeklyHeaderText}>
                Bu haftanin en cok XP kazanan savasilari
              </Text>
              {weeklyData?.resetsIn && (
                <Text style={styles.weeklyReset}>
                  Sifirlama: {Math.ceil((weeklyData.resetsIn) / (24 * 60 * 60 * 1000))} gun
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            weeklyLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.gold} size="large" />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Bu Hafta Henuz Veri Yok</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.entryRow, item.userId === userId && styles.entryRowMe]}>
              <View style={styles.rankCell}><RankBadge rank={item.rank} /></View>
              <View style={styles.entryInfo}>
                <Text style={[styles.entryName, item.userId === userId && { color: COLORS.gold }]} numberOfLines={1}>
                  {item.characterName}{item.userId === userId ? ' (Sen)' : ''}
                </Text>
                <Text style={styles.entryClass}>Lv.{item.level}</Text>
              </View>
              <View style={styles.statsCell}>
                <Text style={[styles.levelText, { color: COLORS.xpBar }]}>{(item.weeklyXp || 0).toLocaleString()}</Text>
                <Text style={styles.expText}>Haftalik XP</Text>
              </View>
            </View>
          )}
        />
      )}

      {mainTab === 'seri' && (
        <FlatList
          data={streakEntries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListHeaderComponent={
            <View style={styles.weeklyHeader}>
              <MaterialCommunityIcons name="fire" size={18} color={COLORS.fire} />
              <Text style={styles.weeklyHeaderText}>
                En uzun antrenman serisine sahip savasilar
              </Text>
            </View>
          }
          ListEmptyComponent={
            streakLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.gold} size="large" />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="fire" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Henuz Seri Yok</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.entryRow, item.userId === userId && styles.entryRowMe]}>
              <View style={styles.rankCell}><RankBadge rank={item.rank} /></View>
              <View style={styles.entryInfo}>
                <Text style={[styles.entryName, item.userId === userId && { color: COLORS.gold }]} numberOfLines={1}>
                  {item.characterName}{item.userId === userId ? ' (Sen)' : ''}
                </Text>
                <Text style={styles.entryClass}>Lv.{item.level}</Text>
              </View>
              <View style={styles.statsCell}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="fire" size={16} color={COLORS.fire} />
                  <Text style={[styles.levelText, { color: COLORS.fire }]}>{item.streakDays}</Text>
                </View>
                <Text style={styles.expText}>Gun Seri</Text>
              </View>
            </View>
          )}
        />
      )}

      {mainTab === 'top100' && (
        <FlatList
          data={top100Entries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListHeaderComponent={
            <View style={styles.top100Header}>
              <MaterialCommunityIcons name="podium-gold" size={20} color={COLORS.gold} />
              <Text style={styles.top100HeaderText}>
                Tüm bölgelerden global en iyi 100 kahraman
              </Text>
            </View>
          }
          ListEmptyComponent={
            top100Loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.gold} size="large" />
                <Text style={styles.loadingText}>Top 100 yükleniyor...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="podium" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Henüz Kimse Yok</Text>
                <Text style={styles.emptyText}>Zirveye ilk çıkan sen ol!</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Top100Row entry={item} isMe={item.userId === userId} graphicsScale={graphicsScale} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  pageTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, color: COLORS.text },
  pageSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },

  mainTabRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 12,
  },
  mainTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  mainTabActive: { borderColor: COLORS.gold, backgroundColor: COLORS.gold + '15' },
  mainTabText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textMuted },
  mainTabTextActive: { fontFamily: 'Inter_700Bold', color: COLORS.gold },

  leagueTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  leagueTabText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },

  regionTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  regionTabActive: { backgroundColor: COLORS.gold + '20', borderColor: COLORS.gold },
  regionTabText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },
  regionTabTextActive: { color: COLORS.gold, fontFamily: 'Inter_700Bold' },

  promotionHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.success + '12', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.success + '30',
  },
  promotionHintText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.success },

  groupInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: COLORS.info + '10', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.info + '30',
  },
  groupInfoText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.info, flex: 1, lineHeight: 18 },

  top100Header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.gold + '10', borderRadius: 12,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: COLORS.gold + '30',
  },
  top100HeaderText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.gold, flex: 1, lineHeight: 19 },

  weeklyHeader: {
    gap: 6, backgroundColor: COLORS.xpBar + '10', borderRadius: 12,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: COLORS.xpBar + '30',
  },
  weeklyHeaderText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.xpBar, lineHeight: 19 },
  weeklyReset: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, gap: 10, position: 'relative',
  },
  entryRowMe: { borderColor: COLORS.gold + '60', backgroundColor: COLORS.gold + '08' },
  entryRowPromotion: { borderColor: COLORS.success + '40' },
  top100Row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, gap: 10, position: 'relative',
  },
  top100Podium: { backgroundColor: COLORS.gold + '06', padding: 14 },

  promoTag: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: COLORS.success + '20', borderRadius: 8, padding: 2,
  },
  rankCell: { width: 32, alignItems: 'center' },
  rankNum: { fontFamily: 'Inter_700Bold', fontSize: 14, color: COLORS.textSecondary },
  entryInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  entryName: { fontFamily: 'Inter_700Bold', fontSize: 14, color: COLORS.text, flex: 1 },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  leagueGlowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: COLORS.surfaceElevated,
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  leagueGlowText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  leagueAssetIcon: { width: 12, height: 12 },
  entryClass: { fontFamily: 'Inter_500Medium', fontSize: 11, color: COLORS.textSecondary },
  entryDot: { color: COLORS.textMuted, fontSize: 11 },
  statsCell: { alignItems: 'flex-end' },
  levelText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  expText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textSecondary },
  calText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.fire },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: COLORS.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});
