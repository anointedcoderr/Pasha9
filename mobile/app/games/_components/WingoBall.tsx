// Built by Anointed Coder.
//
// WingoBall: a glossy 3D numbered ball rendered with react-native-svg. It
// mirrors the web WinGo colour identity so the mobile board reads as the
// same premium system:
//   0 = red + violet (split)   5 = green + violet (split)
//   1,3,7,9 = green            2,4,6,8 = red
// Solid digits use a spherical radial gradient; the two split digits use a
// diagonal two-tone. Both get a dark edge vignette (volume), a top gloss
// highlight and a coloured rim so they look like wet glass marbles.
//
// Lives in a `_components` folder so expo-router never treats it as a route.

import { useId } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

export type WingoColorId = 'red' | 'green' | 'red_violet' | 'green_violet';

interface Material {
  hi: string; // brightest catch-light
  mid: string; // the true saturated colour
  lo: string; // deep base shadow
  rim: string; // hairline rim
}

const MAT: Record<'green' | 'red' | 'violet', Material> = {
  green: { hi: '#5cf3bf', mid: '#13c98d', lo: '#054f34', rim: 'rgba(126,255,210,0.7)' },
  red: { hi: '#ff8090', mid: '#ec394d', lo: '#6f0c1c', rim: 'rgba(255,146,162,0.65)' },
  violet: { hi: '#d29bff', mid: '#a855f7', lo: '#4f1687', rim: 'rgba(214,168,255,0.7)' },
};

/** Colour identity of a drawn digit, in lockstep with the web paytable. */
export function colorOf(n: number): WingoColorId {
  if (n === 0) return 'red_violet';
  if (n === 5) return 'green_violet';
  return n % 2 === 0 ? 'red' : 'green';
}

/** Big (5-9) vs Small (0-4). */
export function sizeOf(n: number): 'big' | 'small' {
  return n >= 5 ? 'big' : 'small';
}

export interface WingoBallProps {
  n: number;
  /** Diameter in px (default 54). */
  size?: number;
  selected?: boolean;
  onPress?: () => void;
}

export function WingoBall({ n, size = 54, selected = false, onPress }: WingoBallProps) {
  const gid = 'wg' + useId().replace(/:/g, '');
  const id = colorOf(n);
  const solid = id === 'red' || id === 'green';
  const primary = id === 'green' || id === 'green_violet' ? MAT.green : MAT.red;
  const v = MAT.violet;
  const rim = solid ? primary.rim : v.rim;

  const r = size / 2;
  const rr = r - (selected ? 1.5 : 1);

  const face = (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          {solid ? (
            <RadialGradient id={`${gid}b`} cx="38%" cy="30%" r="72%">
              <Stop offset="0" stopColor={primary.hi} />
              <Stop offset="0.45" stopColor={primary.mid} />
              <Stop offset="1" stopColor={primary.lo} />
            </RadialGradient>
          ) : (
            <LinearGradient id={`${gid}b`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={primary.hi} />
              <Stop offset="0.3" stopColor={primary.mid} />
              <Stop offset="0.49" stopColor={primary.lo} />
              <Stop offset="0.51" stopColor={v.lo} />
              <Stop offset="0.7" stopColor={v.mid} />
              <Stop offset="1" stopColor={v.hi} />
            </LinearGradient>
          )}
          <RadialGradient id={`${gid}v`} cx="40%" cy="32%" r="78%">
            <Stop offset="0.5" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.45" />
          </RadialGradient>
          <RadialGradient id={`${gid}g`} cx="50%" cy="14%" r="55%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={rr} fill={`url(#${gid}b)`} />
        <Circle cx={r} cy={r} r={rr} fill={`url(#${gid}v)`} />
        <Ellipse cx={r} cy={size * 0.24} rx={size * 0.3} ry={size * 0.16} fill={`url(#${gid}g)`} />
        <Circle cx={r} cy={r} r={rr} fill="none" stroke={selected ? '#FFD54F' : rim} strokeWidth={selected ? 2 : 1} />
      </Svg>
      <Text
        style={{
          fontSize: Math.round(size * 0.44),
          color: '#ffffff',
          fontWeight: '900',
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {n}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-80" hitSlop={2}>
        {face}
      </Pressable>
    );
  }
  return face;
}
