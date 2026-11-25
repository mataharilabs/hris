import { requireUser } from "@/lib/session";
import { KudosWall } from "@/components/kudos/KudosWall";

export const dynamic = "force-dynamic";

export default async function KudosPage() {
  const user = await requireUser();
  return (
    <KudosWall
      meName={(user.name ?? "").split(" ")[0] || "Anda"}
      meId={user.id}
    />
  );
}
