import { prisma } from "../src/lib/db/prisma";

const briefs = await prisma.brief.findMany({ select: { id: true, title: true } });
for (const brief of briefs) {
  const title = brief.title
    .replace(/\s*[—–]\s*/g, " ")
    .replace(/\s+--\s+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (title !== brief.title) {
    await prisma.brief.update({ where: { id: brief.id }, data: { title } });
    console.log(`${brief.title} => ${title}`);
  }
}
await prisma.$disconnect();
