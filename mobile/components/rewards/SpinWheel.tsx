// Built by Anointed Coder.
//
// Native casino spin wheel, the mobile mirror of the website's
// components/site/SpinWheel.tsx. Same geometry (gold rim + bulbs,
// coloured wedges with radial labels, crimson pointer at 12 o'clock,
// centre SPIN hub) rebuilt with react-native-svg. Rotation is driven by
// a parent `landingIndex` (the server-selected segment): when `spinning`
// flips true the wheel eases through several turns and lands on the
// wedge centre, then fires `onLandingComplete`. Reduced-motion snaps
// instead of animating.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  Polygon,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/lib/theme';

export interface SpinWheelSegment {
  id: string;
  label: string;
  color: string;
}

export interface SpinWheelProps {
  segments: SpinWheelSegment[];
  spinning: boolean;
  landingIndex: number | null;
  onLandingComplete?: () => void;
  onSpinPress?: () => void;
  size?: number;
  centerLabel?: string;
  disabled?: boolean;
}

const BULB_COUNT = 24;
const FULL_TURNS = 6;
const SPIN_MS = 4600;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function SpinWheel({
  segments,
  spinning,
  landingIndex,
  onLandingComplete,
  onSpinPress,
  size = 300,
  centerLabel,
  disabled,
}: SpinWheelProps) {
  const rotation = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  const count = segments.length;
  const sliceDeg = count > 0 ? 360 / count : 0;

  // Landing math mirrors the web: pointer sits at 12 o'clock, so rotate
  // forward by full turns plus the offset that brings the target wedge
  // centre under the pointer. We always add onto the current rotation so
  // the wheel only ever turns forward.
  useEffect(() => {
    if (!spinning || landingIndex == null || count === 0) return;
    const wedgeCentre = landingIndex * sliceDeg + sliceDeg / 2;
    const current = rotation.value;
    const target = Math.ceil(current / 360) * 360 + FULL_TURNS * 360 + (360 - wedgeCentre);
    if (reduceMotion) {
      rotation.value = target;
      if (onLandingComplete) {
        const id = setTimeout(() => onLandingComplete(), 60);
        return () => clearTimeout(id);
      }
      return;
    }
    rotation.value = withTiming(
      target,
      { duration: SPIN_MS, easing: Easing.bezier(0.17, 0.67, 0.32, 1) },
      (finished) => {
        'worklet';
        if (finished && onLandingComplete) runOnJS(onLandingComplete)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, landingIndex, count, sliceDeg, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const center = size / 2;
  const bulbR = center - 8;
  const bodySize = size - 44;
  const bodyR = bodySize / 2;
  const wheelR = bodyR - 4;
  const labelR = wheelR * 0.62;
  const hubR = (wheelR - 14) / 4;
  const HUB = 84;

  const bulbs = useMemo(() => {
    const arr: Array<{ cx: number; cy: number; gold: boolean }> = [];
    for (let i = 0; i < BULB_COUNT; i += 1) {
      const p = polar(center, center, bulbR, (i / BULB_COUNT) * 360);
      arr.push({ cx: p.x, cy: p.y, gold: i % 2 === 0 });
    }
    return arr;
  }, [center, bulbR]);

  const empty = count === 0;
  const fontSize = Math.max(11, Math.min(15, bodySize / 22));

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center"
      accessible={false}
      accessibilityLabel="Spin wheel"
    >
      {/* Static gold rim + bulbs */}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="rim" cx="50%" cy="50%" r="50%">
            <Stop offset="80%" stopColor="#7A4F00" />
            <Stop offset="90%" stopColor="#F5B400" />
            <Stop offset="100%" stopColor="#3A1F00" />
          </RadialGradient>
        </Defs>
        <Circle cx={center} cy={center} r={center - 4} fill="url(#rim)" />
        {bulbs.map((b, i) => (
          <Circle key={i} cx={b.cx} cy={b.cy} r={4} fill={b.gold ? '#FFE9A8' : '#FFFFFF'} />
        ))}
      </Svg>

      {/* Rotating wheel body */}
      <Animated.View style={[{ width: bodySize, height: bodySize }, animStyle]}>
        <Svg width={bodySize} height={bodySize} viewBox={`0 0 ${bodySize} ${bodySize}`}>
          <Defs>
            <RadialGradient id="hub" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFE066" />
              <Stop offset="60%" stopColor="#F5B400" />
              <Stop offset="100%" stopColor="#7A4F00" />
            </RadialGradient>
          </Defs>
          {empty ? (
            <Circle cx={bodyR} cy={bodyR} r={bodyR - 4} fill="#1F2937" />
          ) : (
            segments.map((s, i) => {
              const startDeg = i * sliceDeg;
              const endDeg = startDeg + sliceDeg;
              const path = wedgePath(bodyR, bodyR, wheelR, startDeg, endDeg);
              const lp = polar(bodyR, bodyR, labelR, startDeg + sliceDeg / 2);
              const short = s.label.length > 10 ? `${s.label.slice(0, 9)}…` : s.label;
              return (
                <G key={s.id}>
                  <Path d={path} fill={s.color} stroke="rgba(0,0,0,0.18)" strokeWidth={1.2} />
                  <G rotation={startDeg + sliceDeg / 2} originX={lp.x} originY={lp.y}>
                    <SvgText
                      x={lp.x}
                      y={lp.y}
                      fill="#FFFFFF"
                      // Thin dark outline stands in for the web's text-shadow
                      // so white labels stay legible on light-gold wedges.
                      stroke="rgba(0,0,0,0.55)"
                      strokeWidth={0.6}
                      fontSize={fontSize}
                      fontWeight="800"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                    >
                      {short}
                    </SvgText>
                  </G>
                </G>
              );
            })
          )}
          <Circle cx={bodyR} cy={bodyR} r={hubR} fill="url(#hub)" stroke="#7A4F00" strokeWidth={2} />
        </Svg>
      </Animated.View>

      {/* Crimson pointer at 12 o'clock */}
      <Svg
        width={34}
        height={40}
        viewBox="0 0 36 42"
        style={{ position: 'absolute', top: -4 }}
      >
        <Defs>
          <RadialGradient id="ptr" cx="50%" cy="20%" r="90%">
            <Stop offset="0%" stopColor="#FF5A5A" />
            <Stop offset="100%" stopColor="#8B0000" />
          </RadialGradient>
        </Defs>
        <Polygon points="18,40 4,4 32,4" fill="url(#ptr)" stroke="#3A0000" strokeWidth={1.5} />
        <Circle cx={18} cy={10} r={5} fill="#FFD2D2" stroke="#8B0000" strokeWidth={1} />
      </Svg>

      {/* Centre SPIN hub button (does not rotate) */}
      <Pressable
        onPress={onSpinPress}
        disabled={disabled || empty || spinning}
        accessibilityRole="button"
        accessibilityLabel={spinning ? 'Spinning the wheel' : centerLabel ?? 'Spin'}
        accessibilityState={{ disabled: disabled || empty || spinning, busy: spinning }}
        hitSlop={6}
        style={({ pressed }) => ({
          position: 'absolute',
          width: HUB,
          height: HUB,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed && !(disabled || empty || spinning) ? 0.95 : 1 }],
        })}
      >
        <View
          className="items-center justify-center rounded-full border-2"
          style={{
            width: HUB,
            height: HUB,
            borderColor: '#B37F00',
            backgroundColor: disabled || empty || spinning ? colors.gold600 : colors.gold500,
            opacity: disabled || empty || spinning ? 0.85 : 1,
          }}
        >
          <Text style={{ color: '#3A1F00', fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>
            {spinning ? '...' : centerLabel ?? 'SPIN'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
