import { ConfirmSheet } from '@/components/confirmSheet';
import { useToggleBlock } from '@/hooks/mutations';
import { errorMessage } from '@/lib/errorMessages';

type BlockUserSheetProps = {
  visible: boolean;
  onClose: () => void;
  user: { id: string; username: string };
  onBlocked?: () => void;
};

// Confirmar un bloqueo (desde una conversación o un perfil).
export function BlockUserSheet({ visible, onClose, user, onBlocked }: BlockUserSheetProps) {
  const toggleBlock = useToggleBlock();

  return (
    <ConfirmSheet
      visible={visible}
      onClose={onClose}
      title={`¿Bloquear a u/${user.username}?`}
      description="No va a poder escribirte ni tú a esa persona. La conversación sigue en tus chats y no se entera de que lo bloqueaste. Lo puedes desbloquear desde el chat o desde Ajustes."
      confirmLabel="Sí, bloquear"
      cancelLabel="Volver"
      loading={toggleBlock.isPending}
      errorMessage={toggleBlock.isError ? errorMessage(toggleBlock.error) : null}
      onConfirm={() =>
        toggleBlock.mutate(
          { userId: user.id, block: true },
          {
            onSuccess: () => {
              onClose();
              onBlocked?.();
            },
          },
        )
      }
    />
  );
}
