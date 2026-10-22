"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { signOut } from "@/core/auth/actions";
import { Button } from "@/core/ui";

export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => start(() => signOut())}
      title="Sair"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sair</span>
    </Button>
  );
}
