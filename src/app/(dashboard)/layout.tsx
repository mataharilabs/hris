import { redirect } from "next/navigation";
import { requireUser, AuthError } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { KudosWelcome } from "@/components/kudos/KudosWelcome";
import type { NavRole } from "@/lib/constants";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError && e.status === 403) redirect("/no-access");
    redirect("/login");
  }

  const ssoUrl = process.env.SSO_URL ?? "https://sso.asiacommerce.net";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={user.role as NavRole} ssoUrl={ssoUrl} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          name={user.name ?? "User"}
          email={user.email ?? ""}
          role={user.role}
          companyName={user.companyName}
          ssoUrl={ssoUrl}
        />
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-white via-brand-50/30 to-white p-6">
          <div className="animate-fade-up">{children}</div>
        </main>
        <KudosWelcome />
      </div>
    </div>
  );
}
