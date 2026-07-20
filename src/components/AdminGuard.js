"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminGuard({ children }) {
  const { user, loading, isAdmin, isStaff } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || (!isAdmin && !isStaff)) {
        router.push("/");
      }
    }
  }, [user, loading, isAdmin, isStaff, router]);

  if (loading || !user || (!isAdmin && !isStaff)) {
    return <div className="loader"></div>;
  }

  return <>{children}</>;
}
