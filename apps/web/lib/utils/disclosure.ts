'use client';

import { useCallback, useState } from 'react';

export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const onToggle = useCallback(() => setOpen((v) => !v), []);
  return { open, setOpen, onOpen, onClose, onToggle };
}

export async function mockDelay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms));
}
