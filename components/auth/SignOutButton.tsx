"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/store/auth";
import { Button } from "@/components/ui/Button";

/** Ends the server session, clears the cookie, and sends the shopper home. */
export function SignOutButton() {
  const router = useRouter();
  const signOut = useAuth((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      size="md"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
