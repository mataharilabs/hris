import { redirect } from "next/navigation";

export default function LoginPage() {
  // HRIS = SSO-only: login terpusat di SSO.
  if (process.env.SSO_URL) {
    redirect(`${process.env.SSO_URL}/login`);
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">HRIS</h1>
        <p className="mt-2 text-sm text-slate-500">
          Login dilakukan melalui SSO AsiaCommerce. Konfigurasi{" "}
          <code>SSO_URL</code> belum diset.
        </p>
      </div>
    </div>
  );
}
