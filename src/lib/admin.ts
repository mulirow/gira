import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function isAdminUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  return user?.isAdmin ?? false;
}

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }
  if (!(await isAdminUser(session.user.id))) {
    redirect("/dashboard");
  }

  return session;
}