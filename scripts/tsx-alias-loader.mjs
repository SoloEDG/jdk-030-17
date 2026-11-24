import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const root = resolvePath(import.meta.dirname, "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolvePath(root, "src", specifier.slice(2));
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
