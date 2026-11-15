import Link from "next/link";
import LoginForm from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-layout" aria-labelledby="login-title">
        <div className="login-intro">
          <Link className="wordmark" href="/" aria-label="Gira home">
            gira<span>.</span>
          </Link>
          <div className="intro-copy">
            <h1 id="login-title">Gestão Inteligente de Recursos Acadêmicos</h1>
            <p className="intro-description">
              Acesse o sistema de reservas com sua conta institucional e
              organize o uso de salas, laboratórios e outros espaços
              compartilhados com mais praticidade.
            </p>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-panel-content">
            <p className="panel-kicker">Acesso institucional</p>
            <h2 id="login-panel-title">Entrar no Gira</h2>
            <p className="panel-description">
              Use sua conta institucional para continuar com acesso seguro ao
              sistema.
            </p>
            <LoginForm hasAuthError={Boolean(error)} />
            <p className="privacy-note">
              O acesso fica restrito a contas institucionais verificadas.
            </p>
          </div>
          <footer className="login-footer">
            <span>Gira</span>
            <span>Uso responsável dos espaços públicos</span>
          </footer>
        </div>
      </section>
    </main>
  );
}