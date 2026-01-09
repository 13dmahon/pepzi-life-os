type ErrorContext = {
  where: string;
  userId?: string;
  route?: string;
  digest?: string;
  extra?: Record<string, unknown>;
};

export function logError(error: unknown, context: ErrorContext): void {
  const timestamp = new Date().toISOString();
  
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  const structured = {
    timestamp,
    message: errorObj.message,
    stack: errorObj.stack?.split('\n').slice(0, 5).join('\n'),
    where: context.where,
    digest: context.digest,
    userId: context.userId,
    route: context.route ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
    extra: context.extra,
  };

  // Dev: console
  if (process.env.NODE_ENV === 'development') {
    console.error('🔴 [logError]', structured);
  } else {
    // Prod: still console for now
    console.error('[logError]', JSON.stringify(structured));
  }
}