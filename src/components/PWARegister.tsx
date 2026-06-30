import { useRegisterSW } from "virtual:pwa-register/react";

export function PWARegister() {
  useRegisterSW({
    onRegisteredSW(swUrl) {
      console.log("SW registered:", swUrl);
    },
    onRegisterError(error) {
      console.error("SW registration failed:", error);
    },
  });

  return null;
}
