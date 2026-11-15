"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requestBooking(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const resourceId = formData.get("resourceId");
  const startsAtValue = formData.get("startsAt");
  const endsAtValue = formData.get("endsAt");

  if (
    typeof resourceId !== "string" ||
    typeof startsAtValue !== "string" ||
    typeof endsAtValue !== "string"
  ) {
    redirect("/bookings?result=invalid");
  }

  const startsAt = new Date(startsAtValue);
  const endsAt = new Date(endsAtValue);
  const now = new Date();

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt <= now ||
    endsAt <= startsAt
  ) {
    redirect("/bookings?result=invalid");
  }

  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, isActive: true },
    select: { id: true },
  });

  if (!resource) {
    redirect("/bookings?result=resource-unavailable");
  }

  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      resourceId,
      status: { in: ["PENDING", "APPROVED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });

  if (overlappingBooking) {
    redirect("/bookings?result=conflict");
  }

  if (startsAt <= new Date()) {
    redirect("/bookings?result=invalid");
  }

  try {
    await prisma.booking.create({
      data: {
        resourceId,
        userId: session.user.id,
        startsAt,
        endsAt,
      },
    });
  } catch (error) {
    // The database exclusion constraint also covers concurrent submissions.
    const concurrentOverlap = await prisma.booking.findFirst({
      where: {
        resourceId,
        status: { in: ["PENDING", "APPROVED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });

    if (concurrentOverlap) {
      redirect("/bookings?result=conflict");
    }

    throw error;
  }

  redirect("/bookings?result=submitted");
}