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

const actionCards = [
    { title: "Zapsat hodnocení", icon: GraduationCap, href: "/dashboard/studenti", description: "Přidejte nové známky." },
    { title: "Třídní kniha", icon: BookOpenCheck, href: "/dashboard/tridy", description: "Spravujte docházku." },
    { title: "Zobrazit rozvrh", icon: CalendarDays, href: "/dashboard/rozvrh", description: "Celý týdenní přehled." },
    { title: "Správa žáků", icon: BookUser, href: "/dashboard/studenti", description: "Seznam a detaily žáků." },
    { title: "Komunikace", icon: MessageSquarePlus, href: "/dashboard/zpravy", description: "Posílejte zprávy." },
    { title: "Nastavení", icon: Settings2, href: "#", description: "Upravte si profil." },
]

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const isTeacher = hasRole('ucitel');

  // For students, fetch only their class schedule. For teachers, fetch all schedules.
  const schedulesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'rozvrhy');
  }, [firestore]);

  const studentScheduleRef = useMemoFirebase(() => {
    if (!firestore || isTeacher || !user?.tridaId) return null;
    return doc(firestore, 'rozvrhy', user.tridaId);
  }, [firestore, user?.tridaId, isTeacher]);

  const { data: allSchedules } = useCollection<Rozvrh>(isTeacher ? schedulesCollectionRef : null);
  const { data: studentScheduleData } = useDoc<Rozvrh>(studentScheduleRef);

  // Combine schedule data based on role
  const scheduleData = isTeacher ? allSchedules : (studentScheduleData ? [studentScheduleData] : []);


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
                    />
                </CardContent>
            </Card>
        </div>

        <div className="mt-6">
            <h2 className="text-2xl font-bold tracking-tight mb-4">Rychlé akce</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {actionCards.map(card => (
                     <Card key={card.title} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(card.href)}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <card.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">{card.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    </div>
  );
}

    