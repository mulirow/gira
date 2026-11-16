import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/sign-out-button";
import { cancelBooking } from "../bookings/actions";

type DashboardPageProps = {
  searchParams: Promise<{ result?: string }>;
};

const statusLabels = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  CANCELED: "Cancelada",
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const [bookings, managerAssignment, params] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: session.user.id },
      include: { resource: { select: { name: true, location: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.spaceManager.findFirst({
      where: { managerId: session.user.id },
      select: { spaceId: true },
    }),
    searchParams,
  ]);
  const now = new Date();
  const upcomingBookings = bookings.filter((booking) => booking.startsAt > now);
  const pastBookings = bookings
    .filter((booking) => booking.startsAt <= now)
    .reverse();
  const notice = params.result === "canceled"
    ? { title: "Solicitação cancelada", message: "O horário foi liberado para outras pessoas." }
    : params.result === "cancel-unavailable"
      ? { title: "Não foi possível cancelar", message: "Esta solicitação já começou, não pertence à sua conta ou não pode mais ser cancelada." }
      : undefined;

  function renderBooking(booking: (typeof bookings)[number]) {
    const canCancel = booking.startsAt > now && ["PENDING", "APPROVED"].includes(booking.status);

    return (
      <li key={booking.id}>
        <div>
          <h3>{booking.resource.name}</h3>
          <p>{booking.resource.location}</p>
        </div>
        <p className="booking-period">
          {booking.startsAt.toLocaleString("pt-BR")} – {booking.endsAt.toLocaleString("pt-BR")}
        </p>
        <span className={`booking-state is-${booking.status.toLowerCase()}`}>
          {statusLabels[booking.status]}
        </span>
        {booking.status === "REJECTED" && booking.rejectionReason && (
          <p className="booking-rejection-reason">Motivo: {booking.rejectionReason}</p>
        )}
        {canCancel && (
          <form action={cancelBooking}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <button className="booking-cancel-button" type="submit">Cancelar solicitação</button>
          </form>
        )}
      </li>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/">gira<span>.</span></Link>
        <nav className="resources-navigation" aria-label="Navegação principal">
          <Link href="/resources">Recursos</Link>
          <Link href="/bookings">Agendamentos</Link>
          {managerAssignment && <Link href="/review">Analisar solicitações</Link>}
          <SignOutButton />
        </nav>
      </header>
      <section className="dashboard-content">
        <p className="eyebrow">Painel de agendamentos</p>
        <h1>Minhas solicitações</h1>
        <p>Olá, {session.user.name}. Acompanhe aqui o status das suas reservas.</p>

        {notice && (
          <div
            className={`booking-feedback ${params.result === "canceled" ? "is-success" : "is-error"}`}
            role={params.result === "canceled" ? "status" : "alert"}
          >
            <span className="booking-feedback-symbol" aria-hidden="true">
              {params.result === "canceled" ? "✓" : "!"}
            </span>
            <div>
              <h2>{notice.title}</h2>
              <p>{notice.message}</p>
            </div>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="dashboard-bookings-empty">
            <p>Você ainda não enviou solicitações de reserva.</p>
            <Link className="dashboard-resources-link" href="/bookings">
              Solicitar reserva <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        ) : (
          <div className="dashboard-booking-sections">
            <section className="booking-history" aria-labelledby="upcoming-bookings-heading">
              <div className="booking-history-heading">
                <h2 id="upcoming-bookings-heading">Próximas</h2>
                <span className="resource-count">{upcomingBookings.length}</span>
              </div>
              {upcomingBookings.length === 0 ? (
                <p className="booking-history-empty">Nenhuma solicitação futura.</p>
              ) : (
                <ul className="booking-list">{upcomingBookings.map(renderBooking)}</ul>
              )}
            </section>
            <section className="booking-history" aria-labelledby="past-bookings-heading">
              <div className="booking-history-heading">
                <h2 id="past-bookings-heading">Anteriores</h2>
                <span className="resource-count">{pastBookings.length}</span>
              </div>
              {pastBookings.length === 0 ? (
                <p className="booking-history-empty">Nenhuma solicitação anterior.</p>
              ) : (
                <ul className="booking-list">{pastBookings.map(renderBooking)}</ul>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}