import { SignupFormCard } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "clamp(16px, 4vw, 48px)",
      }}
    >
      <SignupFormCard />
    </main>
  );
}
