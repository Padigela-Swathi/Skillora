import { notFound } from "next/navigation";
import { DevLoginForm } from "./DevLoginForm";

export const metadata = { title: "Dev sign-in" };

/**
 * Local-development sign-in with an email/password user you create in the Supabase dashboard, so you can run the app before
 * Google OAuth is configured. It does not exist in production builds, and needs NEXT_PUBLIC_ENABLE_DEV_LOGIN=1.
 */
export default function DevLoginPage() {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "1") notFound();
  return (
    <main className="mx-auto flex max-w-[440px] flex-col gap-4 px-5 py-10">
      <h1 className="text-2xl font-bold">Dev sign-in</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">Local development only. Use an email and password user created in Supabase → Authentication → Users.</p>
      <DevLoginForm />
    </main>
  );
}
