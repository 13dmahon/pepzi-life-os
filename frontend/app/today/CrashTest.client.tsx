'use client';

import { useEffect } from 'react';

export default function CrashTestClient({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (enabled) throw new Error('stability test');
  }, [enabled]);

  return null;
}
