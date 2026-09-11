"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/auth";

export async function logout() {
  // Mode SSO: logout global lewat SSO (menghapus cookie .asiacommerce.net).
  if (process.env.SSO_ENABLED === "true" && process.env.SSO_URL) {
    redirect(`${process.env.SSO_URL}/logout`);
  }
  await signOut({ redirectTo: "/login" });
}
