import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { resourceId } = await params;
  const month = new URL(request.url).searchParams.get("month");

  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ error: "Mês inválido." }, { status: 400 });
  }

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: {
      operationalStatus: true,
      space: { select: { isActive: true } },
    },
  });

  if (!resource || resource.operationalStatus !== "AVAILABLE" || !resource.space.isActive) {
    return Response.json({ error: "Recurso indisponível." }, { status: 404 });
  }

  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1));
  const queryStart = new Date(monthStart.getTime() - 24 * 60 * 60 * 1000);
  const queryEnd = new Date(nextMonthStart.getTime() + 24 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      resourceId,
      status: { in: ["PENDING", "APPROVED"] },
      startsAt: { lt: queryEnd },
      endsAt: { gt: queryStart },
    },
    select: { startsAt: true, endsAt: true, status: true },
    orderBy: { startsAt: "asc" },
  });

  return Response.json(
    bookings.map((booking) => ({
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
    })),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}