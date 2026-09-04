import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

async function updateBusinessDetails() {
  const kbText = fs.readFileSync(path.join(__dirname, "galaxy_knowledge_base.txt"), "utf-8");

  const accounts = await prisma.connectedAccount.findMany();
  console.log(`Found ${accounts.length} connected accounts in database.`);

  for (const acc of accounts) {
    await prisma.connectedAccount.update({
      where: { id: acc.id },
      data: {
        pageName: "Galaxy Laboratories (Unani)",
        businessDetails: kbText,
        aiTone: "friendly",
        aiAutoReply: true
      }
    });
    console.log(`Updated account ${acc.id} (${acc.platform}) with Galaxy Laboratories Knowledge Base.`);
  }

  console.log("ALL ACCOUNTS SUCCESSFULLY UPDATED WITH GALAXY LABORATORIES KNOWLEDGE BASE!");
}

updateBusinessDetails()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
