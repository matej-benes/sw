'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpenCheck, CalendarDays, BookUser, MessageSquarePlus, Settings2 } from 'lucide-react';
import type { Udalost, Rozvrh, Substitution } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { TimetableWidget } from '@/components/timetable-widget';
import { CalendarIcon } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, or } from 'firebase/firestore';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const isTeacher = hasRole('ucitel');

  // Fetch all schedules. The widget will filter them based on role.
  const schedulesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'rozvrhy');
  }, [firestore]);

  const { data: scheduleData } = useCollection<Rozvrh>(schedulesCollectionRef);


  // Fetch events
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const classOrClauses = user.tridaId ? [where('tridyIds', 'array-contains', user.tridaId)] : [];
    
    return query(
        collection(firestore, 'udalosti'), 
        or(
            where('uciteleIds', 'array-contains', user.id),
            ...classOrClauses
        )
    );
  }, [firestore, user]);

  const { data: udalosti } = useCollection<Udalost>(eventsQuery);
  
  // Fetch substitutions - for simplicity, fetch all for now
  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suplovani');
  }, [firestore]);

  const { data: substitutions } = useCollection<Substitution>(substitutionsQuery);


  if (!user) return null;


  return (
    <div className="flex-1 space-y-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Vítejte zpět, {user.name}!</h1>
            <p className="text-muted-foreground">Přehled vašeho dne v Škola Online.</p>
        </div>

        <div className="mt-6">
             <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <CalendarIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Kalendář</CardTitle>
                        <CardDescription>Váš týdenní přehled.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <TimetableWidget 
                        schedules={scheduleData || []} 
                        eventsData={udalosti || []}
                        substitutionsData={substitutions || []}
                        isTeacher={isTeacher} 
                        userId={user.id}
                        userClassId={user.tridaId}
                    />
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
