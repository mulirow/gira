import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveBooking, rejectBooking } from "../bookings/actions";

type ReviewPageProps = {
  searchParams: Promise<{ result?: string }>;
};

const feedback: Record<string, { title: string; message: string; success?: boolean }> = {
  approved: {
    title: "Solicitação aprovada",
    message: "A reserva foi confirmada.",
    success: true,
  },
  rejected: {
    title: "Solicitação recusada",
    message: "A justificativa foi registrada e ficará visível para quem solicitou.",
    success: true,
  },
  invalid: {
    title: "Informe um motivo para recusar",
    message: "O motivo deve ter entre 1 e 300 caracteres.",
  },
  unavailable: {
    title: "Solicitação indisponível",
    message: "Ela já foi analisada ou você não está designado para gerenciar este espaço.",
  },
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const managerAssignment = await prisma.spaceManager.findFirst({
    where: { managerId: session.user.id },
    select: { spaceId: true },
  });

  if (!managerAssignment) {
    redirect("/dashboard");
  }

  const [bookings, params] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: "PENDING",
        resource: { space: { managerAssignments: { some: { managerId: session.user.id } } } },
      },
      include: {
        resource: { select: { name: true, location: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: [{ createdAt: "asc" }, { startsAt: "asc" }],
    }),
    searchParams,
  ]);
  const notice = params.result && Object.hasOwn(feedback, params.result)
    ? feedback[params.result]
    : undefined;

  return (
    <main className="dashboard-page review-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/">gira<span>.</span></Link>
        <nav className="resources-navigation" aria-label="Navegação principal">
          <Link href="/dashboard">Painel</Link>
          <Link href="/resources">Recursos</Link>
          <Link href="/bookings">Agendamentos</Link>
          <SignOutButton />
        </nav>
      </header>

      <section className="review-workspace" aria-labelledby="review-heading">
        <div className="resource-catalog-heading">
          <div>
            <p className="eyebrow">Gestão dos espaços</p>
            <h1 id="review-heading">Solicitações pendentes</h1>
          </div>
          <p className="resource-count" aria-live="polite">
            {bookings.length} {bookings.length === 1 ? "solicitação" : "solicitações"}
          </p>
        </div>

        {notice && (
          <div
            className={`booking-feedback ${notice.success ? "is-success" : "is-error"}`}
            role={notice.success ? "status" : "alert"}
            aria-live={notice.success ? "polite" : "assertive"}
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

        {bookings.length === 0 ? (
          <div className="resource-empty" role="status">
            <h2>Nenhuma solicitação pendente</h2>
            <p>Não há pedidos para os espaços sob sua gestão.</p>
          </div>
        ) : (
          <ul className="review-list">
            {bookings.map((booking) => (
              <li className="review-item" key={booking.id}>
                <div className="review-item-heading">
                  <div>
                    <p className="review-resource-location">{booking.resource.location}</p>
                    <h2>{booking.resource.name}</h2>
                  </div>
                  <span className="booking-state">Pendente</span>
                </div>
                <dl className="review-details">
                  <div>
                    <dt>Solicitante</dt>
                    <dd>{booking.user.name} <span>({booking.user.email})</span></dd>
                  </div>
                  <div>
                    <dt>Período solicitado</dt>
                    <dd>
                      {booking.startsAt.toLocaleString("pt-BR")} – {booking.endsAt.toLocaleString("pt-BR")}
                    </dd>
                  </div>
                  <div>
                    <dt>Recebida em</dt>
                    <dd>{booking.createdAt.toLocaleString("pt-BR")}</dd>
                  </div>
                </dl>
                <div className="review-actions">
                  <form action={approveBooking}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <button className="review-approve-button" type="submit">Aprovar</button>
                  </form>
                  <details className="review-reject">
                    <summary>Rejeitar</summary>
                    <form action={rejectBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <label htmlFor={`reason-${booking.id}`}>Motivo da recusa</label>
                      <textarea
                        id={`reason-${booking.id}`}
                        name="reason"
                        maxLength={300}
                        required
                        rows={3}
                      />
                      <button className="review-reject-button" type="submit">Confirmar recusa</button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}