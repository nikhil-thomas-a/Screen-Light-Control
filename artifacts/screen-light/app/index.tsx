import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

// warmth 0 = warm/candle (2700K, orange) — left
// warmth 1 = cool/daylight (6500K, blue) — right
const PRESETS: ColorPreset[] = [
  { label: "Candle", warmth: 0 },
  { label: "Warm White", warmth: 0.25 },
  { label: "Neutral", warmth: 0.5 },
  { label: "Daylight", warmth: 0.75 },
  { label: "Cool White", warmth: 1.0 },
];

// ─── Color Math ─────────────────────────────────────────────────────────────

// warmth=0 → warm orange (2700K candle)
// warmth=1 → cool blue-white (6500K daylight)
// Brightness is handled separately via an animated overlay — NOT here.
function screenBaseColor(warmth: number): string {
  const wR = 255, wG = 197, wB = 108; // candle/warm
  const cR = 210, cG = 228, cB = 255; // cool white
  const r = Math.round(wR + (cR - wR) * warmth);
  const g = Math.round(wG + (cG - wG) * warmth);
  const b = Math.round(wB + (cB - wB) * warmth);
  return `rgb(${r},${g},${b})`;
}

// Used for dots/swatches only (includes a slight dimming)
function previewColor(warmth: number): string {
  const wR = 255, wG = 180, wB = 80;
  const cR = 160, cG = 200, cB = 255;
  const r = Math.round(wR + (cR - wR) * warmth);
  const g = Math.round(wG + (cG - wG) * warmth);
  const b = Math.round(wB + (cB - wB) * warmth);
  return `rgb(${r},${g},${b})`;
}

// warmth=0 → 2700K, warmth=1 → 6500K
function warmthToKelvin(warmth: number): string {
  const k = Math.round(2700 + warmth * (6500 - 2700));
  return `${k}K`;
}

// ─── Slider ──────────────────────────────────────────────────────────────────
// - externalAnim: when provided, the slider drives this value directly.
//   onChange is NOT called. Use this for zero-flicker sliders (brightness).
// - Without externalAnim: drives internal anim and calls onChange.

type SliderProps = {
  value: number;
  onChange?: (v: number) => void;
  externalAnim?: Animated.Value;
  label: string;
  sublabel: string;
  dark: boolean;
  trackContent: React.ReactNode; // allows caller to provide gradient or solid fill
};

const Slider = memo(function Slider({
  value,
  onChange,
  externalAnim,
  label,
  sublabel,
  dark,
  trackContent,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  // Use external anim when provided, otherwise internal
  const internalAnim = useRef(new Animated.Value(value)).current;
  const animValue = externalAnim ?? internalAnim;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastExternalValue = useRef(value);

  // Sync when parent pushes a new value (preset taps, etc.)
  useEffect(() => {
    if (Math.abs(value - lastExternalValue.current) > 0.001) {
      lastExternalValue.current = value;
      Animated.timing(animValue, {
        toValue: value,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    }
  }, [value, animValue]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (trackWidthRef.current <= 0) return;
        const v = Math.max(0, Math.min(1, evt.nativeEvent.locationX / trackWidthRef.current));
        lastExternalValue.current = v;
        animValue.setValue(v);
        onChangeRef.current?.(v);
      },
      onPanResponderMove: (evt) => {
        if (trackWidthRef.current <= 0) return;
        const v = Math.max(0, Math.min(1, evt.nativeEvent.locationX / trackWidthRef.current));
        lastExternalValue.current = v;
        animValue.setValue(v);
        onChangeRef.current?.(v);
      },
    })
  ).current;

  const labelColor = dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)";
  const sublabelColor = dark ? "#fff" : "rgba(0,0,0,0.85)";
  const thumbBorderColor = dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.1)";

  const THUMB = 30;
  const thumbTravel = Math.max(0, trackWidth - THUMB);
  const thumbLeft = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbTravel],
  });

  return (
    <View style={sliderStyles.wrapper}>
      <View style={sliderStyles.row}>
        <Text style={[sliderStyles.label, { color: labelColor }]}>{label}</Text>
        <Text style={[sliderStyles.sublabel, { color: sublabelColor }]}>{sublabel}</Text>
      </View>
      <View
        style={sliderStyles.trackOuter}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          trackWidthRef.current = w;
          setTrackWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        {/* Track background (gradient or solid — provided by parent) */}
        <View style={[sliderStyles.trackBg, { overflow: "hidden", borderRadius: 15 }]}>
          {trackContent}
        </View>
        {/* Thumb */}
        <Animated.View
          style={[
            sliderStyles.thumb,
            { left: thumbLeft, borderColor: thumbBorderColor },
          ]}
        />
      </View>
    </View>
  );
});

const sliderStyles = StyleSheet.create({
  wrapper: { gap: 10, width: "100%" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sublabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  trackOuter: {
    height: 30,
    justifyContent: "center",
    position: "relative",
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  thumb: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 2.5,
    top: 0,
  } as any,
});

// ─── Preset Dropdown ─────────────────────────────────────────────────────────

type DropdownProps = {
  presets: ColorPreset[];
  activeIdx: number | null;
  onSelect: (idx: number, preset: ColorPreset) => void;
  dark: boolean;
  warmth: number;
};

const PresetDropdown = memo(function PresetDropdown({
  presets,
  activeIdx,
  onSelect,
  dark,
  warmth,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const activeLabel = activeIdx !== null ? presets[activeIdx].label : warmthToKelvin(warmth);
  const textColor = dark ? "#fff" : "rgba(0,0,0,0.85)";
  const bgColor = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)";
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)";
  const modalBg = dark ? "#141414" : "#fafafa";
  const sepColor = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={({ pressed }) => [
          ddStyles.trigger,
          {
            backgroundColor: bgColor,
            borderColor,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <View style={ddStyles.triggerLeft}>
          <View style={[ddStyles.dot, { backgroundColor: previewColor(warmth) }]} />
          <Text style={[ddStyles.triggerLabel, { color: textColor }]}>{activeLabel}</Text>
        </View>
        <Feather
          name="chevron-down"
          size={16}
          color={dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)"}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={ddStyles.overlay} onPress={() => setOpen(false)}>
          <View
            style={[ddStyles.sheet, { backgroundColor: modalBg, paddingBottom: bottomInset + 12 }]}
          >
            <View style={[ddStyles.handle, { backgroundColor: sepColor }]} />
            <Text style={[ddStyles.sheetTitle, { color: dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }]}>
              Colour Temperature
            </Text>
            {presets.map((preset, idx) => {
              const isActive = activeIdx === idx;
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => { onSelect(idx, preset); setOpen(false); }}
                  style={({ pressed }) => [
                    ddStyles.option,
                    {
                      borderTopColor: sepColor,
                      borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                      backgroundColor: isActive
                        ? dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)"
                        : "transparent",
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <View style={ddStyles.optionLeft}>
                    <View style={[ddStyles.optionDot, { backgroundColor: previewColor(preset.warmth) }]} />
                    <View>
                      <Text style={[ddStyles.optionLabel, { color: textColor }]}>{preset.label}</Text>
                      <Text style={[ddStyles.optionSub, { color: dark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.33)" }]}>
                        {warmthToKelvin(preset.warmth)}
                      </Text>
                    </View>
                  </View>
                  {isActive && (
                    <Feather name="check" size={18} color={dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)"} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
});

const ddStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  triggerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  triggerLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  optionDot: { width: 20, height: 20, borderRadius: 10 },
  optionLabel: { fontSize: 16, fontFamily: "Inter_500Medium" },
  optionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ScreenLight() {
  const insets = useSafeAreaInsets();

  // warmth: 0=warm/candle, 1=cool/daylight
  const [warmth, setWarmth] = useState(0.25); // matches Warm White preset
  const [isOn, setIsOn] = useState(true);
  const [activePreset, setActivePreset] = useState<number | null>(1); // Warm White default
  const [controlsOpen, setControlsOpen] = useState(true);

  // Brightness: driven by Animated.Value only — never goes through React state
  // to avoid re-rendering the screen on every drag frame
  const brightnessAnim = useRef(new Animated.Value(1.0)).current;
  const [brightnessLabel, setBrightnessLabel] = useState("100%");
  const [isDimmed, setIsDimmed] = useState(false); // for UI theme only
  const lastLabelTime = useRef(0);

  useEffect(() => {
    const id = brightnessAnim.addListener(({ value }) => {
      const now = Date.now();
      if (now - lastLabelTime.current > 80) {
        lastLabelTime.current = now;
        setBrightnessLabel(`${Math.round(value * 100)}%`);
        setIsDimmed(value < 0.35);
      }
    });
    return () => brightnessAnim.removeListener(id);
  }, [brightnessAnim]);

  // Animated collapse for controls panel
  const collapseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: controlsOpen ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [controlsOpen, collapseAnim]);

  // Animated on/off
  const onOffAnim = useRef(new Animated.Value(1)).current;
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

  const handleWarmthChange = useCallback((v: number) => {
    setWarmth(v);
    setActivePreset(null);
  }, []);

  const handlePreset = useCallback((idx: number, preset: ColorPreset) => {
    setWarmth(preset.warmth);
    setActivePreset(idx);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCollapseToggle = useCallback(() => {
    setControlsOpen((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const baseColor = isOn ? screenBaseColor(warmth) : "#000";
  const isDark = !isOn || isDimmed;

  const controlsBg = isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)";
  const controlsBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const iconColor = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.45)";
  const pillBg = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)";
  const pillBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.09)";

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  // Brightness overlay: black layer controlled by brightnessAnim (0=full bright → 0% black, 1=off-bright → 95% black)
  const brightnessOverlay = brightnessAnim.interpolate({
    inputRange: [0.05, 1],
    outputRange: [0.95, 0],
  });

  // On/off combined with brightness overlay
  const overlayOpacity = Animated.multiply(
    onOffAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    onOffAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) // placeholder
  );
  // Simpler: just use a separate overlay for on/off fade
  const offOverlayOpacity = onOffAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const controlsMaxHeight = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 420] });
  const controlsOpacity = collapseAnim;

  // Brightness slider track: dark-to-light gradient
  const brightnessTrack = (
    <LinearGradient
      colors={isDark ? ["#111", "#fff"] : ["rgba(0,0,0,0.15)", "rgba(0,0,0,0.7)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );

  // Warmth slider track: warm orange → cool blue (fixed gradient, thumb moves over it)
  const warmthTrack = (
    <LinearGradient
      colors={["#F5A025", "#FFD080", "#fff8ee", "#ddeeff", "#A8C8FF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: baseColor }]}>
      <StatusBar hidden />

      {/* Brightness overlay — driven by Animated.Value, zero React re-renders */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000", opacity: brightnessOverlay }]}
        pointerEvents="none"
      />
      {/* ON/OFF fade overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000", opacity: offOverlayOpacity }]}
        pointerEvents="none"
      />

      {/* Top row */}
      <View style={[styles.topRow, { paddingTop: topInset + 14 }]}>
        {/* ON/OFF pill */}
        <Pressable
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.pill,
            { backgroundColor: pillBg, borderColor: pillBorder, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: isOn ? (isDark ? "#fff" : "#111") : "#555" }]} />
          <Text style={[styles.pillLabel, { color: isOn ? (isDark ? "#fff" : "rgba(0,0,0,0.8)") : "rgba(255,255,255,0.45)" }]}>
            {isOn ? "ON" : "OFF"}
          </Text>
        </Pressable>

        {/* Collapse toggle — single clear icon */}
        {isOn && (
          <Pressable
            onPress={handleCollapseToggle}
            style={({ pressed }) => [
              styles.iconPill,
              { backgroundColor: pillBg, borderColor: pillBorder, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather
              name={controlsOpen ? "eye-off" : "sliders"}
              size={17}
              color={iconColor}
            />
          </Pressable>
        )}
      </View>

      {/* Bottom controls */}
      {isOn && (
        <View style={[styles.bottomArea, { paddingBottom: bottomInset + 16 }]}>
          <Animated.View
            style={[
              styles.controls,
              {
                backgroundColor: controlsBg,
                borderColor: controlsBorder,
                maxHeight: controlsMaxHeight,
                opacity: controlsOpacity,
                overflow: "hidden",
              },
            ]}
          >
            <View style={styles.controlsInner}>
              {/* Brightness — uses externalAnim, zero parent re-renders on drag */}
              <Slider
                value={1.0}
                externalAnim={brightnessAnim}
                label="Brightness"
                sublabel={brightnessLabel}
                dark={isDark}
                trackContent={brightnessTrack}
              />

              <View style={[styles.divider, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }]} />

              {/* Warmth — state-based (warmth changes are fine) */}
              <Slider
                value={warmth}
                onChange={handleWarmthChange}
                label="Warmth"
                sublabel={warmthToKelvin(warmth)}
                dark={isDark}
                trackContent={warmthTrack}
              />

              <View style={[styles.divider, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }]} />

              <PresetDropdown
                presets={PRESETS}
                activeIdx={activePreset}
                onSelect={handlePreset}
                dark={isDark}
                warmth={warmth}
              />
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  controls: {
    borderRadius: 24,
    borderWidth: 1,
  },
  controlsInner: {
    padding: 22,
    gap: 20,
  },
  divider: { height: StyleSheet.hairlineWidth },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  iconPill: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  pillLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
});
