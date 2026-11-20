import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/Brand";
import { Banner, LinkButton } from "@/components/ui";
import { GoogleButton } from "./GoogleButton";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/practice");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-[calc(100dvh-69px)] items-center justify-center px-5 py-8 md:px-12">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-5 rounded-xl border border-line bg-white p-5 text-center md:p-8">
        <LogoMark size={72} />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold md:text-[32px]">Welcome to Skillora</h1>
          <p className="text-base leading-[1.55] text-ink-2">Sign in with your Google account so we can save your interviews, scores and progress.</p>
        </div>
        {error && <Banner tone="error" className="w-full text-left">We could not sign you in with Google. Please try again.</Banner>}
        <GoogleButton />
        <p className="text-[13px] leading-normal text-ink-3">Next you will review and accept our Terms and Conditions and Privacy Policy.</p>
        <LinkButton href="/" variant="ghost" size="sm">Back to home</LinkButton>
      </div>
    </main>
  );
}
