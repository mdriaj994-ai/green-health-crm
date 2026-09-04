import { prisma } from "../src/lib/prisma";

async function main() {
  const pageId = "1349377744914106";
  const accessToken =
    "EAANK0lAKZA4YBSbFmUIFo1bvGsHx3NZAxlJ9uZCycrKlyChZCndJZBZCogRIWuZCjQRcaWaQgYj0siiSwjVZCZAh7P9H2Xkq9SI3ELhY5ZB3UDD0mYZCdrITGK9TWM3K6iwWBaCxfUXLWY8j13zM7auLHinf5h5UyJqZBsO11qvxkKekEfRWHw7KkbQ91rSfq1ZBZBwOSuh29Xz4T0agZDZD";

  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Admin User",
        email: "admin@socialinbox.com",
        password: "demo",
        role: "SUPER_ADMIN",
      },
    });
  }

  // 1. Messenger account
  const messengerAcc = await prisma.connectedAccount.upsert({
    where: {
      platform_pageId_userId: {
        platform: "MESSENGER",
        pageId,
        userId: user.id,
      },
    },
    create: {
      platform: "MESSENGER",
      pageId,
      pageName: "Bangla Bazar",
      accessToken,
      userId: user.id,
      isActive: true,
    },
    update: {
      accessToken,
      isActive: true,
      pageName: "Bangla Bazar",
    },
  });

  // 2. Facebook Page (Comments)
  const fbAcc = await prisma.connectedAccount.upsert({
    where: {
      platform_pageId_userId: {
        platform: "FACEBOOK",
        pageId,
        userId: user.id,
      },
    },
    create: {
      platform: "FACEBOOK",
      pageId,
      pageName: "Bangla Bazar",
      accessToken,
      userId: user.id,
      isActive: true,
    },
    update: {
      accessToken,
      isActive: true,
      pageName: "Bangla Bazar",
    },
  });

  console.log("CONNECTED_SUCCESSFULLY:", { messenger: messengerAcc.id, facebook: fbAcc.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
