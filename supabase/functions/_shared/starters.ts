import type { Language } from "./config.ts";

/** Starter code per language. Programs read stdin and print to stdout. */
export const STARTERS: Record<Language, string> = {
  python: `import sys


def main():
    data = sys.stdin.read().split()
    # Read the input from data, then print your answer.


main()
`,
  javascript: `const lines = require("fs").readFileSync(0, "utf8").split("\\n");

function main() {
  // Read the input from lines, then console.log your answer.
}

main();
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        // Read the input with in.next() / in.nextInt(), then print your answer.
    }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // Read the input with cin, then print your answer with cout.
    return 0;
}
`,
  c: `#include <stdio.h>

int main(void) {
    /* Read the input with scanf, then print your answer with printf. */
    return 0;
}
`,
};
