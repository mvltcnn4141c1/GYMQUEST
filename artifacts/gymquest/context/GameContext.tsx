import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getIsOnline } from "./NetworkContext";

const STORAGE_USER_ID = "gymquest_user_id";
const STORAGE_AUTH_TOKEN = "gymquest_auth_token";
const STORAGE_ONBOARDED = "gymquest_onboarded";
const STORAGE_HIGH_GRAPHICS = "gymquest_high_graphics";

export class OfflineError extends Error {
  constructor(message = "offline") {
    super(message);
    this.name = "OfflineError";
  }
}

export type CharacterClass = string;
export type LeagueTier = string;
export type CharacterTier = string;

export interface Character {
  id?: string | number;
  userId?: string;
  name: string;
  class: CharacterClass;
  league: LeagueTier;
  tier?: CharacterTier;
  level: number;
  exp: number;
  expToNextLevel: number;
  strength: number;
  agility: number;
  endurance: number;
  totalWorkouts: number;
  totalXpEarned?: number;
  totalCalories?: number;
  lastWorkoutAt?: string | null;
  lastWorkoutDate?: string | null;
  /** Sonraki antrenmanda günlük turbo (+10% XP) uygulanır mı */
  isTurboActive?: boolean;
  equippedShakerTier?: number;
  streakDays: number;
  streakActive: boolean;
  equippedAura?: string | null;
  friendCode?: string;
  referralCode?: string;
  region?: string;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  championBannerUntil?: string | null;
  eliteTierUntil?: string | null;
  [key: string]: unknown;
}

let activeApiBase: string | null = null;

function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function getLanApiBaseFromExpoHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? null;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0]?.trim();
  if (!host) return null;
  return `http://${host}:3000/api`;
}

function getApiBaseCandidates(): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined) => {
    if (!url) return;
    const normalized = normalizeApiBase(url);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  add(activeApiBase);
  add(process.env.EXPO_PUBLIC_API_URL?.trim());
  add(getLanApiBaseFromExpoHost());

  if (Platform.OS === "android") {
    add("http://10.0.2.2:3000/api");
    add("http://10.0.3.2:3000/api");
  }
  add("http://localhost:3000/api");

  return candidates;
}

function isNetworkRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error instanceof TypeError ||
    msg.includes("network request failed") ||
    msg.includes("failed to fetch")
  );
}

async function fetchWithApiFallback(path: string, init?: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const bases = getApiBaseCandidates();
  let lastError: unknown = null;

  for (const base of bases) {
    try {
      console.log(`[api] trying ${base}${p}`);
      const res = await fetch(`${base}${p}`, init);
      activeApiBase = base;
      console.log(`[api] success ${base}${p} (${res.status})`);
      return res;
    } catch (error) {
      lastError = error;
      console.warn(`[api] failed ${base}${p}:`, error);
      if (!isNetworkRequestError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

let inMemoryToken: string | null = null;

export async function setAuthToken(token: string): Promise<void> {
  inMemoryToken = token;
  await AsyncStorage.setItem(STORAGE_AUTH_TOKEN, token);
}

async function loadToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const t = await AsyncStorage.getItem(STORAGE_AUTH_TOKEN);
  inMemoryToken = t;
  return t;
}

async function clearToken(): Promise<void> {
  inMemoryToken = null;
  await AsyncStorage.removeItem(STORAGE_AUTH_TOKEN);
}

function randomUserId(): string {
  return `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function mapCharacter(raw: Record<string, unknown>): Character {
  const exp = Number(raw.exp ?? raw.xp ?? 0);
  const level = Number(raw.level ?? 1);
  return {
    ...raw,
    name: String(raw.name ?? "Kahraman"),
    class: String(raw.class ?? "fighter"),
    league: String(raw.league ?? "demir"),
    tier: String(raw.tier ?? "common"),
    level,
    exp,
    expToNextLevel: Number(raw.expToNextLevel ?? 150),
    strength: Number(raw.strength ?? 10),
    agility: Number(raw.agility ?? 10),
    endurance: Number(raw.endurance ?? 10),
    totalWorkouts: Number(raw.totalWorkouts ?? 0),
    totalXpEarned: Number(raw.totalXpEarned ?? raw.totalExp ?? 0),
    totalCalories: Number(raw.totalCalories ?? 0),
    lastWorkoutAt: (raw.lastWorkoutAt ?? raw.last_workout_at) as string | null | undefined,
    lastWorkoutDate: (raw.lastWorkoutDate ?? raw.last_workout_date ?? null) as string | null | undefined,
    isTurboActive: raw.isTurboActive !== undefined ? Boolean(raw.isTurboActive) : undefined,
    equippedShakerTier: Number(raw.equippedShakerTier ?? raw.equipped_shaker_tier ?? 0),
    streakDays: Number(raw.streakDays ?? raw.questStreak ?? 0),
    streakActive: Boolean(raw.streakActive),
    equippedAura: (
      raw.equippedAura ??
      raw.equipped_aura ??
      raw.current_aura ??
      null
    ) as string | null,
    friendCode: raw.friendCode as string | undefined,
    referralCode: raw.referralCode as string | undefined,
    instagramUrl: (raw.instagramUrl ?? raw.instagram_url ?? null) as string | null,
    twitterUrl: (raw.twitterUrl ?? raw.twitter_url ?? null) as string | null,
    championBannerUntil: (raw.championBannerUntil ?? raw.champion_banner_until ?? null) as string | null,
    eliteTierUntil: (raw.eliteTierUntil ?? raw.elite_tier_until ?? null) as string | null,
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!getIsOnline()) {
    throw new OfflineError();
  }
  const token = await loadToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithApiFallback(path, { headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const err =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : `HTTP ${res.status}`;
    const e = new Error(err) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  return body as T;
}

export type ApiPostResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error?: string;
      data?: T;
      code?: string;
      remainingSeconds?: number;
    };

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<ApiPostResult<T>> {
  if (!getIsOnline()) {
    return { ok: false, error: "Çevrimdışısınız" };
  }
  const token = await loadToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithApiFallback(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = { error: text || "Geçersiz yanıt" };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: String(json?.error ?? `HTTP ${res.status}`),
      data: json as T,
      code: typeof json?.code === "string" ? json.code : undefined,
      remainingSeconds:
        typeof json?.remainingSeconds === "number" ? json.remainingSeconds : undefined,
    };
  }
  return { ok: true, data: (json ?? {}) as T };
}

export async function apiDelete(path: string): Promise<void> {
  if (!getIsOnline()) {
    throw new OfflineError();
  }
  const token = await loadToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithApiFallback(path, { method: "DELETE", headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

type GameCtx = {
  userId: string;
  character: Character | null;
  isLoading: boolean;
  isOnboarded: boolean;
  initError: string | null;
  highGraphicsEnabled: boolean;
  lowPerformanceDevice: boolean;
  deviceModel: string;
  deviceMemoryGb: number;
  setCharacter: (c: Character | null) => void;
  refreshCharacter: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setHighGraphicsEnabled: (value: boolean) => Promise<void>;
};

const GameContext = createContext<GameCtx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState("");
  const [character, setCharacterState] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [highGraphicsEnabled, setHighGraphicsEnabledState] = useState(true);
  const [lowPerformanceDevice, setLowPerformanceDevice] = useState(false);
  const [deviceModel, setDeviceModel] = useState("Unknown");
  const [deviceMemoryGb, setDeviceMemoryGb] = useState(0);

  const fetchCharacterWithAura = useCallback(async (): Promise<Character> => {
    const raw = await apiGet<Record<string, unknown>>("/character");
    const mapped = mapCharacter(raw);
    // Some backend responses may omit aura info on /character; merge from /store when available.
    if (!mapped.equippedAura) {
      try {
        const store = await apiGet<Record<string, unknown>>("/store");
        const fallbackAura = (store.equippedAura ?? store.equipped_aura ?? store.current_aura ?? null) as string | null;
        if (fallbackAura) {
          return { ...mapped, equippedAura: fallbackAura };
        }
      } catch {
        // Ignore store fetch failure and keep base character payload.
      }
    }
    return mapped;
  }, []);

  const mergeAuraSafely = useCallback((next: Character, prev: Character | null): Character => {
    if (next.equippedAura) return next;
    if (prev?.equippedAura) {
      return { ...next, equippedAura: prev.equippedAura };
    }
    return next;
  }, []);

  const refreshCharacter = useCallback(async () => {
    setInitError(null);
    const token = await loadToken();
    if (!token) {
      setCharacterState(null);
      setIsOnboarded(false);
      return;
    }
    try {
      const merged = await fetchCharacterWithAura();
      setCharacterState((prev) => mergeAuraSafely(merged, prev));
      setIsOnboarded(true);
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "true");
    } catch (e: unknown) {
      const status = e instanceof Error ? (e as Error & { status?: number }).status : undefined;
      const msg = e instanceof Error ? e.message : String(e);
      if (status === 404 || msg.includes("404") || msg.toLowerCase().includes("bulunamad")) {
        await clearToken();
        setCharacterState(null);
        setIsOnboarded(false);
        await AsyncStorage.removeItem(STORAGE_ONBOARDED);
        return;
      }
      if (status === 401 || msg.includes("401") || msg.toLowerCase().includes("yetkisiz")) {
        await clearToken();
        setCharacterState(null);
        setIsOnboarded(false);
        return;
      }
      setInitError(msg);
      setCharacterState(null);
    }
  }, [fetchCharacterWithAura, mergeAuraSafely]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let uid = await AsyncStorage.getItem(STORAGE_USER_ID);
        if (!uid) {
          uid = randomUserId();
          await AsyncStorage.setItem(STORAGE_USER_ID, uid);
        }
        if (cancelled) return;
        setUserId(uid);

        const onboarded = (await AsyncStorage.getItem(STORAGE_ONBOARDED)) === "true";
        await loadToken();
        if (cancelled) return;

        if (onboarded || inMemoryToken) {
          try {
            const merged = await fetchCharacterWithAura();
            if (cancelled) return;
            setCharacterState((prev) => mergeAuraSafely(merged, prev));
            setIsOnboarded(true);
          } catch (e: unknown) {
            const status = e instanceof Error ? (e as Error & { status?: number }).status : undefined;
            const msg = e instanceof Error ? e.message : String(e);
            if (status === 404 || msg.includes("404") || msg.toLowerCase().includes("bulunamad")) {
              setCharacterState(null);
              setIsOnboarded(false);
            } else if (
              status === 401 ||
              msg.includes("401") ||
              msg.toLowerCase().includes("yetkisiz") ||
              e instanceof OfflineError
            ) {
              if (e instanceof OfflineError) {
                setInitError("Sunucuya bağlanılamıyor. Bağlantınızı kontrol edin.");
              } else {
                await clearToken();
                setCharacterState(null);
                setIsOnboarded(false);
              }
            } else {
              setInitError(msg);
            }
          }
        } else {
          setIsOnboarded(false);
          setCharacterState(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedGraphics = await AsyncStorage.getItem(STORAGE_HIGH_GRAPHICS);
      if (!cancelled) {
        setHighGraphicsEnabledState(savedGraphics !== "false");
      }
      const model = String(Device.modelName || Device.deviceName || "Unknown");
      const totalMemory = Number((Device as any).totalMemory || 0);
      const memoryGb = totalMemory > 0 ? Number((totalMemory / (1024 ** 3)).toFixed(1)) : 0;
      if (!cancelled) {
        setDeviceModel(model);
        setDeviceMemoryGb(memoryGb);
        setLowPerformanceDevice(memoryGb > 0 ? memoryGb < 4 : false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCharacter = useCallback((c: Character | null) => {
    setCharacterState(c);
    if (c) setIsOnboarded(true);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_ONBOARDED, "true");
    setIsOnboarded(true);
  }, []);

  const setHighGraphicsEnabled = useCallback(async (value: boolean) => {
    setHighGraphicsEnabledState(value);
    await AsyncStorage.setItem(STORAGE_HIGH_GRAPHICS, value ? "true" : "false");
  }, []);

  const value = useMemo(
    () => ({
      userId,
      character,
      isLoading,
      isOnboarded,
      initError,
      highGraphicsEnabled,
      lowPerformanceDevice,
      deviceModel,
      deviceMemoryGb,
      setCharacter,
      refreshCharacter,
      completeOnboarding,
      setHighGraphicsEnabled,
    }),
    [
      userId,
      character,
      isLoading,
      isOnboarded,
      initError,
      highGraphicsEnabled,
      lowPerformanceDevice,
      deviceModel,
      deviceMemoryGb,
      setCharacter,
      refreshCharacter,
      completeOnboarding,
      setHighGraphicsEnabled,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameCtx {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within GameProvider");
  }
  return ctx;
}
