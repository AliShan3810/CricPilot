import React, { forwardRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { AppBottomSheet, type SheetRef } from '../../../components/AppBottomSheet';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import type { ShotInfo } from '../../../core/engine/types';
import { spacing, useTheme } from '../../../theme';

const SIZE = 260;

interface Props {
  runs: number;
  onSubmit: (shot: ShotInfo | null) => void;
}

/** Tap where the ball went. The angle is measured clockwise from straight down the ground. */
export const ShotSheet = forwardRef<SheetRef, Props>(function ShotSheetImpl({ runs, onSubmit }, ref) {
  const { colors } = useTheme();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const c = SIZE / 2;
  const onTouch = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    setPoint({ x: locationX, y: locationY });
  };
  const toShot = (): ShotInfo | null => {
    if (!point) {
      return null;
    }
    const dx = point.x - c;
    const dy = point.y - (c + 20); // the batter stands just below the centre
    // 0° = straight back past the bowler (up the screen)
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angle < 0) {
      angle += 360;
    }
    const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (c - 4));
    return { angle: Math.round(angle) % 360, distance: Math.round(distance * 100) / 100 };
  };
  return (
    <AppBottomSheet ref={ref} title="Shot direction" subtitle={`${runs} run${runs === 1 ? '' : 's'} · tap where the ball went`} testID="sheet-shot">
      <View style={styles.center}>
        <View onStartShouldSetResponder={() => true} onResponderRelease={onTouch} onResponderGrant={onTouch} testID="shot-field" accessible accessibilityLabel="Field. Tap where the ball went." style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={c} cy={c} r={c - 2} fill="#14532D" stroke="#E2E8F0" strokeWidth={2} />
            <Circle cx={c} cy={c} r={c * 0.55} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeDasharray="4 6" />
            <Rect x={c - 7} y={c - 26} width={14} height={52} fill="#C9A66B" />
            {point ? (
              <>
                <Line x1={c} y1={c + 20} x2={point.x} y2={point.y} stroke={runs >= 6 ? colors.gold : runs === 4 ? colors.primary : '#FFFFFF'} strokeWidth={3} />
                <Circle cx={point.x} cy={point.y} r={6} fill={colors.gold} />
              </>
            ) : null}
          </Svg>
        </View>
        <AppText variant="caption" tone="secondary">
          Bowler’s end at the top
        </AppText>
      </View>
      <View style={styles.row}>
        <Button label="Skip" variant="secondary" onPress={() => onSubmit(null)} style={styles.flex} testID="shot-skip" />
        <Button label="Save shot" onPress={() => onSubmit(toShot())} disabled={!point} style={styles.flex} testID="shot-save" />
      </View>
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
