import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { COLORS } from "@/constants/colors";

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : COLORS.tabBar,
          borderTopWidth: 1,
          borderTopColor: COLORS.tabBarBorder,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.tabBar }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house.fill" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="home" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="quests"
        options={{
          title: "Görevler",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="map.fill" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="map-marker-path" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Market",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="storefront.fill" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="store" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="party"
        options={{
          title: "Grup",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.3.fill" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="account-group" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Sıralama",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="trophy.fill" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="trophy" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.crop.circle.fill" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="account-circle" size={24} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}
