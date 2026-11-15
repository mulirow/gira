"use client";

import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  return (
    <button
      className="sign-out-button"
      type="button"
      onClick={() =>
        authClient.signOut({
          fetchOptions: { onSuccess: () => window.location.assign("/login") },
        })
      }
    >
      Sair
    </button>
  );
}