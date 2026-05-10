// components/alert-modal.tsx — drop-in replacement for React Native Alert.alert
//
// Why: RN's Alert.alert has platform-specific limits (iOS shows max 3 buttons),
// inconsistent visuals, and can't be styled to match the app theme. This is a
// global modal driven by a tiny Zustand store; the imperative `alertModal()`
// keeps the same signature as Alert.alert so the migration is mechanical.
//
// 1. Mount <AlertModal /> ONCE in app/_layout.tsx (root):
//
//      <ThemeProvider ...>
//        <Stack>...</Stack>
//        <AlertModal />
//      </ThemeProvider>
//
// 2. From anywhere in the app:
//
//      import { alertModal } from "@/store/alert";
//      alertModal("Title", "Message");
//      alertModal("Delete?", "This is permanent.", [
//        { text: "Cancel", style: "cancel" },
//        { text: "Delete", style: "destructive", onPress: () => doDelete() },
//      ]);

// ─── store/alert.ts ─────────────────────────────────────────
import { create } from "zustand";

export type AlertButton = {
  text: string;
  style?: "default" | "destructive" | "cancel";
  onPress?: () => void;
};

export type AlertConfig = {
  title?: string;
  message?: string;
  buttons: AlertButton[];
};

type AlertState = {
  visible: boolean;
  config: AlertConfig | null;
  show: (c: AlertConfig) => void;
  hide: () => void;
};

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  config: null,
  show: (config) => set({ visible: true, config }),
  hide: () => set({ visible: false, config: null }),
}));

export function alertModal(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  useAlertStore.getState().show({
    title,
    message,
    buttons: buttons ?? [{ text: "OK" }],
  });
}

// ─── components/alert-modal.tsx ──────────────────────────────
import React from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";

// Replace these imports with your themed primitives, OR inline RN <Text>/<View>
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export function AlertModal() {
  const visible = useAlertStore((s) => s.visible);
  const config = useAlertStore((s) => s.config);
  const hide = useAlertStore((s) => s.hide);

  if (!config) {
    return <Modal visible={false} transparent><View /></Modal>;
  }

  const handlePress = (b: AlertButton) => {
    hide();
    setTimeout(() => b.onPress?.(), 0);
  };

  const cancelBtn = config.buttons.find((b) => b.style === "cancel");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => (cancelBtn ? handlePress(cancelBtn) : hide())}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => cancelBtn && handlePress(cancelBtn)}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <ThemedView style={styles.card}>
            {config.title ? (
              <ThemedText type="subtitle" style={styles.title}>{config.title}</ThemedText>
            ) : null}
            {config.message ? (
              <ThemedText style={styles.message}>{config.message}</ThemedText>
            ) : null}
            <View style={styles.buttons}>
              {config.buttons.map((b, i) => (
                <TouchableOpacity key={i} style={styles.btn} onPress={() => handlePress(b)}>
                  <ThemedText
                    type={b.style === "cancel" ? "default" : "defaultSemiBold"}
                    style={[
                      styles.btnText,
                      b.style === "destructive" && styles.btnDestructive,
                      b.style === "cancel" && styles.btnCancel,
                    ]}
                  >
                    {b.text}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: { width: 320, borderRadius: 16, padding: 20, gap: 8 },
  title: { textAlign: "center" },
  message: { textAlign: "center", opacity: 0.8, marginTop: 4, marginBottom: 4 },
  buttons: { marginTop: 8, gap: 4 },
  btn: {
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(127,127,127,0.3)",
  },
  btnText: { fontSize: 16, color: "#0a7ea4" },
  btnDestructive: { color: "#c62828" },
  btnCancel: { color: "#888" },
});
