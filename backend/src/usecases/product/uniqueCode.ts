/** Pick the next unused code within the caller's tenant and database transaction. */
export async function uniqueCode(
  requested: string,
  maxLength: number,
  exists: (candidate: string) => Promise<boolean>,
) {
  for (let suffix = 0; suffix < 10000; suffix += 1) {
    const ending = suffix === 0 ? '' : `-${suffix}`;
    const candidate = `${requested.slice(0, maxLength - ending.length)}${ending}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error('No available unique code for this value');
}

/** Retry a code allocation when another request claimed the same value first. */
export async function retryUniqueCode<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002' || attempt === 2) throw error;
    }
  }
  throw new Error('Unable to allocate a unique code');
}
