import { requireUser } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api";
import { getSummary } from "@/lib/gamification";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getSummary(user.id));
  } catch (e) {
    return handleApiError(e);
  }
}
