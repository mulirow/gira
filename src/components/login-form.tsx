"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginForm({ hasAuthError }: { hasAuthError: boolean }) {
  const [error, setError] = useState(
    hasAuthError
      ? "Não foi possível confirmar sua conta. Entre com uma conta institucional verificada."
      : "",
  );
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithGoogle() {
    setError("");
    setIsLoading(true);

    const next = new URLSearchParams(window.location.search).get("next");
    const callbackURL = next?.startsWith("/") && !next.startsWith("//")
      ? next
      : "/dashboard";

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL: "/login?error=unauthorized_email",
        additionalParams: { hd: "ufpe.br" },
      });

      if (result.error) {
        setError("Use uma conta institucional verificada para continuar.");
        setIsLoading(false);
      }
    } catch {
      setError("Não foi possível iniciar o acesso. Tente novamente.");
      setIsLoading(false);
    }
  }

  return (
    <div className="login-actions">
      {error && (
        <p className="auth-error" role="alert">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
      <button
        className="google-button"
        type="button"
        onClick={signInWithGoogle}
        disabled={isLoading}
      >
        <span className="google-mark" aria-hidden="true">G</span>
        {isLoading ? "Conectando ao Google..." : "Continuar com Google"}
        <span className="button-arrow" aria-hidden="true">→</span>
      </button>
    </div>
  );
}