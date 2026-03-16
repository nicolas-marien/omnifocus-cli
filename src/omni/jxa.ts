import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fail } from "../errors";

const execFileAsync = promisify(execFile);

export async function runJxa<T>(source: string): Promise<T> {
  const wrapped = `(function(){${source}})();`;
  try {
    const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", wrapped], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const text = stdout.trim();
    if (!text) {
      fail("E_SCRIPT", "OmniFocus script returned no output");
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (error && typeof error === "object" && "stderr" in error) {
      const stderr = String((error as { stderr?: string }).stderr ?? "").trim();
      const message = stderr || String((error as { message?: string }).message ?? "Script execution failed");
      fail("E_SCRIPT", message);
    }

    if (error instanceof Error) {
      fail("E_SCRIPT", error.message);
    }
    fail("E_SCRIPT", "Unknown OmniFocus scripting error");
  }
}

export function jxaString(value: string): string {
  return JSON.stringify(value);
}

export async function runOmniJs<T>(source: string): Promise<T> {
  const scriptLiteral = jxaString(source);
  return runJxa<T>(`
const app = Application("OmniFocus");
const out = app.evaluateJavascript(${scriptLiteral});
if (typeof out !== "string") {
  return JSON.stringify(out);
}
return out;
`);
}
