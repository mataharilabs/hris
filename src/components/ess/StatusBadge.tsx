import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_COLORS } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={REQUEST_STATUS_COLORS[status] ?? ""}>
      {REQUEST_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
