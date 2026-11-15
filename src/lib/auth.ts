import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

const authSecret = process.env.BETTER_AUTH_SECRET;

if (!authSecret && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error("Set BETTER_AUTH_SECRET before starting the Gira server.");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: authSecret,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      hd: "ufpe.br",
      prompt: "select_account",
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.trim().toLowerCase();
          if (!user.emailVerified || !email.endsWith("@ufpe.br")) {
            throw new APIError("FORBIDDEN", {
              message: "Only verified @ufpe.br accounts may access Gira.",
            });
          }
          return { data: { ...user, email } };
        },
      },
    },
  },
});