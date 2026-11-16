"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function resultUrl(result: string, spaceId?: string) {
  const query = new URLSearchParams({ result });
  if (spaceId) query.set("spaceId", spaceId);
  return `/admin/spaces?${query}`;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function createSpace(formData: FormData) {
  await requireAdmin();
  const name = formString(formData, "name");

  if (name.length < 2 || name.length > 100) {
    redirect(resultUrl("invalid-name"));
  }

  try {
    const space = await prisma.space.create({ data: { name } });
    revalidatePath("/admin/spaces");
    redirect(resultUrl("created", space.id));
  } catch (error) {
    if (isUniqueConstraintError(error)) redirect(resultUrl("name-taken"));
    throw error;
  }
}

export async function updateSpace(formData: FormData) {
  await requireAdmin();
  const spaceId = formString(formData, "spaceId");
  const name = formString(formData, "name");

  if (!spaceId || name.length < 2 || name.length > 100) {
    redirect(resultUrl("invalid-name", spaceId));
  }

  try {
    const result = await prisma.space.updateMany({
      where: { id: spaceId, isActive: true },
      data: { name },
    });
    revalidatePath("/admin/spaces");
    redirect(resultUrl(result.count === 1 ? "updated" : "unavailable", spaceId));
  } catch (error) {
    if (isUniqueConstraintError(error)) redirect(resultUrl("name-taken", spaceId));
    throw error;
  }
}

export async function assignSpaceManager(formData: FormData) {
  await requireAdmin();
  const spaceId = formString(formData, "spaceId");
  const managerId = formString(formData, "managerId");

  if (!spaceId || !managerId) redirect(resultUrl("unavailable", spaceId));

  const space = await prisma.space.findFirst({ where: { id: spaceId, isActive: true } });
  const user = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true } });
  if (!space || !user) redirect(resultUrl("unavailable", spaceId));

  await prisma.spaceManager.upsert({
    where: { spaceId_managerId: { spaceId, managerId } },
    create: { spaceId, managerId },
    update: {},
  });
  revalidatePath("/admin/spaces");
  redirect(resultUrl("manager-assigned", spaceId));
}

export async function revokeSpaceManager(formData: FormData) {
  await requireAdmin();
  const spaceId = formString(formData, "spaceId");
  const managerId = formString(formData, "managerId");

  if (!spaceId || !managerId) redirect(resultUrl("unavailable", spaceId));

  await prisma.spaceManager.deleteMany({ where: { spaceId, managerId } });
  revalidatePath("/admin/spaces");
  redirect(resultUrl("manager-revoked", spaceId));
}

export async function archiveSpace(formData: FormData) {
  await requireAdmin();
  const spaceId = formString(formData, "spaceId");
  if (!spaceId) redirect(resultUrl("unavailable"));

  const now = new Date();
  const result = await prisma.$transaction(async (transaction) => {
    const blockingBooking = await transaction.booking.findFirst({
      where: {
        resource: { space: { id: spaceId } },
        OR: [
          { status: "PENDING" },
          { status: "APPROVED", endsAt: { gt: now } },
        ],
      },
      select: { id: true },
    });

    if (blockingBooking) return "has-bookings";

    const archived = await transaction.space.updateMany({
      where: { id: spaceId, isActive: true },
      data: { isActive: false },
    });
    if (archived.count !== 1) return "unavailable";

    await transaction.spaceManager.deleteMany({ where: { spaceId } });
    return "archived";
  });

  revalidatePath("/admin/spaces");
  revalidatePath("/resources");
  revalidatePath("/bookings");
  redirect(resultUrl(result, spaceId));
}

export async function restoreSpace(formData: FormData) {
  await requireAdmin();
  const spaceId = formString(formData, "spaceId");
  if (!spaceId) redirect(resultUrl("unavailable"));

  const result = await prisma.space.updateMany({
    where: { id: spaceId, isActive: false },
    data: { isActive: true },
  });
  revalidatePath("/admin/spaces");
  revalidatePath("/resources");
  revalidatePath("/bookings");
  redirect(resultUrl(result.count === 1 ? "restored" : "unavailable", spaceId));
}