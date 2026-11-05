/**
 * @file A fresh cache: a Cloudflare Cache API cache of its own for each test
 * that stores responses, so no other test's entries reach it.
 */

export async function freshCache(): Promise<Cache> {
  return caches.open(crypto.randomUUID());
}
