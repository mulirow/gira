"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const operationalStatuses = ["AVAILABLE", "IN_MAINTENANCE", "BROKEN"] as const;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isForeignKeyConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2003";
}

async function requireManager() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

export async function createResource(formData: FormData) {
  const session = await requireManager();
  const spaceId = formString(formData, "spaceId");
  const name = formString(formData, "name");
  const description = formString(formData, "description");
  const status = formString(formData, "operationalStatus");

  if (
    !spaceId ||
    name.length < 2 ||
    name.length > 100 ||
    description.length < 2 ||
    description.length > 1000 ||
    !operationalStatuses.includes(status as (typeof operationalStatuses)[number])
  ) {
    redirect("/resources/manage?result=invalid");
  }

  const space = await prisma.space.findFirst({
    where: {
      id: spaceId,
      managerAssignments: { some: { managerId: session.user.id } },
    },
    select: { name: true },
  });

  if (!space) redirect("/resources/manage?result=unavailable");

  try {
    await prisma.resource.create({
      data: {
        name,
        description,
        location: space.name,
        operationalStatus: status as (typeof operationalStatuses)[number],
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) redirect("/resources/manage?result=name-taken");
    throw error;
  }

  revalidatePath("/resources/manage");
  revalidatePath("/resources");
  revalidatePath("/bookings");
  redirect("/resources/manage?result=created");
}

export async function updateResourceDetails(formData: FormData) {
  const session = await requireManager();
  const resourceId = formString(formData, "resourceId");
  const name = formString(formData, "name");
  const description = formString(formData, "description");

  if (!resourceId || name.length < 2 || name.length > 100 || description.length < 2 || description.length > 1000) {
    redirect("/resources/manage?result=invalid");
  }

  try {
    const result = await prisma.resource.updateMany({
      where: {
        id: resourceId,
        space: { managerAssignments: { some: { managerId: session.user.id } } },
      },
      data: { name, description },
    });

    if (result.count !== 1) redirect("/resources/manage?result=unavailable");
  } catch (error) {
    if (isUniqueConstraintError(error)) redirect("/resources/manage?result=name-taken");
    throw error;
  }

  revalidatePath("/resources/manage");
  revalidatePath("/resources");
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
  redirect("/resources/manage?result=details-updated");
}

export async function updateResourceStatus(formData: FormData) {
  const session = await requireManager();
  const resourceId = formString(formData, "resourceId");
  const status = formString(formData, "operationalStatus");

  if (!resourceId || !operationalStatuses.includes(status as (typeof operationalStatuses)[number])) {
    redirect("/resources/manage?result=invalid");
  }

  const result = await prisma.resource.updateMany({
    where: {
      id: resourceId,
      space: { managerAssignments: { some: { managerId: session.user.id } } },
    },
    data: { operationalStatus: status as (typeof operationalStatuses)[number] },
  });

  if (result.count !== 1) redirect("/resources/manage?result=unavailable");

  revalidatePath("/resources/manage");
  revalidatePath("/resources");
  revalidatePath("/bookings");
  redirect("/resources/manage?result=status-updated");
}

export async function deleteResource(formData: FormData) {
  const session = await requireManager();
  const resourceId = formString(formData, "resourceId");

  if (!resourceId) redirect("/resources/manage?result=invalid");

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const resource = await transaction.resource.findFirst({
        where: {
          id: resourceId,
          space: { managerAssignments: { some: { managerId: session.user.id } } },
        },
        select: { id: true },
      });

      if (!resource) return "unavailable";

      const booking = await transaction.booking.findFirst({
        where: { resourceId },
        select: { id: true },
      });

      if (booking) return "has-bookings";

      await transaction.resource.delete({ where: { id: resourceId } });
      return "deleted";
    });

    if (result !== "deleted") redirect(`/resources/manage?result=${result === "has-bookings" ? "resource-has-bookings" : "unavailable"}`);
  } catch (error) {
    if (isForeignKeyConstraintError(error)) redirect("/resources/manage?result=resource-has-bookings");
    throw error;
  }

  revalidatePath("/resources/manage");
  revalidatePath("/resources");
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
  redirect("/resources/manage?result=resource-deleted");
}