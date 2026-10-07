const MAX_TENTATIVES = 5;
const FENETRE_MS = 10 * 60 * 1000;  // 10 minutes
const BLOCAGE_MS = 15 * 60 * 1000;  // 15 minutes

type Entree = {
  tentatives: number;
  premierEchec: Date;
};

const compteurs = new Map<string, Entree>();

function nettoyer() {
  const maintenant = Date.now();
  for (const [ip, entree] of compteurs) {
    if (maintenant - entree.premierEchec.getTime() > BLOCAGE_MS) {
      compteurs.delete(ip);
    }
  }
}

export function verifierRateLimit(ip: string): { bloque: boolean; minutesRestantes?: number } {
  nettoyer();
  const entree = compteurs.get(ip);
  if (!entree) return { bloque: false };

  const ageMs = Date.now() - entree.premierEchec.getTime();

  if (entree.tentatives >= MAX_TENTATIVES && ageMs < BLOCAGE_MS) {
    const minutesRestantes = Math.ceil((BLOCAGE_MS - ageMs) / 60_000);
    return { bloque: true, minutesRestantes };
  }

  return { bloque: false };
}

export function enregistrerEchec(ip: string): void {
  nettoyer();
  const entree = compteurs.get(ip);
  const maintenant = Date.now();

  if (!entree || maintenant - entree.premierEchec.getTime() >= FENETRE_MS) {
    compteurs.set(ip, { tentatives: 1, premierEchec: new Date() });
  } else {
    entree.tentatives += 1;
  }
}

export function reinitialiserCompteur(ip: string): void {
  compteurs.delete(ip);
}
