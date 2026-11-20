import { Icon } from "@/components/Icon";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Signed out" };

export default function SignedOut() {
  return (
    <main className="flex min-h-[calc(100dvh-69px)] items-center justify-center px-5 py-8 md:px-12">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-[18px] rounded-xl border border-line bg-white p-5 text-center md:p-8">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brick-100 text-brick-500"><Icon name="signOut" size={30} /></span>
        <h1 className="text-2xl font-bold md:text-[32px]">You have been signed out</h1>
        <p className="text-base leading-[1.55] text-ink-2">Skillora needs you to accept the Terms and Conditions and Privacy Policy before you can practise. You can come back and accept them any time.</p>
        <LinkButton href="/" className="w-full">Back to home</LinkButton>
        <LinkButton href="/signin" variant="ghost" size="sm">Sign in again</LinkButton>
      </div>
    </main>
  );
}
