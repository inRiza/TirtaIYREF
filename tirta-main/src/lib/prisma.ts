// import { PrismaClient } from "@prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma";

const createPrismaClient = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: ReturnType<typeof createPrismaClient> | undefined;
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
