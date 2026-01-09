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
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useMemo } from 'react';
import { addDays, format, startOfWeek, isSameDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserNav } from '@/components/layout/user-nav';

function MobileDaySelector({ selectedDay, setSelectedDay }: { selectedDay: Date, setSelectedDay: (date: Date) => void }) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

    return (
        <div className="flex justify-around items-center px-4 py-2">
            {weekDays.map(day => (
                <button 
                    key={day.toString()} 
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                        "flex flex-col items-center p-2 rounded-lg transition-colors",
                        isSameDay(day, selectedDay) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                    )}
                >
                    <span className="text-sm">{format(day, 'E', { locale: cs })}</span>
                    <span className="font-bold text-lg">{format(day, 'd')}</span>
                     {isSameDay(day, selectedDay) && <div className="mt-1 h-1 w-1 rounded-full bg-primary" />}
                </button>
            ))}
        </div>
    )
}

function MobileDashboard({ user, scheduleData, udalosti, substitutions }: { user: any, scheduleData: Rozvrh[], udalosti: Udalost[], substitutions: Substitution[]}) {
    const [selectedDay, setSelectedDay] = useState(new Date());

    const todaysSchedule = useMemo(() => {
        const scheduleForDay = scheduleData.find(s => isSameDay(parseISO(s.datum), selectedDay) && s.tridaId === user.tridaId);
        return scheduleForDay?.hodiny || [];
    }, [scheduleData, selectedDay, user.tridaId]);

    const todaysEvents = useMemo(() => {
        return udalosti.filter(e => isSameDay(parseISO(e.datum), selectedDay));
    }, [udalosti, selectedDay]);
    
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="flex justify-between items-center p-4">
                <h1 className="text-xl font-bold">Vítejte, {user.name.split(' ')[0]}!</h1>
                 <UserNav />
            </div>

            <MobileDaySelector selectedDay={selectedDay} setSelectedDay={setSelectedDay} />

            <div className="px-4 space-y-3 mt-4">
                {todaysEvents.map(event => (
                     <Card key={event.id} className="bg-card border-l-4 border-accent">
                        <CardContent className="p-3">
                            <CardTitle className="text-base">{event.nazev}</CardTitle>
                            <CardDescription>{event.typ} - {event.cas}</CardDescription>
                        </CardContent>
                    </Card>
                ))}
                {todaysSchedule.map((lesson, index) => {
                    if (!lesson) return null;
                    return (
                        <Card key={index} className="bg-card">
                            <CardContent className="p-3 flex gap-4">
                                <div className="text-center w-14 flex-shrink-0">
                                    <p className="font-bold text-lg">{index + 1}</p>
                                    <p className="text-xs text-muted-foreground">{scheduleData[0]?.timeSlots[index]?.replace('-', '\n')}</p>
                                </div>
                                <div className="border-l pl-4">
                                    <CardTitle className="text-base">{lesson.subjectName}</CardTitle>
                                    <CardDescription>{lesson.className} | {lesson.teacherName} | {lesson.ucebnaName}</CardDescription>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
                 {todaysSchedule.length === 0 && todaysEvents.length === 0 && (
                    <p className="text-center text-muted-foreground py-10">Pro tento den není naplánována žádná výuka ani události.</p>
                )}
            </div>
        </div>
    )
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const isMobile = useIsMobile();

  const isTeacher = hasRole('ucitel');

  // Fetch all schedules for all classes. The widget will filter them.
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
  
  if (isMobile) {
      return <MobileDashboard 
                user={user} 
                scheduleData={scheduleData || []} 
                udalosti={udalosti || []} 
                substitutions={substitutions || []}
             />;
  }


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

    
