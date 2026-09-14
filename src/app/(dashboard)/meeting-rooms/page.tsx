import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/shared/PageHeader";
import { MeetingCalendar } from "@/components/meeting/MeetingCalendar";

export const dynamic = "force-dynamic";

export default async function MeetingRoomsPage() {
  await requireUser();

  return (
    <div>
      <PageHeader
        title="Meeting Room"
        description="Lihat jadwal & status ruang rapat, lalu pesan ruangan. Wajib check-in agar meeting aktif."
      />
      <MeetingCalendar />
    </div>
  );
}
