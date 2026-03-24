import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ColorPreset = {
  label: string;
  warmth: number;
};

const PRESETS: ColorPreset[] = [
  { label: "Cool", warmth: 0 },
  { label: "Daylight", warmth: 0.3 },
  { label: "Neutral", warmth: 0.5 },
  { label: "Warm", warmth: 0.75 },
  { label: "Candle", warmth: 1.0 },
];

function interpolateColor(warmth: number, brightness: number): string {
  const coolR = 200;
  const coolG = 220;
  const coolB = 255;

  const warmR = 255;
  const warmG = 200;
  const warmB = 120;

  const r = Math.round(coolR + (warmR - coolR) * warmth);
  const g = Math.round(coolG + (warmG - coolG) * warmth);
  const b = Math.round(coolB + (warmB - coolB) * warmth);

  const factor = 0.1 + brightness * 0.9;
  const fr = Math.min(255, Math.round(r * factor));
  const fg = Math.min(255, Math.round(g * factor));
  const fb = Math.min(255, Math.round(b * factor));

  return `rgb(${fr}, ${fg}, ${fb})`;
}

function warmthToKelvin(warmth: number): string {
  const min = 2700;
  const max = 6500;
  const k = Math.round(max - warmth * (max - min));
  return `${k}K`;
}

type SliderProps = {
  value: number;
  onChange: (v: number) => void;
  trackLeft: string;
  trackRight: string;
  thumbColor: string;
  label: string;
  sublabel: string;
  dark: boolean;
};

function Slider({
  value,
  onChange,
  trackLeft,
  trackRight,
  thumbColor,
  label,
  sublabel,
  dark,
}: SliderProps) {
  const trackWidth = useRef(0);
  const currentValue = useRef(value);
  currentValue.current = value;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          const clamped = Math.max(0, Math.min(1, x / trackWidth.current));
          onChange(clamped);
        }
      },
      onPanResponderMove: (evt) => {
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          const clamped = Math.max(0, Math.min(1, x / trackWidth.current));
          onChange(clamped);
        }
      },
    })
  ).current;

  const labelColor = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
  const sublabelColor = dark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
  const thumbBorder = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)";

  return (
    <View style={sliderStyles.wrapper}>
      <View style={sliderStyles.row}>
        <Text style={[sliderStyles.label, { color: labelColor }]}>{label}</Text>
        <Text style={[sliderStyles.sublabel, { color: sublabelColor }]}>
          {sublabel}
        </Text>
      </View>
      <View
        style={sliderStyles.trackOuter}
        onLayout={(e) => {
          trackWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            sliderStyles.track,
            {
              background: undefined,
            },
          ]}
        >
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: "transparent",
              },
            ]}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
              }}
            >
              <View style={{ flex: value, backgroundColor: trackLeft }} />
              <View style={{ flex: 1 - value, backgroundColor: trackRight }} />
            </View>
          </View>
        </View>
        <View
          style={[
            sliderStyles.thumb,
            {
              left: `${value * 100}%` as any,
              backgroundColor: thumbColor,
              borderColor: thumbBorder,
              transform: [{ translateX: -14 }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: {
    gap: 10,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
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
    height: 28,
    borderRadius: 12,
    overflow: "hidden",
    width: "100%",
  },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.25)",
    elevation: 5,
    top: 0,
  } as any,
});

export default function ScreenLight() {
  const insets = useSafeAreaInsets();
  const [brightness, setBrightness] = useState(1.0);
  const [warmth, setWarmth] = useState(0.45);
  const [isOn, setIsOn] = useState(true);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const screenColor = isOn ? interpolateColor(warmth, brightness) : "#000";
  const isDark = !isOn || brightness < 0.4;

  const overlayOpacity = isOn ? 0 : 1;

  const handleBrightnessChange = useCallback(
    (v: number) => {
      setBrightness(v);
      setActivePreset(null);
    },
    []
  );

  const handleWarmthChange = useCallback(
    (v: number) => {
      setWarmth(v);
      setActivePreset(null);
    },
    []
  );

  const handlePreset = useCallback(
    (idx: number, preset: ColorPreset) => {
      setWarmth(preset.warmth);
      setActivePreset(idx);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const handleToggle = useCallback(() => {
    setIsOn((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const uiTextColor = isDark ? "#fff" : "rgba(0,0,0,0.85)";
  const controlsBg = isDark
    ? "rgba(0,0,0,0.45)"
    : "rgba(255,255,255,0.55)";
  const controlsBorder = isDark
    ? "rgba(255,255,255,0.1)"
    : "rgba(0,0,0,0.08)";

  const brightnessTrackLeft = isDark
    ? "rgba(255,255,255,0.7)"
    : "rgba(0,0,0,0.55)";
  const brightnessTrackRight = isDark
    ? "rgba(255,255,255,0.15)"
    : "rgba(0,0,0,0.12)";

  const warmthTrackLeft = "#F5A623";
  const warmthTrackRight = isDark ? "#7EC8E3" : "#A8DAEF";

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: screenColor }]}>
      <StatusBar hidden />

      <View
        style={[
          styles.darkOverlay,
          { opacity: overlayOpacity },
        ]}
      />

      <View
        style={[
          styles.inner,
          {
            paddingTop: topInset + 20,
            paddingBottom: bottomInset + 20,
          },
        ]}
      >
        <View style={[styles.topRow, { paddingTop: topInset + 16 }]}>
          <Pressable
            onPress={handleToggle}
            style={({ pressed }) => [
              styles.toggleButton,
              {
                backgroundColor: isOn
                  ? isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.1)"
                  : "rgba(255,255,255,0.18)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.12)",
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.toggleDot,
                {
                  backgroundColor: isOn
                    ? isDark
                      ? "#fff"
                      : "#111"
                    : "#6c6c6c",
                },
              ]}
            />
            <Text
              style={[
                styles.toggleLabel,
                { color: isOn ? uiTextColor : "rgba(255,255,255,0.6)" },
              ]}
            >
              {isOn ? "ON" : "OFF"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        {isOn && (
          <View
            style={[
              styles.controls,
              {
                backgroundColor: controlsBg,
                borderColor: controlsBorder,
              },
            ]}
          >
            <Slider
              value={brightness}
              onChange={handleBrightnessChange}
              trackLeft={brightnessTrackLeft}
              trackRight={brightnessTrackRight}
              thumbColor="#fff"
              label="Brightness"
              sublabel={`${Math.round(brightness * 100)}%`}
              dark={isDark}
            />

            <View style={styles.divider} />

            <Slider
              value={warmth}
              onChange={handleWarmthChange}
              trackLeft={warmthTrackLeft}
              trackRight={warmthTrackRight}
              thumbColor="#fff"
              label="Warmth"
              sublabel={warmthToKelvin(warmth)}
              dark={isDark}
            />

            <View style={styles.divider} />

            <View style={styles.presets}>
              {PRESETS.map((preset, idx) => {
                const presetColor = interpolateColor(preset.warmth, 0.85);
                const isActive = activePreset === idx;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => handlePreset(idx, preset)}
                    style={({ pressed }) => [
                      styles.presetBtn,
                      {
                        backgroundColor: isActive
                          ? isDark
                            ? "rgba(255,255,255,0.22)"
                            : "rgba(0,0,0,0.16)"
                          : isDark
                          ? "rgba(255,255,255,0.07)"
                          : "rgba(0,0,0,0.06)",
                        borderColor: isActive
                          ? isDark
                            ? "rgba(255,255,255,0.45)"
                            : "rgba(0,0,0,0.3)"
                          : "transparent",
                        opacity: pressed ? 0.7 : 1,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.presetDot,
                        { backgroundColor: presetColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.presetLabel,
                        { color: uiTextColor },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "flex-end",
  },
  topRow: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  spacer: {
    flex: 1,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  } as any,
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
  controls: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 24,
    backdropFilter: "blur(20px)" as any,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  presets: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  presetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: "center",
  },
  presetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  presetLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
