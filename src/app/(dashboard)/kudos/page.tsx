import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/shared/PageHeader";
import { KudosWall } from "@/components/kudos/KudosWall";

export const dynamic = "force-dynamic";

export default async function KudosPage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader
        title="Kudos Wall"
        description="Beri apresiasi ke rekan kerja. Tiap kirim kudos: +25 poin untukmu & penerima."
      />
      <KudosWall meName={(user.name ?? "").split(" ")[0] || "teman"} />
    </div>
  );
}
