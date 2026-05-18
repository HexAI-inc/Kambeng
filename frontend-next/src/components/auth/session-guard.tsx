"use client";

type SessionGuardProps = {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "USER";
};

export function SessionGuard({ children }: SessionGuardProps) {
  return <>{children}</>;
}
