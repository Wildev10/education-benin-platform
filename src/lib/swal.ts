import Swal from "sweetalert2";

export const Toast = Swal.mixin({
  toast: true,
  position: "bottom-end",
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  customClass: {
    popup: "swal-toast-custom",
  },
});

export const Confirm = Swal.mixin({
  confirmButtonColor: "#F97316",
  cancelButtonColor: "#0A0A0A",
  confirmButtonText: "Confirmer",
  cancelButtonText: "Annuler",
});

export { Swal };
