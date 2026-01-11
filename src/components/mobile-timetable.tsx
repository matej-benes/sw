'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, Grading } from "@/lib/types";
import { format, getDay, isSameDay, parse, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Info, Award, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

const dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

//==============================================================================
// CONTEXT MENU (for Teachers)
//==============================================================================
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


//==============================================================================
// CARD COMPONENTS
//==============================================================================
function LessonCard({ lesson, period, timeRange, day, classId, isTeacher, grades = [] }: { lesson: LessonBlock, period: number, timeRange: string, day: Date, classId: string, isTeacher: boolean, grades: Grading[] }) {
    const router = useRouter();
    const { toast } = useToast();

    const gradesForThisLesson = useMemo(() => {
        return grades.filter(grade => 
            grade.predmetId === lesson.subjectId &&
            isSameDay(parse(grade.datum, 'dd.MM.yyyy', new Date()), day)
        );
    }, [grades, lesson, day]);

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

    const cardContent = (
        <div className="rounded-lg bg-card border p-3" onClick={handleLessonClick}>
            <div className="flex gap-4">
                <div className="text-center w-12 flex-shrink-0">
                    <p className="font-bold text-lg">{period + 1}</p>
                    <p className="text-xs text-muted-foreground">{timeRange?.split('-')[0]}</p>
                </div>
                <div className="flex-grow">
                    <p className="font-semibold">{lesson.subjectName}</p>
                    <p className="text-sm text-muted-foreground">{isTeacher ? lesson.className : lesson.teacherName}</p>
                    {isTeacher && <p className="text-sm text-muted-foreground">{lesson.ucebnaName}</p>}
                </div>
                 {gradesForThisLesson.length > 0 && (
                    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1">
                        {gradesForThisLesson.map(grade => (
                            <div key={grade.id} className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 border-2 border-primary">
                                <span className="font-bold text-primary">{grade.znamka}</span>
                            </div>
                        ))}
                    </div>
                 )}
            </div>
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
            <div className="flex-grow flex items-center gap-2">
                 <XCircle className="h-5 w-5 text-destructive" />
                <div>
                    <p className="font-semibold text-destructive line-through">
                        {substitution.originalLesson.lessonBlock.subjectName}
                    </p>
                    <p className="text-sm text-muted-foreground">Hodina odpadá</p>
                </div>
            </div>
        </div>
    );
}

//==============================================================================
// MAIN COMPONENT
//==============================================================================
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
        if (isTeacher || !firestore || !studentId) return null;
        return query(collection(firestore, 'gradings'), where('ziakId', '==', studentId));
    }, [firestore, isTeacher, studentId]);

    const { data: gradesData } = useCollection<Grading>(gradesQuery);

    const timetableForSelectedDay = useMemo(() => {
        const schedule = schedules.find(s => isSameDay(parseISO(s.datum), selectedDate));
        if (!schedule) return null;

        const timeSlots = schedule.timeSlots || defaultTimeSlots;
        const dayIndex = getDay(selectedDate);
        const dayName = dayNames[dayIndex];

        const processedItems = timeSlots.map((time, periodIndex) => {
            const lesson = schedule.hodiny[periodIndex];

            const event = eventsData.find(e =>
                isSameDay(parseISO(e.datum), selectedDate) &&
                e.nahrazujeHodiny &&
                e.tridyIds.includes(schedule.tridaId) &&
                e.cas === time?.split('-')[0]
            );
            if (event) {
                return { type: 'event', data: event, period: periodIndex, timeRange: time };
            }

            const substitution = substitutionsData.find(sub =>
                isSameDay(parseISO(sub.date), selectedDate) &&
                sub.originalLesson.day === dayName &&
                sub.originalLesson.period === periodIndex &&
                sub.originalLesson.classId === schedule.tridaId
            );

            if (substitution?.changes.type.includes('zruseno')) {
                return { type: 'cancelled', data: substitution, period: periodIndex, timeRange: time };
            }
            
            let lessonToShow: LessonBlock | null = lesson;
            if (substitution && lesson) {
                const substitutedLesson = { ...lesson, ...substitution.changes };
                if (substitution.changes.teacherId) {
                     substitutedLesson.teacherName = 'Zástup';
                }
                lessonToShow = substitutedLesson;
            }

            if (!lessonToShow) return null; 
            
            if (isTeacher && lessonToShow.teacherId !== userId) return null;
            if (!isTeacher && schedule.tridaId !== userClassId) return null;

            return { type: 'lesson', data: lessonToShow, period: periodIndex, timeRange: time, classId: schedule.tridaId };
        }).filter(item => item !== null); // Ensure null items are filtered out

        return processedItems;

    }, [selectedDate, schedules, eventsData, substitutionsData, isTeacher, userId, userClassId]);
    
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

            <div className="flex-1 overflow-y-auto space-y-3 pb-16">
                {!timetableForSelectedDay || timetableForSelectedDay.length === 0 ? (
                    <div className="text-center text-muted-foreground pt-16">
                        Žádné hodiny pro tento den.
                    </div>
                ) : (
                    timetableForSelectedDay.map((item: any, idx: number) => {
                        switch (item.type) {
                            case 'lesson':
                                return <LessonCard key={idx} lesson={item.data} period={item.period} timeRange={item.timeRange} day={selectedDate} classId={item.classId} isTeacher={isTeacher} grades={gradesData || []} />;
                            case 'event':
                                return <EventCard key={idx} event={item.data} period={item.period} timeRange={item.timeRange} />;
                            case 'cancelled':
                                return <CancelledLessonCard key={idx} substitution={item.data} period={item.period} timeRange={item.timeRange} />;
                            default:
                                return null;
                        }
                    })
                )}
            </div>
        </div>
    );
}