import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottomSheet';
import { Button } from '@/components/button';
import { Callout } from '@/components/callout';
import { Spacing } from '@/constants/theme';

type ConfirmSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  errorMessage?: string | null;
  // Detalles de lo que pasa al confirmar (ej. "los 3 comentarios se van con ella").
  children?: ReactNode;
};

// Confirmación de algo que no se deshace (borrar), como el diseño 5b.
export function ConfirmSheet({
  visible,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading,
  errorMessage,
  children,
}: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} description={description}>
      <View style={styles.body}>
        {children}
        {errorMessage && <Callout variant="warning">{errorMessage}</Callout>}
        <Button title={confirmLabel} variant="strong" onPress={onConfirm} loading={loading} />
        <Button title={cancelLabel} variant="ghost" onPress={onClose} disabled={loading} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
});
