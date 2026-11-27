import { PrismaClient } from "@prisma/client";
import { seedFullDemoWorkspace } from "../src/lib/demo-seed";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding FORGE CRM demo dataset (1 org, 2 branches, 600 members, 12 plans, 6 trainers, 18mo payments, 40k check-ins, 300 leads)...");
  const result = await seedFullDemoWorkspace(prisma);
  console.log(
    `Done: org=${result.orgId}, members=${result.memberCount}, checkIns=${result.checkInCount}`
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
