"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminViralPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users-growth");
  }, [router]);

  return null;
}
