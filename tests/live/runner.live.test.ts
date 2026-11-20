// LIVE tests: hit the real public Judge0 CE and Wandbox services. Run with: npm run test:live (needs outbound network).
import { describe, expect, it } from "vitest";
import { Judge0Runner, runTests, WandboxRunner, type Runner } from "../../supabase/functions/_shared/runner.ts";
import type { Language } from "../../supabase/functions/_shared/config.ts";

const live = process.env.LIVE_TESTS ? describe : describe.skip;

const SUM: Record<Language, string> = {
  python: "a, b = map(int, input().split())\nprint(a + b)\n",
  javascript: "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
  java: "import java.util.*;\npublic class Main { public static void main(String[] x) { Scanner s = new Scanner(System.in); System.out.println(s.nextInt() + s.nextInt()); } }\n",
  cpp: "#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout<<a+b<<std::endl; }\n",
  c: "#include <stdio.h>\nint main(void){ int a,b; scanf(\"%d %d\",&a,&b); printf(\"%d\\n\",a+b); return 0; }\n",
};
const BROKEN: Record<Language, string> = {
  python: "def (:\n  pass\n",
  javascript: "function {",
  java: "public class Main { public static void main(String[] a) { int x = \"s\"; } }",
  cpp: "int main( { return 0 }",
  c: "int main(void) { printf(\"x\") return 0; }",
};
const providers: [string, Runner][] = [["judge0", new Judge0Runner()], ["wandbox", new WandboxRunner()]];

live.each(providers)("real runner: %s", (_name, runner) => {
  for (const lang of Object.keys(SUM) as Language[]) {
    it(`${lang}: reads stdin and prints the sum`, async () => {
      const r = await runner.run({ language: lang, source: SUM[lang], stdin: "19 23\n" });
      expect(r.status).toBe("ok");
      expect(r.stdout.trim()).toBe("42");
    });
    it(`${lang}: compile check accepts valid code and rejects broken code`, async () => {
      expect((await runner.compile({ language: lang, source: SUM[lang] })).ok).toBe(true);
      const bad = await runner.compile({ language: lang, source: BROKEN[lang] });
      expect(bad.ok).toBe(false);
      expect(bad.output.length).toBeGreaterThan(0);
    });
  }
  it("python: infinite loop is stopped (timeout)", async () => {
    const r = await runner.run({ language: "python", source: "while True: pass\n", stdin: "", timeLimitSec: 2 });
    expect(r.status).toBe("timeout");
  });
  it("python: runtime error is reported", async () => {
    const r = await runner.run({ language: "python", source: "print(1/0)\n", stdin: "" });
    expect(r.status).toBe("runtime_error");
    expect(r.stderr).toContain("ZeroDivisionError");
  });
});

live("runTests against the real Judge0", () => {
  it("passes correct code, fails wrong code, hides hidden cases", async () => {
    const tests = [{ input: "1 2\n", expected: "3", visible: true }, { input: "10 20\n", expected: "30", visible: false }];
    const good = await runTests(new Judge0Runner(), "python", SUM.python, tests);
    expect(good.outcomes.every((o) => o.passed)).toBe(true);
    const wrong = await runTests(new Judge0Runner(), "python", "a,b=map(int,input().split())\nprint(a-b)\n", tests);
    expect(wrong.outcomes.some((o) => o.passed)).toBe(false);
    expect(wrong.outcomes[1].expected).toBeUndefined();
  });
});
