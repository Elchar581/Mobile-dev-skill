// components/form-scroll.tsx
// ScrollView wrapper that respects the bottom safe-area inset.
//
// Use this for any form / sub-route screen where the bottom of the content
// (typically a submit button) would otherwise be hidden behind the Android
// system navigation bar or the iOS home indicator.
//
// Inside tab screens, react-navigation's Tabs typically reserves space for
// the tab bar, so the bottom inset is already 0-ish; using FormScroll there
// is harmless but not necessary.

import React from "react";
import { ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function FormScroll({
  children,
  contentContainerStyle,
  ...rest
}: ScrollViewProps & { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...rest}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
});
