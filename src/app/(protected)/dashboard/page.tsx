import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SignOutButton from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/">gira<span>.</span></Link>
        <nav className="resources-navigation" aria-label="Navegação principal">
          <Link href="/resources">Recursos</Link>
          <Link href="/bookings">Agendamentos</Link>
          <SignOutButton />
        </nav>
      </header>
      <section className="dashboard-content">
        <p className="eyebrow">Acesso confirmado</p>
        <h1>Olá, {session.user.name}.</h1>
        <p>
          Você entrou com <strong>{session.user.email}</strong>.
        </p>
        <Link className="dashboard-resources-link" href="/resources">
          Explorar recursos <span aria-hidden="true">&rarr;</span>
        </Link>
      </section>
    </main>
  );
}