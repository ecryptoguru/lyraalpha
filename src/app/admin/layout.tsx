import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { AdminLayoutClient } from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireAdmin();
  if (!check.authorized) {
    redirect("/dashboard");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
