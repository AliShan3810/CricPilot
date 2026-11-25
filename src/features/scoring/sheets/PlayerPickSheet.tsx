import React, { forwardRef } from 'react';
import { AppBottomSheet, type SheetRef } from '../../../components/AppBottomSheet';
import { OptionRow } from '../../../components/Controls';
import { AppText } from '../../../components/AppText';

export interface PickOption {
  id: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  options: PickOption[];
  onPick: (id: string) => void;
  required?: boolean;
  testID?: string;
  emptyText?: string;
  footer?: React.ReactNode;
}

/** List picker used for the next batter, the next bowler, fielders and similar choices. */
export const PlayerPickSheet = forwardRef<SheetRef, Props>(function PlayerPickSheetImpl({ title, subtitle, options, onPick, required, testID, emptyText, footer }, ref) {
  return (
    <AppBottomSheet ref={ref} title={title} subtitle={subtitle} required={required} snapPoints={['75%']} testID={testID} footer={footer}>
      {options.length === 0 ? (
        <AppText variant="body" tone="secondary">
          {emptyText ?? 'No players available.'}
        </AppText>
      ) : null}
      {options.map(o => (
        <OptionRow key={o.id} testID={`pick-${o.title}`} title={o.title} subtitle={o.subtitle} disabled={o.disabled} onPress={() => onPick(o.id)} />
      ))}
    </AppBottomSheet>
  );
});
