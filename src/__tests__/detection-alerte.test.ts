import { describe, it, expect } from "vitest";
import {
  calculerNiveauAlerte,
  calculerNiveauAlerteAbsence,
} from "@/lib/detection-alerte";

// ── calculerNiveauAlerte ─────────────────────────────────────────────────────

describe("calculerNiveauAlerte", () => {
  it("1. baisse de 20% exactement avec moyenne après < 10 → eleve", () => {
    // avant=10, après=8 : ecart=(10-8)/10*100=20%, après=8<10
    expect(calculerNiveauAlerte(10, 8)).toBe("eleve");
  });

  it("2. baisse de 25% avec moyenne après < 10 → eleve", () => {
    // avant=12, après=9 : ecart=(12-9)/12*100=25%, après=9<10
    expect(calculerNiveauAlerte(12, 9)).toBe("eleve");
  });

  it("3. baisse de 20% exactement avec moyenne après >= 10 → moyen", () => {
    // avant=15, après=12 : ecart=(15-12)/15*100=20%, après=12>=10
    // 20%>=20 mais après>=10 → pas eleve ; 20%>=15 → moyen
    expect(calculerNiveauAlerte(15, 12)).toBe("moyen");
  });

  it("4. baisse de 15% exactement → moyen", () => {
    // avant=20, après=17 : ecart=(20-17)/20*100=15%
    expect(calculerNiveauAlerte(20, 17)).toBe("moyen");
  });

  it("5. baisse de 19% avec moyenne après < 10 → moyen (sous le seuil eleve)", () => {
    // avant=10, après=8.1 : ecart≈19%, après=8.1<10
    // 19%<20 → pas eleve ; 19%>=15 → moyen
    expect(calculerNiveauAlerte(10, 8.1)).toBe("moyen");
  });

  it("6. baisse de 14.9% → null (sous le seuil minimum)", () => {
    // avant=20, après=17.02 : ecart=14.9%
    expect(calculerNiveauAlerte(20, 17.02)).toBeNull();
  });

  it("7. pas de baisse (même moyenne) → null", () => {
    expect(calculerNiveauAlerte(15, 15)).toBeNull();
  });

  it("8. hausse de moyenne → null", () => {
    // avant=10, après=12 : écart négatif
    expect(calculerNiveauAlerte(10, 12)).toBeNull();
  });

  it("9. moyenne avant = 0 (pas de division par zéro) → null", () => {
    expect(calculerNiveauAlerte(0, 5)).toBeNull();
  });

  it("10. baisse de 100% (avant=10, après=0) → eleve", () => {
    // ecart=100%, après=0<10 → eleve
    expect(calculerNiveauAlerte(10, 0)).toBe("eleve");
  });
});

// ── calculerNiveauAlerteAbsence ──────────────────────────────────────────────

describe("calculerNiveauAlerteAbsence", () => {
  it("11. 4 absences injustifiées → null (sous le seuil)", () => {
    expect(calculerNiveauAlerteAbsence(4)).toBeNull();
  });

  it("12. 5 absences injustifiées → moyen", () => {
    expect(calculerNiveauAlerteAbsence(5)).toBe("moyen");
  });

  it("13. 9 absences injustifiées → moyen", () => {
    expect(calculerNiveauAlerteAbsence(9)).toBe("moyen");
  });

  it("14. 10 absences injustifiées → eleve", () => {
    expect(calculerNiveauAlerteAbsence(10)).toBe("eleve");
  });

  it("15. 15 absences injustifiées → eleve", () => {
    expect(calculerNiveauAlerteAbsence(15)).toBe("eleve");
  });

  it("16. 0 absence → null", () => {
    expect(calculerNiveauAlerteAbsence(0)).toBeNull();
  });
});
