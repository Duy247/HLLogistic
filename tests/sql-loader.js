// Only the isolated check process loads this mock. Dev/production use the real driver.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@vercel/postgres') {
    return { url: new URL('./sql-stub.js', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
