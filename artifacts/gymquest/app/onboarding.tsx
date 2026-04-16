import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, CLASS_COLORS } from '@/constants/colors';
import { useGame, apiPost, setAuthToken, CharacterClass } from '@/context/GameContext';
import { DND_CLASSES, DND_CLASS_ICONS } from '@/constants/dnd-classes';

const REGIONS = [
  { value: 'global',      label: 'Global'   },
  { value: 'europe',      label: 'Avrupa'   },
  { value: 'americas',    label: 'Amerika'  },
  { value: 'asia',        label: 'Asya'     },
  { value: 'middle east', label: 'Orta Doğu'},
  { value: 'africa',      label: 'Afrika'   },
];

const TOTAL_STEPS = 4;

const TIER_STAGES = [
  { key: 'common', label: 'Common', minLevel: 1, maxLevel: 10, icon: 'circle-medium', color: '#9AA0AA' },
  { key: 'uncommon', label: 'Uncommon', minLevel: 11, maxLevel: 20, icon: 'shield-outline', color: '#49C46B' },
  { key: 'rare', label: 'Rare', minLevel: 21, maxLevel: 30, icon: 'diamond-stone', color: '#4DA3FF' },
  { key: 'epic', label: 'Epic', minLevel: 31, maxLevel: 40, icon: 'star-four-points', color: '#B97CFF' },
  { key: 'legendary', label: 'Legendary', minLevel: 41, maxLevel: 50, icon: 'crown-outline', color: '#FFB84D' },
  { key: 'mythic', label: 'Mythic', minLevel: 51, maxLevel: null, icon: 'creation-outline', color: '#FF5EC9' },
] as const;

const CLASS_MYTHIC_TITLES: Record<string, string> = {
  barbarian: 'Mythic Warlord',
  fighter: 'Mythic Vanguard',
  paladin: 'Mythic Aegis',
  monk: 'Mythic Ascendant',
  rogue: 'Mythic Shadow',
  ranger: 'Mythic Pathfinder',
  wizard: 'Mythic Arcanist',
  warrior: 'Mythic Conqueror',
  mage: 'Mythic Spellbinder',
  archer: 'Mythic Deadeye',
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { userId, setCharacter, completeOnboarding } = useGame();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  const slideAnim = useRef(new Animated.Value(0)).current;

  function nextStep() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep((s) => s + 1);
  }

  async function createCharacter() {
    if (!selectedClass || !name.trim()) return;
    setIsCreating(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const res = await apiPost<any>('/character', {
        userId,
        name: name.trim(),
        class: selectedClass,
        region: selectedRegion.value,
      });
      if (!res.ok) {
        Alert.alert('Hata', res.error || 'Karakter olusturulamadi');
        return;
      }
      if (res.data.authToken) await setAuthToken(res.data.authToken);
      setCharacter(res.data);
      if (referralCode.trim()) {
        try {
          const refRes = await apiPost('/referral/apply', { referralCode: referralCode.trim() });
          if (!refRes.ok) {
            if (__DEV__) console.log('Referral apply failed (non-blocking):', refRes.error);
          }
        } catch (refErr) {
          if (__DEV__) console.log('Referral apply failed (non-blocking):', refErr);
        }
      }
      completeOnboarding();
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Baglanti hatasi');
    } finally {
      setIsCreating(false);
    }
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.screen, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>

          {step === 0 && (
            <View style={styles.stepContainer}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="sword-cross" size={64} color={COLORS.gold} />
              </View>
              <Text style={styles.heroTitle}>GymQuest</Text>
              <Text style={styles.heroSubtitle}>
                Antrenmanlarını epik maceralara dönüştür. XP kazan, karakterini güçlendir, sıralamada zirveye çık!
              </Text>

              <View style={styles.featureList}>
                {[
                  { icon: 'lightning-bolt',   text: 'Her tekrar ve set için XP kazan' },
                  { icon: 'trophy',            text: 'Lig sisteminde zirveye tırman (Demir → Şampiyonluk)' },
                  { icon: 'account-group',     text: 'Maceracı grubu kur, boss\'ları birlikte yen' },
                  { icon: 'shield-star',       text: 'Karakterin seviye atladıkça görsel olarak evrimleşir' },
                ].map((f) => (
                  <View key={f.icon} style={styles.featureItem}>
                    <MaterialCommunityIcons name={f.icon as any} size={20} color={COLORS.gold} />
                    <Text style={styles.featureText}>{f.text}</Text>
                  </View>
                ))}
              </View>

              <Pressable style={styles.primaryBtn} onPress={nextStep}>
                <Text style={styles.primaryBtnText}>Maceraya Başla</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#000" />
              </Pressable>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Kahramanının Adı</Text>
              <Text style={styles.stepSubtitle}>
                Rakiplerine korku salacak — ya da seni motive edecek — bir isim seç.
              </Text>

              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Kahraman adını gir..."
                placeholderTextColor={COLORS.textMuted}
                maxLength={20}
                autoFocus
                returnKeyType="done"
              />

              <Pressable
                style={[styles.primaryBtn, !name.trim() && styles.btnDisabled]}
                onPress={name.trim() ? nextStep : undefined}
              >
                <Text style={styles.primaryBtnText}>Devam Et</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#000" />
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Sınıfını Seç</Text>
              <Text style={styles.stepSubtitle}>
                Sınıfın, hangi egzersizlerden daha fazla XP kazanacağını belirler.
              </Text>

              <View style={styles.classGrid}>
                {DND_CLASSES.map((cls) => {
                  const isSelected = selectedClass === cls.id;
                  const color = CLASS_COLORS[cls.id] || cls.color;
                  return (
                    <Pressable
                      key={cls.id}
                      style={[
                        styles.classCard,
                        {
                          borderColor: isSelected ? color : COLORS.border,
                          backgroundColor: isSelected ? color + '15' : COLORS.surface,
                        },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedClass(cls.id);
                      }}
                    >
                      <View style={[styles.classIconWrapper, { backgroundColor: color + '20', borderColor: color + '44' }]}>
                        <MaterialCommunityIcons name={cls.icon as any} size={28} color={color} />
                      </View>
                      <Text style={[styles.className, isSelected && { color }]}>{cls.name}</Text>
                      <Text style={styles.classDesc}>{cls.description}</Text>
                      <View style={styles.classBonusRow}>
                        <MaterialCommunityIcons name="sword" size={9} color={color + 'CC'} />
                        <Text style={[styles.classBonus, { color: color + 'CC' }]}>{cls.attributeLabel}</Text>
                      </View>
                      <View style={styles.evolutionMiniRow}>
                        {TIER_STAGES.map((tier, idx) => {
                          const isUnlocked = tier.minLevel <= 1;
                          return (
                            <React.Fragment key={`${cls.id}-${tier.key}`}>
                              {idx > 0 && <View style={[styles.evolutionMiniLine, !isUnlocked && styles.evolutionMiniLineLocked]} />}
                              <View style={[styles.evolutionMiniNode, !isUnlocked && styles.evolutionMiniNodeLocked]}>
                                <MaterialCommunityIcons
                                  name={(isUnlocked ? tier.icon : 'lock-outline') as any}
                                  size={10}
                                  color={isUnlocked ? tier.color : COLORS.textMuted}
                                />
                              </View>
                            </React.Fragment>
                          );
                        })}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {selectedClass && (
                <View style={styles.evolutionCard}>
                  <Text style={styles.evolutionTitle}>Evrim Yolu</Text>
                  <Text style={styles.evolutionSubtitle}>
                    {DND_CLASSES.find((c) => c.id === selectedClass)?.name}: Seviye 51&apos;de{' '}
                    {CLASS_MYTHIC_TITLES[selectedClass] || 'Mythic Champion'} olur.
                  </Text>
                  <View style={styles.evolutionTimeline}>
                    {TIER_STAGES.map((tier, idx) => (
                      <View key={tier.key} style={styles.evolutionStep}>
                        <View style={[styles.evolutionNode, tier.minLevel > 1 && styles.evolutionNodeLocked]}>
                          <MaterialCommunityIcons
                            name={(tier.minLevel > 1 ? 'lock-outline' : tier.icon) as any}
                            size={14}
                            color={tier.minLevel > 1 ? COLORS.textMuted : tier.color}
                          />
                        </View>
                        <Text style={[styles.evolutionLabel, tier.minLevel > 1 && styles.evolutionLabelLocked]}>
                          {tier.label}
                        </Text>
                        <Text style={[styles.evolutionRange, tier.minLevel > 1 && styles.evolutionLabelLocked]}>
                          {tier.maxLevel ? `${tier.minLevel}-${tier.maxLevel}` : `${tier.minLevel}+`}
                        </Text>
                        {idx < TIER_STAGES.length - 1 && <View style={styles.evolutionConnector} />}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Pressable
                style={[styles.primaryBtn, !selectedClass && styles.btnDisabled]}
                onPress={selectedClass ? nextStep : undefined}
              >
                <Text style={styles.primaryBtnText}>Devam Et</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#000" />
              </Pressable>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Bölgeni Seç</Text>
              <Text style={styles.stepSubtitle}>
                Bölge liderlik tablosunda zirveye tırman.
              </Text>

              <View style={styles.regionList}>
                {REGIONS.map((region) => {
                  const isSelected = selectedRegion.value === region.value;
                  return (
                    <Pressable
                      key={region.value}
                      style={[
                        styles.regionItem,
                        isSelected && { borderColor: COLORS.gold, backgroundColor: COLORS.gold + '11' },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedRegion(region);
                      }}
                    >
                      <MaterialCommunityIcons
                        name={isSelected ? 'map-marker' : 'map-marker-outline'}
                        size={20}
                        color={isSelected ? COLORS.gold : COLORS.textSecondary}
                      />
                      <Text style={[styles.regionText, isSelected && { color: COLORS.gold }]}>
                        {region.label}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color={COLORS.gold}
                          style={{ marginLeft: 'auto' }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.summaryCard}>
                <View style={[
                  styles.summaryIcon,
                  {
                    backgroundColor: selectedClass ? CLASS_COLORS[selectedClass] + '20' : COLORS.surfaceElevated,
                    borderColor: selectedClass ? CLASS_COLORS[selectedClass] + '50' : COLORS.border,
                  },
                ]}>
                  <MaterialCommunityIcons
                    name={(selectedClass ? DND_CLASS_ICONS[selectedClass] || 'sword' : 'sword') as any}
                    size={28}
                    color={selectedClass ? CLASS_COLORS[selectedClass] : COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryName}>{name}</Text>
                  <Text style={styles.summaryInfo}>
                    {selectedClass ? DND_CLASSES.find((c) => c.id === selectedClass)?.name : ''} · {selectedRegion.label}
                  </Text>
                </View>
              </View>

              <View style={styles.referralRow}>
                <MaterialCommunityIcons name="gift-outline" size={18} color={COLORS.arcane} />
                <TextInput
                  style={styles.referralInput}
                  placeholder="Referans kodu (istege bagli)"
                  placeholderTextColor={COLORS.textMuted}
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoCapitalize="characters"
                  maxLength={7}
                />
              </View>

              <Pressable style={styles.primaryBtn} onPress={createCharacter} disabled={isCreating}>
                {isCreating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="sword" size={20} color="#000" />
                    <Text style={styles.primaryBtnText}>Arenaya Gir!</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.dots}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24 },
  stepContainer: { alignItems: 'center', gap: 20 },
  heroIcon: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.gold + '15', borderWidth: 2, borderColor: COLORS.gold + '44',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 42, color: COLORS.gold, letterSpacing: 2 },
  heroSubtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 16, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },
  featureList: { width: '100%', gap: 12 },
  featureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  featureText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.text, flex: 1 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.gold, paddingVertical: 16, paddingHorizontal: 32,
    borderRadius: 16, gap: 8, width: '100%', marginTop: 8,
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#000', letterSpacing: 0.5 },
  stepTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, color: COLORS.text, textAlign: 'center' },
  stepSubtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 15, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  nameInput: {
    width: '100%', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, padding: 18, color: COLORS.text, fontFamily: 'Inter_600SemiBold',
    fontSize: 18, textAlign: 'center',
  },
  classGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  classCard: { width: '47%', padding: 12, borderRadius: 16, borderWidth: 2, alignItems: 'center', gap: 6, position: 'relative' },
  classIconWrapper: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  className: { fontFamily: 'Inter_700Bold', fontSize: 13, color: COLORS.text, textAlign: 'center' },
  classDesc: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
  classBonusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  classBonus: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  evolutionMiniRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  evolutionMiniLine: { width: 6, height: 1, backgroundColor: COLORS.textSecondary + '66' },
  evolutionMiniLineLocked: { backgroundColor: COLORS.textMuted + '44' },
  evolutionMiniNode: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  evolutionMiniNodeLocked: { opacity: 0.6 },
  evolutionCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  evolutionTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: COLORS.gold },
  evolutionSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  evolutionTimeline: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  evolutionStep: { flex: 1, alignItems: 'center', position: 'relative' },
  evolutionNode: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  evolutionNodeLocked: { opacity: 0.55 },
  evolutionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: COLORS.text, marginTop: 4, textAlign: 'center' },
  evolutionRange: { fontFamily: 'Inter_400Regular', fontSize: 9, color: COLORS.textSecondary, marginTop: 1 },
  evolutionLabelLocked: { color: COLORS.textMuted },
  evolutionConnector: {
    position: 'absolute',
    top: 13,
    right: -6,
    width: 12,
    height: 1,
    backgroundColor: COLORS.textMuted + '66',
  },
  regionList: { width: '100%', gap: 8 },
  regionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  regionText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: COLORS.text },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.surface, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.gold + '44', width: '100%',
  },
  summaryIcon: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryName: { fontFamily: 'Inter_700Bold', fontSize: 18, color: COLORS.gold },
  summaryInfo: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  referralRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.arcane + '30', width: '100%',
  },
  referralInput: {
    flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.text,
    paddingVertical: 2,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.gold, width: 24 },
});
