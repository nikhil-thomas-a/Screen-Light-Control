import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types & Constants ──────────────────────────────────────────────────────

type ColorPreset = { label: string; warmth: number };

const PRESETS: ColorPreset[] = [
  { label: "Cool White", warmth: 0 },
  { label: "Daylight", warmth: 0.3 },
  { label: "Neutral", warmth: 0.5 },
  { label: "Warm White", warmth: 0.75 },
  { label: "Candle", warmth: 1.0 },
];

// ─── Color Math ─────────────────────────────────────────────────────────────

function interpolateColor(warmth: number, brightness: number): string {
  const coolR = 200, coolG = 220, coolB = 255;
  const warmR = 255, warmG = 200, warmB = 120;
  const r = Math.round(coolR + (warmR - coolR) * warmth);
  const g = Math.round(coolG + (warmG - coolG) * warmth);
  const b = Math.round(coolB + (warmB - coolB) * warmth);
  const f = 0.1 + brightness * 0.9;
  return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
}

function warmthToKelvin(warmth: number): string {
  const k = Math.round(6500 - warmth * (6500 - 2700));
  return `${k}K`;
}

// ─── Smooth Slider ───────────────────────────────────────────────────────────
// Uses Animated.Value internally so the thumb moves with zero flicker.
// React.memo prevents re-renders from parent state changes.

type SliderProps = {
  value: number;
  onChange: (v: number) => void;
  trackColorFilled: string;
  trackColorEmpty: string;
  label: string;
  sublabel: string;
  dark: boolean;
};

const Slider = memo(function Slider({
  value,
  onChange,
  trackColorFilled,
  trackColorEmpty,
  label,
  sublabel,
  dark,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const animValue = useRef(new Animated.Value(value)).current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const trackWidthRef = useRef(0);

  // Sync animated value when parent pushes a new value (e.g. preset tap)
  const lastExternalValue = useRef(value);
  useEffect(() => {
    if (Math.abs(value - lastExternalValue.current) > 0.001) {
      lastExternalValue.current = value;
      Animated.timing(animValue, {
        toValue: value,
        duration: 200,
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
        const clamped = Math.max(0, Math.min(1, evt.nativeEvent.locationX / trackWidthRef.current));
        lastExternalValue.current = clamped;
        animValue.setValue(clamped);
        onChangeRef.current(clamped);
      },
      onPanResponderMove: (evt) => {
        if (trackWidthRef.current <= 0) return;
        const clamped = Math.max(0, Math.min(1, evt.nativeEvent.locationX / trackWidthRef.current));
        lastExternalValue.current = clamped;
        animValue.setValue(clamped);
        onChangeRef.current(clamped);
      },
    })
  ).current;

  const labelColor = dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
  const sublabelColor = dark ? "#fff" : "rgba(0,0,0,0.85)";
  const thumbBorderColor = dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)";

  const thumbSize = 28;
  const filledWidth = animValue.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  // Thumb travels from 0 to (trackWidth - thumbSize)
  const thumbTravel = Math.max(0, trackWidth - thumbSize);
  const thumbLeft = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, thumbTravel] });

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
        {/* Empty track */}
        <View style={[sliderStyles.track, { backgroundColor: trackColorEmpty }]} />
        {/* Filled portion */}
        <Animated.View
          style={[
            sliderStyles.trackFilled,
            { width: filledWidth, backgroundColor: trackColorFilled },
          ]}
        />
        {/* Thumb */}
        <Animated.View
          style={[
            sliderStyles.thumb,
            {
              left: thumbLeft,
              borderColor: thumbBorderColor,
            },
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
    height: 28,
    justifyContent: "center",
    position: "relative",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
  },
  trackFilled: {
    position: "absolute",
    left: 0,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
  },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
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

function PresetDropdown({ presets, activeIdx, onSelect, dark, warmth }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const activeLabel = activeIdx !== null ? presets[activeIdx].label : warmthToKelvin(warmth);
  const textColor = dark ? "#fff" : "rgba(0,0,0,0.85)";
  const bgColor = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const modalBg = dark ? "rgba(20,20,20,0.97)" : "rgba(250,250,250,0.97)";
  const separatorColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={({ pressed }) => [
          dropdownStyles.trigger,
          {
            backgroundColor: bgColor,
            borderColor,
            opacity: pressed ? 0.75 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={dropdownStyles.triggerLeft}>
          <View
            style={[
              dropdownStyles.colorDot,
              { backgroundColor: interpolateColor(warmth, 0.85) },
            ]}
          />
          <Text style={[dropdownStyles.triggerLabel, { color: textColor }]}>
            {activeLabel}
          </Text>
        </View>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={dropdownStyles.overlay} onPress={() => setOpen(false)}>
          <View
            style={[
              dropdownStyles.sheet,
              { backgroundColor: modalBg, paddingBottom: bottomInset + 16 },
            ]}
          >
            <View style={[dropdownStyles.sheetHandle, { backgroundColor: separatorColor }]} />
            <Text style={[dropdownStyles.sheetTitle, { color: textColor }]}>
              Colour Temperature
            </Text>
            <ScrollView scrollEnabled={false}>
              {presets.map((preset, idx) => {
                const isActive = activeIdx === idx;
                const dotColor = interpolateColor(preset.warmth, 0.85);
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      onSelect(idx, preset);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      dropdownStyles.option,
                      {
                        borderTopColor: separatorColor,
                        borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                        opacity: pressed ? 0.65 : 1,
                        backgroundColor: isActive
                          ? dark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(0,0,0,0.05)"
                          : "transparent",
                      },
                    ]}
                  >
                    <View style={dropdownStyles.optionLeft}>
                      <View style={[dropdownStyles.optionDot, { backgroundColor: dotColor }]} />
                      <View>
                        <Text style={[dropdownStyles.optionLabel, { color: textColor }]}>
                          {preset.label}
                        </Text>
                        <Text style={[dropdownStyles.optionSub, { color: dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }]}>
                          {warmthToKelvin(preset.warmth)}
                        </Text>
                      </View>
                    </View>
                    {isActive && (
                      <Feather
                        name="check"
                        size={18}
                        color={dark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)"}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const dropdownStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  triggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  triggerLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    opacity: 0.5,
    paddingHorizontal: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  optionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  optionLabel: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  optionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ScreenLight() {
  const insets = useSafeAreaInsets();
  const [brightness, setBrightness] = useState(1.0);
  const [warmth, setWarmth] = useState(0.45);
  const [isOn, setIsOn] = useState(true);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);

  // Animated collapse
  const collapseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: controlsOpen ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [controlsOpen, collapseAnim]);

  const screenColor = isOn ? interpolateColor(warmth, brightness) : "#000";
  const isDark = !isOn || brightness < 0.4;

  const handleBrightnessChange = useCallback((v: number) => {
    setBrightness(v);
  }, []);

  const handleWarmthChange = useCallback((v: number) => {
    setWarmth(v);
    setActivePreset(null);
  }, []);

  const handlePreset = useCallback((idx: number, preset: ColorPreset) => {
    setWarmth(preset.warmth);
    setActivePreset(idx);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOn((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleCollapseToggle = useCallback(() => {
    setControlsOpen((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const uiTextColor = isDark ? "#fff" : "rgba(0,0,0,0.85)";
  const controlsBg = isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)";
  const controlsBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const iconColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";

  const brightnessTrackFilled = isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)";
  const brightnessTrackEmpty = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const controlsMaxHeight = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });
  const controlsOpacity = collapseAnim;

  return (
    <View style={[styles.container, { backgroundColor: screenColor }]}>
      <StatusBar hidden />

      {/* Dark overlay when off */}
      {!isOn && <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000" }]} />}

      {/* Top controls row */}
      <View style={[styles.topRow, { paddingTop: topInset + 16 }]}>
        <Pressable
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
              borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)",
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: isOn ? (isDark ? "#fff" : "#111") : "#555" },
            ]}
          />
          <Text style={[styles.pillLabel, { color: isOn ? uiTextColor : "rgba(255,255,255,0.5)" }]}>
            {isOn ? "ON" : "OFF"}
          </Text>
        </Pressable>

        {isOn && (
          <Pressable
            onPress={handleCollapseToggle}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)",
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Feather
              name={controlsOpen ? "sliders" : "sliders"}
              size={16}
              color={iconColor}
            />
            <Feather
              name={controlsOpen ? "chevron-down" : "chevron-up"}
              size={14}
              color={iconColor}
            />
          </Pressable>
        )}
      </View>

      {/* Bottom controls panel */}
      {isOn && (
        <View style={[styles.bottomArea, { paddingBottom: bottomInset + 20 }]}>
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
              <Slider
                value={brightness}
                onChange={handleBrightnessChange}
                trackColorFilled={brightnessTrackFilled}
                trackColorEmpty={brightnessTrackEmpty}
                label="Brightness"
                sublabel={`${Math.round(brightness * 100)}%`}
                dark={isDark}
              />

              <View style={[styles.divider, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]} />

              <Slider
                value={warmth}
                onChange={handleWarmthChange}
                trackColorFilled="#F5A623"
                trackColorEmpty={isDark ? "#7EC8E3" : "#A8DAEF"}
                label="Warmth"
                sublabel={warmthToKelvin(warmth)}
                dark={isDark}
              />

              <View style={[styles.divider, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]} />

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
  container: {
    flex: 1,
  },
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
    padding: 24,
    gap: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
});
