'use client';

import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;
  
  return (
    <div>
        <h1 className="text-3xl font-bold tracking-tight">Vítejte zpět, {user.name}!</h1>
        <p className="text-muted-foreground">Vyberte akci z menu.</p>
    </div>
  )
}
