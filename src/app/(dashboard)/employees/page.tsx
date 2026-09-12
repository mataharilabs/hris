import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireUser, isHr } from "@/lib/session";
import { PageHeader } from "@/components/shared/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { ImportButton } from "@/components/employees/ImportButton";
import { EmployeeList } from "@/components/employees/EmployeeList";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await requireUser();
  if (!isHr(user.role)) redirect("/ess");

  return (
    <div>
      <PageHeader
        title="Karyawan"
        description="Database karyawan (bersumber dari SSO). Gaji & kuota cuti dikelola di HRIS."
        action={
          <div className="flex items-center gap-2">
            <ImportButton />
            <a
              href="/api/employees/export"
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="h-4 w-4" />
              Export
            </a>
          </div>
        }
      />
      <EmployeeList />
    </div>
  );
}
