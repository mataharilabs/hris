import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { getActivity } from "@/lib/gamification";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getActivity(user.id, 25));
  } catch (e) {
    return handleApiError(e);
  }
}
