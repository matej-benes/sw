'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, Grading } from "@/lib/types";
import { format, getDay, isSameDay, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Info, Award } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
];

interface MobileTimetableProps {
    schedules: Rozvrh[];
    eventsData: Udalost[];
    substitutionsData: Substitution[];
    isTeacher: boolean;
    userId: string;
    studentId?: string;
    userClassId?: string;
    days: Date[];
}

function TeacherLessonContextMenu({ children, lesson, dayInfo, period }: { children: React.ReactNode, lesson: LessonBlock, dayInfo: { fullDate: Date }, period: number }) {
    const router = useRouter();

    const handleNavigation = (path: string, params: Record<string, string>) => {
        const queryParams = new URLSearchParams(params).toString();
        router.push(`${path}?${queryParams}`);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/tridni-kniha/zapis', {
                    tridaId: lesson.classId,
                    datum: format(dayInfo.fullDate, 'yyyy-MM-dd'),
                    hodina: (period + 1).toString(),
                    predmetId: lesson.subjectId,
                })}>Zapsat do třídní knihy</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/hodnoceni', {
                     tridaId: lesson.classId,
                    predmetId: lesson.subjectId,
                })}>Nové hodnocení</DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleNavigation('/dashboard/ukoly', {
                    tridaId: lesson.classId,
                    predmetId: lesson.subjectId,
                    datumZadani: format(dayInfo.fullDate, 'yyyy-MM-dd'),
                })}>Nový domácí úkol</DropdownMenuItem>
            </DropdownMenuContent>
    </DropdownMenu>
    );
}

function LessonCard({ lesson, period, timeRange, day, classId, isTeacher, grades = [] }: { lesson: LessonBlock, period: number, timeRange: string, day: Date, classId: string, isTeacher: boolean, grades: Grading[] }) {
    const router = useRouter();
    const { toast } = useToast();

    const handleLessonClick = () => {
        if (isTeacher) {
            toast({
                title: 'Akce hodiny',
                description: 'Pro zobrazení akcí (např. zápis do třídnice) podržte prst na hodině.',
            });
            return;
        }
        const slug = [
            format(day, 'yyyy-MM-dd'),
            period,
            classId,
            lesson.id,
        ].join('/');
        router.push(`/dashboard/hodina/${slug}`);
    };
    
    const lessonGrades = useMemo(() => {
        // Since `g.datum` is "dd.MM.yyyy", we need to parse it correctly before comparing
        return grades.filter(g => {
            const gradeDate = parseISO(g.createdAt.toDate().toISOString());
            return g.predmetId === lesson.subjectId && isSameDay(gradeDate, day);
        });
    }, [grades, lesson.subjectId, day]);

    const cardContent = (
        <div className={cn("rounded-lg bg-card border p-3")} onClick={handleLessonClick}>
            <div className="flex gap-4">
                <div className="text-center w-12 flex-shrink-0">
                    <p className="font-bold text-lg">{period + 1}</p>
                    <p className="text-xs text-muted-foreground">{timeRange?.split('-')[0]}</p>
                </div>
                <div className="flex-grow">
                    <p className="font-semibold">{lesson.subjectName}</p>
                    <p className="text-sm text-muted-foreground">{isTeacher ? lesson.className : lesson.teacherName}</p>
                </div>
            </div>
            {lessonGrades.length > 0 && !isTeacher && (
                <div className="mt-2 pt-2 border-t flex items-center gap-3">
                    <Award className="h-4 w-4 text-primary" />
                    <div className="flex flex-wrap gap-2">
                        {lessonGrades.map((grade) => (
                            <Link key={grade.id} href={`/dashboard/hodnoceni/${grade.id}`} onClick={(e) => e.stopPropagation()} className="flex items-baseline">
                                <span className="font-bold text-primary text-lg">{grade.znamka}</span>
                                <span className="text-xs text-muted-foreground ml-0.5">({grade.vaha})</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
    
    if (isTeacher) {
        return (
            <TeacherLessonContextMenu lesson={lesson} dayInfo={{ fullDate: day }} period={period}>
                {cardContent}
            </TeacherLessonContextMenu>
        );
    }

    return cardContent;
}

function EventCard({ event, period, timeRange }: { event: Udalost, period: number, timeRange: string }) {
    return (
        <div className="flex gap-4 p-3 rounded-lg bg-card border border-accent">
            <div className="text-center w-12 flex-shrink-0">
                <p className="font-bold text-lg">{period + 1}</p>
                <p className="text-xs text-muted-foreground">{timeRange?.split('-')[0]}</p>
            </div>
            <div className="flex-grow">
                <p className="font-semibold">{event.nazev}</p>
                <Badge variant="outline" className="mt-1 border-accent text-accent">{event.typ}</Badge>
            </div>
        </div>
    );
}

function CancelledLessonCard({ substitution, period, timeRange }: { substitution: Substitution, period: number, timeRange: string }) {
    return (
        <div className="flex gap-4 p-3 rounded-lg bg-card border border-destructive/50">
            <div className="text-center w-12 flex-shrink-0">
                <p className="font-bold text-lg">{period + 1}</p>
                <p className="text-xs text-muted-foreground">{timeRange?.split('-')[0]}</p>
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-destructive line-through">
                    {substitution.originalLesson.lessonBlock.subjectName}
                </p>
                <p className="text-sm text-muted-foreground">Hodina odpadá</p>
            </div>
        </div>
    );
}

export function MobileTimetable({
    schedules,
    eventsData,
    substitutionsData,
    isTeacher,
    userId,
    studentId,
    userClassId,
    days,
}: MobileTimetableProps) {
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState(today);
    const firestore = useFirestore();

    const gradesQuery = useMemoFirebase(() => {
        if (!firestore || isTeacher || !studentId) return null;
        return query(collection(firestore, 'gradings'), where('ziakId', '==', studentId));
    }, [firestore, isTeacher, studentId]);

    const { data: grades, isLoading: gradesLoading } = useCollection<Grading>(gradesQuery);

    const timetableData = useMemo(() => {
        const selectedDaySchedule = schedules.find(s => isSameDay(parseISO(s.datum), selectedDate));
        if (!selectedDaySchedule) return { timeSlots: defaultTimeSlots, lessons: [] };

        const timeSlots = selectedDaySchedule.timeSlots || defaultTimeSlots;
        const dayIndex = (getDay(selectedDate) + 6) % 7;
        const dayName = format(selectedDate, 'EEEE', { locale: cs });

        const lessons = selectedDaySchedule.hodiny.map((lesson, period) => {
            if (!lesson) return null;
            if (isTeacher && lesson.teacherId !== userId) return null;

            const event = eventsData.find(e =>
                isSameDay(parseISO(e.datum), selectedDate) &&
                e.nahrazujeHodiny &&
                e.tridyIds.includes(selectedDaySchedule.tridaId) &&
                e.cas === timeSlots[period]?.split('-')[0]
            );
            if (event) return { type: 'event', event, period };

            const substitution = substitutionsData.find(sub =>
                isSameDay(parseISO(sub.date), selectedDate) &&
                sub.originalLesson.day === dayName &&
                sub.originalLesson.period === period &&
                sub.originalLesson.classId === selectedDaySchedule.tridaId
            );

            if (substitution) {
                if (substitution.changes.type.includes('zruseno')) {
                    return { type: 'cancelled', substitution, period };
                }
                const substitutedLesson = { ...lesson, ...substitution.changes };
                // Placeholder for teacher name, in a real app you'd fetch this
                if (substitution.changes.teacherId) {
                     substitutedLesson.teacherName = 'Zástup';
                }
                return { type: 'substituted', lesson: substitutedLesson, originalLesson: lesson, period };
            }

            return { type: 'lesson', lesson, period };
        }).filter(Boolean);

        return { timeSlots, lessons };

    }, [selectedDate, schedules, eventsData, substitutionsData, isTeacher, userId]);
    
    return (
        <div className="flex flex-col h-full bg-background text-foreground p-4 space-y-4">
            <div className="flex justify-around">
                {days.map(day => (
                    <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                            "flex flex-col items-center p-2 rounded-lg transition-colors",
                            isSameDay(day, selectedDate) ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
                        )}
                    >
                        <span className="text-sm font-medium">{format(day, 'E', { locale: cs })}</span>
                        <span className="font-bold text-lg">{format(day, 'd')}</span>
                        {isSameDay(day, today) && <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1"></div>}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
                {timetableData.lessons.length === 0 ? (
                    <div className="text-center text-muted-foreground pt-16">
                        Žádné hodiny pro tento den.
                    </div>
                ) : (
                    timetableData.lessons.map((item: any, idx: number) => {
                        const timeRange = timetableData.timeSlots[item.period];
                        const classId = schedules.find(s => isSameDay(parseISO(s.datum), selectedDate))?.tridaId || '';
                        
                        switch (item.type) {
                            case 'lesson':
                                return <LessonCard key={idx} lesson={item.lesson} period={item.period} timeRange={timeRange} day={selectedDate} classId={classId} isTeacher={isTeacher} grades={grades || []} />;
                            case 'substituted':
                                return <LessonCard key={idx} lesson={item.lesson} period={item.period} timeRange={timeRange} day={selectedDate} classId={classId} isTeacher={isTeacher} grades={grades || []}/>;
                            case 'event':
                                return <EventCard key={idx} event={item.event} period={item.period} timeRange={timeRange} />;
                            case 'cancelled':
                                return <CancelledLessonCard key={idx} substitution={item.substitution} period={item.period} timeRange={timeRange} />;
                            default:
                                return null;
                        }
                    })
                )}
            </div>
        </div>
    );
}
