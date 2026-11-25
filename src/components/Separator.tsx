import React from 'react';
import { View } from 'react-native';
import { spacing } from '../theme';

/** List gap used as FlatList ItemSeparatorComponent (stable component identity). */
export function GapSm() {
  return <View style={{ height: spacing.sm }} />;
}

export function GapXs() {
  return <View style={{ height: spacing.xs }} />;
}
