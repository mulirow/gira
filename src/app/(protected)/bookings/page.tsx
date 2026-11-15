import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BookingRequestForm from "./booking-request-form";

type BookingsPageProps = {
  searchParams: Promise<{ result?: string }>;
};

const feedback: Record<string, { title: string; message: string; success?: boolean }> = {
  submitted: {
    title: "Solicitação enviada com sucesso",
    message: "Sua reserva foi registrada e está pendente de análise.",
    success: true,
  },
  conflict: {
    title: "Não foi possível solicitar este horário",
    message: "Este recurso já tem uma reserva pendente ou aprovada nesse período. Escolha outro horário e tente novamente.",
  },
  invalid: {
    title: "Confira o período informado",
    message: "A data precisa estar no futuro e o término deve ser posterior ao início. Corrija os horários e envie novamente.",
  },
  "resource-unavailable": {
    title: "Recurso indisponível",
    message: "Este recurso não aceita novas reservas. Selecione outro recurso para continuar.",
  },
};

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const [resources, bookings, params] = await Promise.all([
    prisma.resource.findMany({
      select: { id: true, name: true, location: true, isActive: true },
      orderBy: [{ location: "asc" }, { name: "asc" }],
    }),
    prisma.booking.findMany({
      where: { userId: session.user.id },
      include: { resource: { select: { name: true, location: true } } },
      orderBy: { startsAt: "desc" },
      take: 20,
    }),
    searchParams,
  ]);

  const notice = params.result ? feedback[params.result] : undefined;

  return (
    <main className="dashboard-page bookings-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/">gira<span>.</span></Link>
        <nav className="resources-navigation" aria-label="Navegação principal">
          <Link href="/dashboard">Painel</Link>
          <Link href="/resources">Recursos</Link>
          <SignOutButton />
        </nav>
      </header>

      <section className="booking-workspace" aria-labelledby="booking-heading">
        <div className="resource-catalog-heading">
          <div>
            <p className="eyebrow">Agendamento de recursos</p>
            <h1 id="booking-heading">Solicitar reserva</h1>
          </div>
        </div>

        {notice && (
          <div
            className={`booking-feedback ${notice.success ? "is-success" : "is-error"}`}
            role={notice.success ? "status" : "alert"}
            aria-live={notice.success ? "polite" : "assertive"}
            aria-atomic="true"
            tabIndex={-1}
          >
            <span className="booking-feedback-symbol" aria-hidden="true">
              {notice.success ? "✓" : "!"}
            </span>
            <div>
              <h2>{notice.title}</h2>
              <p>{notice.message}</p>
            </div>
          </div>
        )}

        {resources.length > 0 ? (
          <BookingRequestForm resources={resources} />
        ) : (
          <div className="resource-empty" role="status">
            <h2>Nenhum recurso cadastrado</h2>
            <p>Não há recursos para agendamento no momento.</p>
          </div>
        )}

        <section className="booking-history" aria-labelledby="booking-history-heading">
          <div className="booking-history-heading">
            <h2 id="booking-history-heading">Minhas solicitações</h2>
            <span className="resource-count">Últimas 20</span>
          </div>
          {bookings.length === 0 ? (
            <p className="booking-history-empty">Você ainda não enviou solicitações.</p>
          ) : (
            <ul className="booking-list">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <div>
                    <h3>{booking.resource.name}</h3>
                    <p>{booking.resource.location}</p>
                  </div>
                  <p className="booking-period">
                    {booking.startsAt.toLocaleString("pt-BR")} – {booking.endsAt.toLocaleString("pt-BR")}
                  </p>
                  <span className={`booking-state is-${booking.status.toLowerCase()}`}>
                    {booking.status === "PENDING" ? "Pendente" : booking.status === "APPROVED" ? "Aprovada" : booking.status === "REJECTED" ? "Recusada" : "Cancelada"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}