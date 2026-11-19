import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

// Íconos de la app por nombre propio: cada uno con su SF Symbol (iOS) y su
// Material Symbol (Android y web). Sin la clave `web`, en el navegador no se
// ve nada (ver docs/mobile.md).
const ICONS = {
  menu: { ios: 'line.3.horizontal', android: 'menu', web: 'menu' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  chevronUp: { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  home: { ios: 'house', android: 'home', web: 'home' },
  communities: { ios: 'person.3', android: 'groups', web: 'groups' },
  chats: { ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' },
  profile: { ios: 'person', android: 'person', web: 'person' },
  compose: { ios: 'pencil', android: 'edit', web: 'edit' },
  popular: { ios: 'arrow.up.right.circle', android: 'trending_up', web: 'trending_up' },
  recent: { ios: 'clock', android: 'schedule', web: 'schedule' },
  upvote: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  downvote: { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' },
  comment: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  university: { ios: 'graduationcap', android: 'school', web: 'school' },
  globe: { ios: 'globe', android: 'public', web: 'public' },
  at: { ios: 'at', android: 'alternate_email', web: 'alternate_email' },
  shield: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  bubble: { ios: 'bubble.left.fill', android: 'chat_bubble', web: 'chat_bubble' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  reply: { ios: 'arrowshape.turn.up.left', android: 'reply', web: 'reply' },
  send: { ios: 'paperplane.fill', android: 'send', web: 'send' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  preview: { ios: 'eye', android: 'visibility', web: 'visibility' },
  hidden: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  flag: { ios: 'flag', android: 'flag', web: 'flag' },
  checkCircle: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  // El relojito de un mensaje que todavía no confirmó el servidor.
  pending: { ios: 'clock', android: 'schedule', web: 'schedule' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  themeSystem: { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  themeLight: { ios: 'sun.max', android: 'light_mode', web: 'light_mode' },
  themeDark: { ios: 'moon', android: 'dark_mode', web: 'dark_mode' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color?: ThemeColor;
};

export function Icon({ name, size = 22, color = 'text' }: IconProps) {
  const theme = useTheme();
  return <SymbolView name={ICONS[name]} size={size} tintColor={theme[color]} />;
}
