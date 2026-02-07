
import React from 'react';
import { redirect } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Během údržby přesměrujeme vše na hlavní stranu
  redirect('/');
  return <>{children}</>;
}
