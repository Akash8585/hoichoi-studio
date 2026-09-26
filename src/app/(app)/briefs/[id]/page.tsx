import { redirect } from "next/navigation";

export default async function BriefWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/studio?brief=${id}`);
}

