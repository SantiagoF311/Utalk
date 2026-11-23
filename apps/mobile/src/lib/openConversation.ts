// La conversación que está en pantalla: sus mensajes nuevos no se avisan
// (ni push con la app abierta ni aviso del navegador), porque ya se ven.
// La marca la pantalla de la conversación mientras tiene el foco.
let openConversationId: string | null = null;

export function setOpenConversation(conversationId: string | null): void {
  openConversationId = conversationId;
}

export function isConversationOpen(conversationId: string): boolean {
  return openConversationId === conversationId;
}
