// Built by Anointed Coder.
//
// Admin route-group layout. Server component whose only job is to swap
// the PWA manifest for the admin section, so "Add to Home Screen" from
// any /admin page installs a separate "Pasha9 Admin" app whose start_url
// is /admin, instead of opening the player site. The interactive admin
// shell lives in admin/layout.tsx (a client component, which cannot
// export metadata). Nested metadata.manifest overrides the root manifest
// for every /admin route.

import type { ReactNode } from 'react';

export const metadata = {
  manifest: '/admin.webmanifest',
};

export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return children;
}
