'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { mockStudentTimetable, mockTeacherTimetable } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, BookOpenCheck, CalendarDays, BookUser, MessageSquarePlus, Settings2 } from 'lucide-react';
import type { Timetable } from '@/lib/types';
import { useRouter } from 'next/navigation';

function TimetableCard({ timetable }: { timetable: Timetable }) {
    const today = new Date();
    const dayOfWeek = today.toLocaleString('cs-CZ', { weekday: 'long' });
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    const lessons = timetable[capitalizedDay] || [];

    return (
        <Card className="col-span-1 lg:col-span-3">
            <CardHeader>
                <CardTitle>Dnešní rozvrh - {capitalizedDay}</CardTitle>
            </CardHeader>
            <CardContent>
                {lessons.length > 0 ? (
                    <div className="space-y-4">
                        {lessons.map((lesson, index) => (
                            <div key={index} className="flex items-center justify-between rounded-lg border bg-card p-3">
                                <div>
                                    <p className="font-semibold">{lesson.subject}</p>
                                    <p className="text-sm text-muted-foreground">{lesson.time} | {lesson.class || lesson.teacher} | Místnost: {lesson.room}</p>
                                </div>
                                <Badge variant="secondary">{lesson.class ? 'Vyučujete' : 'Máte hodinu'}</Badge>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">Dnes není žádná výuka.</p>
                )}
            </CardContent>
        </Card>
    );
}

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

  if (!user) return null;

  const timetable = hasRole('ucitel') ? mockTeacherTimetable : mockStudentTimetable;

  return (
    <div className="flex-1 space-y-4">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Vítejte zpět, {user.name}!</h1>
            <p className="text-muted-foreground">Přehled vašeho dne v Škola Online.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>Kalendář</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   <Calendar
                        mode="single"
                        selected={new Date()}
                        className="rounded-md border-none"
                    />
                </CardContent>
            </Card>

            <TimetableCard timetable={timetable} />
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
