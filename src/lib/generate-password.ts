// Sans 0, O, I, l, 1 pour éviter la confusion visuelle
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(): string {
  const valeurs = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(valeurs, (v) => CHARS[v % CHARS.length]).join("");
}
