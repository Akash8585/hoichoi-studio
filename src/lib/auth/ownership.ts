import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function briefsFor(userId: string) {
  return { createdById: userId };
}

export function packagesFor(userId: string) {
  return { brief: { createdById: userId } };
}

export function postsFor(userId: string) {
  return { package: { brief: { createdById: userId } } };
}

export function reportsFor(userId: string) {
  return { createdById: userId };
}

export async function ownedBrief(userId: string, id: string) {
  return prisma.brief.findFirst({
    where: { id, createdById: userId },
  });
}

export async function ownedPackage(userId: string, id: string) {
  return prisma.assetPackage.findFirst({
    where: { id, brief: { createdById: userId } },
  });
}

export async function ownedReport(userId: string, id: string) {
  return prisma.weeklyReport.findFirst({
    where: { id, createdById: userId },
  });
}
