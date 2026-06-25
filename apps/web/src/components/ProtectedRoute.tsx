import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function ProtectedRoute() {
  const [status, setStatus] = useState<"loading" | "auth" | "unauth">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "auth" : "unauth");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "auth" : "unauth");
    });
    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") return null;
  if (status === "unauth") return <Navigate to="/auth" replace />;
  return <Outlet />;
}
