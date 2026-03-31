import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminId = process.env.SEED_ADMIN_USER_ID;
  if (!adminId) {
    console.log("Skip seed: set SEED_ADMIN_USER_ID to a Supabase user UUID to promote to ADMIN.");
    return;
  }
  await prisma.user.update({
    where: { id: adminId },
    data: { role: "ADMIN" },
  });
  console.log("User promoted to ADMIN:", adminId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
