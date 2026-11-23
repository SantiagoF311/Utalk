import type { NotificationLink } from '@utalk/shared';
import { router } from 'expo-router';

// Adónde lleva tocar una notificación (en la lista, en un push o en un aviso
// del navegador). `none` = una publicación tuya eliminada: desde la lista no
// se abre nada; desde un aviso, se abre la lista para que se vea.
export function openNotificationLink(
  link: NotificationLink,
  postId: string,
  from: 'list' | 'alert',
): void {
  switch (link) {
    case 'post':
      router.push({ pathname: '/post/[postId]', params: { postId } });
      return;
    case 'my-reports':
      router.push('/my-reports');
      return;
    case 'none':
      if (from === 'alert') router.push('/notifications');
      return;
  }
}
