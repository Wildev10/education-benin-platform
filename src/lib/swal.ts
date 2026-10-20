import type { SweetAlertOptions } from "sweetalert2";

type SweetAlert = typeof import("sweetalert2").default;

// SweetAlert2 (≈ 30 Ko compressés) n'est téléchargé qu'au premier message affiché,
// pas au chargement de chaque page qui pourrait en afficher un.
let chargement: Promise<SweetAlert> | null = null;
let charge: SweetAlert | null = null;

function charger(): Promise<SweetAlert> {
  chargement ??= import("sweetalert2").then((m) => (charge = m.default));
  return chargement;
}

const OPTIONS_TOAST: SweetAlertOptions = {
  toast: true,
  position: "bottom-end",
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  customClass: {
    popup: "swal-toast-custom",
  },
};

const OPTIONS_CONFIRM: SweetAlertOptions = {
  confirmButtonColor: "#F97316",
  cancelButtonColor: "#0A0A0A",
  confirmButtonText: "Confirmer",
  cancelButtonText: "Annuler",
};

/** Même signature que Swal.fire, mais la bibliothèque est chargée au premier appel */
function differe(base?: SweetAlertOptions): SweetAlert["fire"] {
  const fire = (options: SweetAlertOptions) => charger().then((swal) => (base ? swal.mixin(base) : swal).fire(options));
  return fire as SweetAlert["fire"];
}

export const Toast = { fire: differe(OPTIONS_TOAST) };

export const Confirm = { fire: differe(OPTIONS_CONFIRM) };

export const Swal = {
  fire: differe(),
  /** Appelé depuis preConfirm : la fenêtre est ouverte, donc la bibliothèque déjà chargée */
  showValidationMessage: (message: string) => charge?.showValidationMessage(message),
};
