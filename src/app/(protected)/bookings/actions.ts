"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function cancelBooking(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const bookingId = formData.get("bookingId");

  if (typeof bookingId !== "string" || bookingId.length === 0) {
    redirect("/dashboard?result=cancel-unavailable");
  }

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      userId: session.user.id,
      startsAt: { gt: new Date() },
      status: { in: ["PENDING", "APPROVED"] },
    },
    data: { status: "CANCELED" },
  });

  redirect(`/dashboard?result=${result.count === 1 ? "canceled" : "cancel-unavailable"}`);
}

export async function approveBooking(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const bookingId = formData.get("bookingId");
  if (typeof bookingId !== "string" || bookingId.length === 0) {
    redirect("/review?result=unavailable");
  }

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "PENDING",
      resource: { space: { managerAssignments: { some: { managerId: session.user.id } } } },
    },
    data: { status: "APPROVED" },
  });

  redirect(`/review?result=${result.count === 1 ? "approved" : "unavailable"}`);
}

export async function rejectBooking(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const bookingId = formData.get("bookingId");
  const reasonValue = formData.get("reason");
  const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";

  if (typeof bookingId !== "string" || bookingId.length === 0) {
    redirect("/review?result=unavailable");
  }
  if (reason.length === 0 || reason.length > 300) {
    redirect("/review?result=invalid");
  }

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "PENDING",
      resource: { space: { managerAssignments: { some: { managerId: session.user.id } } } },
    },
    data: { status: "REJECTED", rejectionReason: reason },
  });

  redirect(`/review?result=${result.count === 1 ? "rejected" : "unavailable"}`);
}

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