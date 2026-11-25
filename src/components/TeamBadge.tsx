import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { fonts, readableOn } from '../theme';
import { AppText } from './AppText';

interface Props {
  name: string;
  shortName: string;
  color: string;
  size?: number;
}

/** Shield crest in the team's colour with its short name: every team gets a logo, no images needed. */
export function TeamBadge({ shortName, color, size = 44, name }: Props) {
  const id = `g${color.replace('#', '')}${size}`;
  const fg = readableOn(color);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${name} crest`} accessible>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0.7} />
          </LinearGradient>
        </Defs>
        <Path d="M24 2.5l18 6v14c0 11.5-7.8 19.6-18 23-10.2-3.4-18-11.5-18-23v-14z" fill={`url(#${id})`} />
        <Path d="M24 6.2l14.6 4.9v11.4c0 9.4-6.3 16.2-14.6 19.2-8.3-3-14.6-9.8-14.6-19.2V11.1z" fill="none" stroke={fg} strokeOpacity={0.35} strokeWidth={1.2} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <AppText
          style={{ fontFamily: fonts.scoreHeavy, fontSize: size * (shortName.length > 3 ? 0.26 : 0.32), lineHeight: size * 0.4, marginTop: -size * 0.04 }}
          color={fg}
          allowFontScaling={false}>
          {shortName}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
