import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types & Constants ──────────────────────────────────────────────────────

type ColorPreset = { label: string; warmth: number };

// warmth 0 = warm/candle (2700K, orange) ← LEFT
// warmth 1 = cool/daylight (6500K, blue)   RIGHT →
const PRESETS: ColorPreset[] = [
  { label: "Candle",     warmth: 0    },
  { label: "Warm White", warmth: 0.25 },
  { label: "Neutral",    warmth: 0.5  },
  { label: "Daylight",   warmth: 0.75 },
  { label: "Cool White", warmth: 1.0  },
];

// Pre-computed background colours at each preset stop (no brightness baked in —
// brightness is handled by a separate animated overlay).
const WARMTH_BG: [string, string, string, string, string] = [
  "rgb(255,197,108)", // 0    candle
  "rgb(244,205,145)", // 0.25 warm white
  "rgb(233,213,182)", // 0.5  neutral
  "rgb(221,220,218)", // 0.75 daylight
  "rgb(210,228,255)", // 1.0  cool white
];

// Static gradient colours for the warmth track (always orange→blue)
const WARMTH_TRACK = ["#F59A20", "#FFD080", "#FFF5E0", "#DDEEFF", "#B0CCFF"] as const;

function warmthToKelvin(w: number) {
  return `${Math.round(2700 + w * 3800)}K`;
}

function nearestPreset(w: number): number {
  return PRESETS.reduce((best, p, i) =>
    Math.abs(p.warmth - w) < Math.abs(PRESETS[best].warmth - w) ? i : best, 0);
}

function previewColor(w: number) {
  const r = Math.round(255 + (150 - 255) * w);
  const g = Math.round(178 + (195 - 178) * w);
  const b = Math.round(72  + (255 - 72)  * w);
  return `rgb(${r},${g},${b})`;
}

// ─── Slider ──────────────────────────────────────────────────────────────────
// Drives an externalAnim (Animated.Value) directly via setValue() — never
// calls setState on the parent, so the parent never re-renders during drag.
// The gradient track is rendered internally to avoid new ReactNode refs each
// render (which would break React.memo).

type SliderVariant = "brightness" | "warmth";

type SliderProps = {
  externalAnim: Animated.Value;
  variant: SliderVariant;
  label: string;
  sublabel: string;
  dark: boolean;
};

const Slider = memo(function Slider({ externalAnim, variant, label, sublabel, dark }: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  // Memoised interpolations — only rebuilt when trackWidth changes (once on mount)
  const thumbLeft = useRef(externalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }));
  const lastTrackWidth = useRef(0);
  if (trackWidth !== lastTrackWidth.current) {
    lastTrackWidth.current = trackWidth;
    const travel = Math.max(0, trackWidth - THUMB);
    thumbLeft.current = externalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (!trackWidthRef.current) return;
        externalAnim.setValue(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidthRef.current)));
      },
      onPanResponderMove: (e) => {
        if (!trackWidthRef.current) return;
        externalAnim.setValue(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidthRef.current)));
      },
    })
  ).current;

  const labelClr = dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)";
  const sublabelClr = dark ? "#fff" : "rgba(0,0,0,0.85)";
  const thumbBorder = dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)";

  return (
    <View style={sl.wrapper}>
      <View style={sl.row}>
        <Text style={[sl.label, { color: labelClr }]}>{label}</Text>
        <Text style={[sl.sublabel, { color: sublabelClr }]}>{sublabel}</Text>
      </View>
      <View
        style={sl.outer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          trackWidthRef.current = w;
          setTrackWidth(w);
        }}
        {...pan.panHandlers}
      >
        {/* Track */}
        <View style={[sl.track, { borderRadius: THUMB / 2, overflow: "hidden" }]}>
          {variant === "warmth" ? (
            <LinearGradient
              colors={WARMTH_TRACK}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <LinearGradient
              colors={dark ? ["#1a1a1a", "#ffffff"] : ["rgba(0,0,0,0.15)", "rgba(0,0,0,0.72)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          )}
        </View>
        {/* Thumb */}
        <Animated.View style={[sl.thumb, { left: thumbLeft.current, borderColor: thumbBorder }]} />
      </View>
    </View>
  );
},
// Custom comparator: only re-render when label/sublabel/dark change.
// externalAnim and variant are stable refs — skip them.
(prev, next) =>
  prev.sublabel === next.sublabel &&
  prev.label === next.label &&
  prev.dark === next.dark &&
  prev.variant === next.variant
);

const THUMB = 30;

const sl = StyleSheet.create({
  wrapper: { gap: 10, width: "100%" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.6, textTransform: "uppercase" },
  sublabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  outer: { height: THUMB, justifyContent: "center", position: "relative" },
  track: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#fff",
    borderWidth: 2.5,
    top: 0,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as any,
});

// ─── Preset Dropdown ─────────────────────────────────────────────────────────

type DropdownProps = {
  presets: ColorPreset[];
  activeIdx: number;
  onSelect: (idx: number, preset: ColorPreset) => void;
  dark: boolean;
  warmth: number;
};

const PresetDropdown = memo(function PresetDropdown({
  presets, activeIdx, onSelect, dark, warmth,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const textClr   = dark ? "#fff" : "rgba(0,0,0,0.85)";
  const bgClr     = dark ? "rgba(0,0,0,0.5)"  : "rgba(255,255,255,0.6)";
  const borderClr = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)";
  const modalBg   = dark ? "#141414" : "#fafafa";
  const sepClr    = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  return (
    <>
      <Pressable
        onPress={() => { setOpen(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        style={({ pressed }) => [
          dd.trigger, { backgroundColor: bgClr, borderColor: borderClr, opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <View style={dd.left}>
          <View style={[dd.dot, { backgroundColor: previewColor(warmth) }]} />
          <Text style={[dd.triggerLabel, { color: textClr }]}>
            {presets[activeIdx].label}
          </Text>
        </View>
        <Feather name="chevron-down" size={16} color={dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)"} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={dd.overlay} onPress={() => setOpen(false)}>
          <View style={[dd.sheet, { backgroundColor: modalBg, paddingBottom: bottomPad + 12 }]}>
            <View style={[dd.handle, { backgroundColor: sepClr }]} />
            <Text style={[dd.sheetTitle, { color: dark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.33)" }]}>
              Colour Temperature
            </Text>
            {presets.map((preset, idx) => {
              const active = activeIdx === idx;
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => { onSelect(idx, preset); setOpen(false); }}
                  style={({ pressed }) => [
                    dd.option,
                    {
                      borderTopColor: sepClr,
                      borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                      backgroundColor: active ? (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)") : "transparent",
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <View style={dd.optionLeft}>
                    <View style={[dd.optionDot, { backgroundColor: previewColor(preset.warmth) }]} />
                    <View>
                      <Text style={[dd.optionLabel, { color: textClr }]}>{preset.label}</Text>
                      <Text style={[dd.optionSub, { color: dark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.33)" }]}>
                        {warmthToKelvin(preset.warmth)}
                      </Text>
                    </View>
                  </View>
                  {active && <Feather name="check" size={18} color={dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)"} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
});

const dd = StyleSheet.create({
  trigger: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, borderWidth: 1,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  triggerLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetTitle: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8,
    textTransform: "uppercase", marginBottom: 4,
  },
  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 15, paddingHorizontal: 4, borderRadius: 10,
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  optionDot: { width: 20, height: 20, borderRadius: 10 },
  optionLabel: { fontSize: 16, fontFamily: "Inter_500Medium" },
  optionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ScreenLight() {
  const insets = useSafeAreaInsets();

  // ── Animated values (never cause React re-renders on their own) ──
  const warmthAnim     = useRef(new Animated.Value(0.25)).current; // Warm White default
  const brightnessAnim = useRef(new Animated.Value(1.0)).current;
  const onOffAnim      = useRef(new Animated.Value(1.0)).current;  // 1=on, 0=off
  const collapseAnim   = useRef(new Animated.Value(1.0)).current;  // 1=open, 0=closed

  // ── React state — only for UI labels / theme, NOT for background colour ──
  const [brightnessLabel, setBrightnessLabel] = useState("100%");
  const [warmthLabel,     setWarmthLabel    ] = useState(warmthToKelvin(0.25));
  const [activePreset,    setActivePreset   ] = useState(1); // Warm White
  const [isDark,          setIsDark         ] = useState(false);
  const [isOn,            setIsOn           ] = useState(true);
  const [controlsOpen,    setControlsOpen   ] = useState(true);

  const lastBTime = useRef(0);
  const lastWTime = useRef(0);

  // Listeners: update labels at ~12 fps (never trigger background repaint)
  useEffect(() => {
    const bId = brightnessAnim.addListener(({ value }) => {
      const t = Date.now();
      if (t - lastBTime.current < 80) return;
      lastBTime.current = t;
      setBrightnessLabel(`${Math.round(value * 100)}%`);
      setIsDark(value < 0.35);
    });
    const wId = warmthAnim.addListener(({ value }) => {
      const t = Date.now();
      if (t - lastWTime.current < 80) return;
      lastWTime.current = t;
      setWarmthLabel(warmthToKelvin(value));
      setActivePreset(nearestPreset(value));
    });
    return () => {
      brightnessAnim.removeListener(bId);
      warmthAnim.removeListener(wId);
    };
  }, [brightnessAnim, warmthAnim]);

  // ── Background colour: Animated.View driven by warmthAnim ──
  // Zero React re-renders when warmth changes during drag.
  const animatedBgColor = warmthAnim.interpolate({
    inputRange:  [0,    0.25, 0.5,  0.75, 1   ],
    outputRange: WARMTH_BG,
  });

  // Brightness black overlay (0=bright, 0.95=dim)
  const brightnessOverlay = brightnessAnim.interpolate({
    inputRange:  [0.05, 1],
    outputRange: [0.95, 0],
  });

  // ON/OFF black overlay
  const offOverlay = onOffAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  // Controls collapse
  const controlsMaxH   = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 420] });
  const controlsOpacity = collapseAnim;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggle = useCallback(() => {
    setIsOn((prev) => {
      const next = !prev;
      Animated.timing(onOffAnim, {
        toValue: next ? 1 : 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [onOffAnim]);

  const handleCollapseToggle = useCallback(() => {
    setControlsOpen((prev) => {
      const next = !prev;
      Animated.timing(collapseAnim, {
        toValue: next ? 1 : 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [collapseAnim]);

  const handlePreset = useCallback((idx: number, preset: ColorPreset) => {
    // Animate warmthAnim to the preset — Slider thumb follows automatically
    Animated.timing(warmthAnim, {
      toValue: preset.warmth,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    setActivePreset(idx);
    setWarmthLabel(warmthToKelvin(preset.warmth));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [warmthAnim]);

  // ── Derived UI colours (depend only on isDark, change infrequently) ──
  const controlsBg     = isDark ? "rgba(0,0,0,0.52)"         : "rgba(255,255,255,0.62)";
  const controlsBorder = isDark ? "rgba(255,255,255,0.10)"   : "rgba(0,0,0,0.08)";
  const pillBg         = isDark ? "rgba(255,255,255,0.10)"   : "rgba(0,0,0,0.07)";
  const pillBorder     = isDark ? "rgba(255,255,255,0.15)"   : "rgba(0,0,0,0.09)";
  const iconColor      = isDark ? "rgba(255,255,255,0.65)"   : "rgba(0,0,0,0.45)";
  const dividerColor   = isDark ? "rgba(255,255,255,0.08)"   : "rgba(0,0,0,0.07)";

  const topInset    = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  // warmth at the current moment (from state, updated by listener) — used for
  // the dot colour in the dropdown trigger
  const warmthForDot = PRESETS[activePreset].warmth;

  return (
    <View style={s.container}>
      <StatusBar hidden />

      {/* ── Background: Animated.View so warmth never causes parent re-render ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: animatedBgColor }]} />

      {/* ── Brightness overlay: pure Animated, zero React re-renders ── */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000", opacity: brightnessOverlay }]}
        pointerEvents="none"
      />

      {/* ── ON/OFF fade overlay ── */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000", opacity: offOverlay }]}
        pointerEvents="none"
      />

      {/* ── Top row ── */}
      <View style={[s.topRow, { paddingTop: topInset + 14 }]}>
        <Pressable
          onPress={handleToggle}
          style={({ pressed }) => [
            s.pill,
            { backgroundColor: pillBg, borderColor: pillBorder, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[s.statusDot, { backgroundColor: isOn ? (isDark ? "#fff" : "#111") : "#555" }]} />
          <Text style={[s.pillLabel, { color: isOn ? (isDark ? "#fff" : "rgba(0,0,0,0.8)") : "rgba(255,255,255,0.45)" }]}>
            {isOn ? "ON" : "OFF"}
          </Text>
        </Pressable>

        {isOn && (
          <Pressable
            onPress={handleCollapseToggle}
            style={({ pressed }) => [
              s.iconPill,
              { backgroundColor: pillBg, borderColor: pillBorder, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather
              name={controlsOpen ? "chevron-down" : "sliders"}
              size={18}
              color={iconColor}
            />
          </Pressable>
        )}
      </View>

      {/* ── Bottom controls (only mounted when on) ── */}
      {isOn && (
        <View style={[s.bottomArea, { paddingBottom: bottomInset + 16 }]}>
          <Animated.View
            style={[
              s.controls,
              {
                backgroundColor: controlsBg,
                borderColor: controlsBorder,
                maxHeight: controlsMaxH,
                opacity: controlsOpacity,
                overflow: "hidden",
              },
            ]}
          >
            <View style={s.inner}>
              {/* Brightness — externalAnim drives overlay directly, zero re-renders */}
              <Slider
                externalAnim={brightnessAnim}
                variant="brightness"
                label="Brightness"
                sublabel={brightnessLabel}
                dark={isDark}
              />

              <View style={[s.divider, { backgroundColor: dividerColor }]} />

              {/* Warmth — externalAnim drives background colour directly, zero re-renders */}
              <Slider
                externalAnim={warmthAnim}
                variant="warmth"
                label="Warmth"
                sublabel={warmthLabel}
                dark={isDark}
              />

              <View style={[s.divider, { backgroundColor: dividerColor }]} />

              {/* Preset — shows nearest preset name (never shows raw Kelvin) */}
              <PresetDropdown
                presets={PRESETS}
                activeIdx={activePreset}
                onSelect={handlePreset}
                dark={isDark}
                warmth={warmthForDot}
              />
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    position: "absolute", top: 0, left: 20, right: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  bottomArea: {
    position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20,
  },
  controls: { borderRadius: 24, borderWidth: 1 },
  inner: { padding: 22, gap: 20 },
  divider: { height: StyleSheet.hairlineWidth },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1,
  },
  iconPill: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  pillLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2 },
});
