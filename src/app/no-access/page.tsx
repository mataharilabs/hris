import { ShieldAlert } from "lucide-react";

export default function NoAccessPage() {
  const ssoUrl = process.env.SSO_URL ?? "";
  const logoutHref = ssoUrl ? `${ssoUrl}/logout` : "/login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">
          Tidak ada akses ke HRIS
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Akun Anda belum diberi akses ke aplikasi HRIS. Hubungi admin untuk
          mendapatkan peran (role) di aplikasi HRIS.
        </p>
        <a
          href={logoutHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Keluar
        </a>
      </div>
    </div>
  );
}
