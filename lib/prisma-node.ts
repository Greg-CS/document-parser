import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaNode?: PrismaClient };

const prismaNode = globalForPrisma.prismaNode ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaNode = prismaNode;

export default prismaNode;
