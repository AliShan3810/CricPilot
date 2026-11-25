import React from 'react';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/** The CricPilot mark (same geometry as src/assets/brand/logo.svg). */
export function BrandMark({ size = 72, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="CricPilot logo">
      <Defs>
        <RadialGradient id="bm-bg" cx="35%" cy="30%" r="100%">
          <Stop offset="0" stopColor="#222B3A" />
          <Stop offset="1" stopColor="#0B1120" />
        </RadialGradient>
        <RadialGradient id="bm-ball" cx="30%" cy="25%" r="85%">
          <Stop offset="0" stopColor="#FFB37A" />
          <Stop offset="1" stopColor="#E85D00" />
        </RadialGradient>
      </Defs>
      {tile ? (
        <>
          <Rect width="100" height="100" rx="22" fill="url(#bm-bg)" />
          <Rect x="3.5" y="3.5" width="93" height="93" rx="19" fill="none" stroke="#FF6B00" strokeOpacity={0.35} strokeWidth={1.2} />
        </>
      ) : null}
      <Circle cx="42" cy="58" r="25" fill="url(#bm-ball)" />
      <Path d="M21.5 49 C29 70 45 80 60 74.5 C72 70 78 44 85.5 20.5" fill="none" stroke="#FFF6EC" strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M88.7 31 L85.5 20.5 L76.9 27.3" fill="none" stroke="#FFF6EC" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
