import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

export type IconName =
  | 'back'
  | 'close'
  | 'plus'
  | 'minus'
  | 'settings'
  | 'undo'
  | 'redo'
  | 'chevronRight'
  | 'chevronDown'
  | 'home'
  | 'bat'
  | 'users'
  | 'trophy'
  | 'chart'
  | 'share'
  | 'download'
  | 'upload'
  | 'edit'
  | 'trash'
  | 'search'
  | 'swap'
  | 'check'
  | 'more'
  | 'play'
  | 'ball'
  | 'flag'
  | 'calendar'
  | 'pin'
  | 'star'
  | 'info'
  | 'moon'
  | 'sun'
  | 'bolt'
  | 'file'
  | 'user'
  | 'list'
  | 'target'
  | 'clock';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Line icons drawn for CricPilot (24×24 grid, round caps). */
export function Icon({ name, size = 22, color, strokeWidth = 2 }: Props) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  const p = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const body = (() => {
    switch (name) {
      case 'back':
        return <Path d="M15 5l-7 7 7 7" {...p} />;
      case 'close':
        return <Path d="M6 6l12 12M18 6L6 18" {...p} />;
      case 'plus':
        return <Path d="M12 5v14M5 12h14" {...p} />;
      case 'minus':
        return <Path d="M5 12h14" {...p} />;
      case 'settings':
        return (
          <>
            <Circle cx="12" cy="12" r="3.2" {...p} />
            <Path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" {...p} />
          </>
        );
      case 'undo':
        return <Path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" {...p} />;
      case 'redo':
        return <Path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13" {...p} />;
      case 'chevronRight':
        return <Path d="M9 5l7 7-7 7" {...p} />;
      case 'chevronDown':
        return <Path d="M5 9l7 7 7-7" {...p} />;
      case 'home':
        return <Path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" {...p} />;
      case 'bat':
        return <Path d="M14.5 3.5l6 6-8.5 8.5a2.5 2.5 0 01-3.5 0l-2.5-2.5a2.5 2.5 0 010-3.5zM6 15l-3 3M3.5 20.5l1-1" {...p} />;
      case 'users':
        return (
          <>
            <Circle cx="9" cy="8" r="3.5" {...p} />
            <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 010 6.4M18 14.4c2.2.7 3.5 2.7 3.5 5.6" {...p} />
          </>
        );
      case 'trophy':
        return <Path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M12 14v4M8 20.5h8M9.5 18h5" {...p} />;
      case 'chart':
        return <Path d="M4 20V10M10 20V4M16 20v-7M21 20H3" {...p} />;
      case 'share':
        return <Path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7.5h14V12" {...p} />;
      case 'download':
        return <Path d="M12 3v12M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...p} />;
      case 'upload':
        return <Path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 19.5h14" {...p} />;
      case 'edit':
        return <Path d="M15.5 4.5l4 4L9 19H5v-4zM13.5 6.5l4 4" {...p} />;
      case 'trash':
        return <Path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" {...p} />;
      case 'search':
        return (
          <>
            <Circle cx="11" cy="11" r="6.5" {...p} />
            <Path d="M16 16l4.5 4.5" {...p} />
          </>
        );
      case 'swap':
        return <Path d="M7 4L3.5 7.5 7 11M3.5 7.5h14M17 13l3.5 3.5L17 20M20.5 16.5h-14" {...p} />;
      case 'check':
        return <Path d="M4.5 12.5l5 5 10-11" {...p} />;
      case 'more':
        return (
          <>
            <Circle cx="5" cy="12" r="1.4" fill={c} />
            <Circle cx="12" cy="12" r="1.4" fill={c} />
            <Circle cx="19" cy="12" r="1.4" fill={c} />
          </>
        );
      case 'play':
        return <Path d="M7 4.5v15l12.5-7.5z" {...p} />;
      case 'ball':
        return (
          <>
            <Circle cx="12" cy="12" r="8.5" {...p} />
            <Path d="M7 5.5c2.5 3.5 2.5 9.5 0 13M17 5.5c-2.5 3.5-2.5 9.5 0 13" {...p} />
          </>
        );
      case 'flag':
        return <Path d="M5 21V4M5 4.5h11l-2 4 2 4H5" {...p} />;
      case 'calendar':
        return (
          <>
            <Rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...p} />
            <Path d="M3.5 10h17M8 3v4M16 3v4" {...p} />
          </>
        );
      case 'pin':
        return (
          <>
            <Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z" {...p} />
            <Circle cx="12" cy="10" r="2.3" {...p} />
          </>
        );
      case 'star':
        return <Path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" {...p} />;
      case 'info':
        return (
          <>
            <Circle cx="12" cy="12" r="9" {...p} />
            <Path d="M12 11v6M12 7.5v.5" {...p} />
          </>
        );
      case 'moon':
        return <Path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" {...p} />;
      case 'sun':
        return (
          <>
            <Circle cx="12" cy="12" r="4" {...p} />
            <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...p} />
          </>
        );
      case 'bolt':
        return <Path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z" {...p} />;
      case 'file':
        return <Path d="M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7" {...p} />;
      case 'user':
        return (
          <>
            <Circle cx="12" cy="8" r="4" {...p} />
            <Path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" {...p} />
          </>
        );
      case 'list':
        return <Path d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5" {...p} />;
      case 'target':
        return (
          <>
            <Circle cx="12" cy="12" r="8.5" {...p} />
            <Circle cx="12" cy="12" r="4.5" {...p} />
            <Circle cx="12" cy="12" r="1" fill={c} />
          </>
        );
      case 'clock':
        return (
          <>
            <Circle cx="12" cy="12" r="8.5" {...p} />
            <Path d="M12 7.5V12l3 2" {...p} />
          </>
        );
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
