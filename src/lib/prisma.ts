import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Cast to PrismaClient for correct include/relation types.
// At runtime, the Accelerate extension handles the prisma+postgres:// protocol.
export const prisma =
  globalForPrisma.prisma ??
  (new PrismaClient().$extends(withAccelerate()) as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
