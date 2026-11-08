// Sin tildes ni mayúsculas: "matematicas" encuentra "Matemáticas".
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
