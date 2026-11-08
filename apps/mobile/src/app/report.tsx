import { useLocalSearchParams } from 'expo-router';

import { ReportScreen } from '@/screens/report';

// /report?postId=… (reportar una publicación) o
// /report?postId=…&commentId=… (un comentario; postId para actualizar su árbol).
export default function Report() {
  const { postId, commentId, author } = useLocalSearchParams<{
    postId: string;
    commentId?: string;
    author?: string;
  }>();
  return (
    <ReportScreen
      target={commentId ? { kind: 'comment', postId, commentId } : { kind: 'post', postId }}
      authorUsername={author}
    />
  );
}
