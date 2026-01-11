'use client';
import React, { useState, useMemo } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, User, Predmet, Grading } from "@/lib/types";
import { format, getDay, isSameDay, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Info, PlusCircle, Award } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';


const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
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
    studentId?: string; // Add studentId for fetching grades
    userClassId?: string;
    days: Date[];
}

function TeacherLessonContextMenu({ children, lesson, dayInfo, period, classId }: { children: React.ReactNode, lesson: LessonBlock, dayInfo: { fullDate: Date }, period: number, classId: string }) {
    const router = useRouter();

    const handleNavigation = (path: string, params: Record<string, string>) => {
        const query = new URLSearchParams(params).toString();
        router.push(`${path}?${query}`);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onContextMenu={(e) => {
                e.preventDefault();
            }}>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/tridni-kniha/zapis', {
                    tridaId: lesson.classId,
                    datum: format(dayInfo.fullDate, 'yyyy-MM-dd'),
                    hodina: (period + 1).toString(),
                    predmetId: lesson.subjectId,
                })}>Zapsat do třídní knihy</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/hodnoceni', {
                     tridaId: lesson.classId,
                    predmetId: lesson.subjectId,
                    datum: format(dayInfo.fullDate, 'yyyy-MM-dd'),
                    hodina: (period + 1).toString()
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
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();

    const timeSlots = schedules[0]?.timeSlots || defaultTimeSlots;

    const gradesQuery = useMemoFirebase(() => {
        if (!firestore || !studentId) return null;
        return query(collection(firestore, 'gradings'), where('ziakId', '==', studentId));
    }, [firestore, studentId]);
    const { data: grades } = useCollection<Grading>(gradesQuery);
    
    const selectedDaySchedule = schedules.find(s => isSameDay(parseISO(s.datum), selectedDate));
    
    const lessonsForDay = selectedDaySchedule?.hodiny.map((lesson, index) => {
        if (!lesson) return { type: 'empty', period: index };

        // Apply logic for teacher/student view
        const isRelevant = isTeacher ? lesson.teacherId === userId : selectedDaySchedule.tridaId === userClassId;
        if (!isRelevant) return null;

        const event = eventsData.find(e => isSameDay(parseISO(e.datum), selectedDate) && e.cas === timeSlots[index]?.split('-')[0] && e.nahrazujeHodiny);
        if (event) {
            return { type: 'event', event, period: index }
        }

        const substitution = substitutionsData.find(sub => {
            const subDate = parseISO(sub.date);
            const dayName = format(selectedDate, 'EEEE', { locale: cs });
            return isSameDay(subDate, selectedDate) && sub.originalLesson.day === dayName && sub.originalLesson.period === index && sub.originalLesson.classId === selectedDaySchedule.tridaId;
        });

        if (substitution?.changes.type.includes('zruseno')) {
            return { type: 'cancelled', substitution, period: index };
        }

        if (substitution) {
            const substitutedLesson = { ...lesson, ...substitution.changes };
            if (substitution.changes.teacherId) substitutedLesson.teacherName = "Zástup";
            return { type: 'substituted', original: lesson, substituted: substitutedLesson, period: index };
        }
        
        return { type: 'lesson', lesson, period: index };
    }).filter(item => item !== null && (isTeacher || item.type !== 'empty')) || [];


    const handleLessonClick = (lessonData: any, classId: string) => {
        if(isTeacher) {
            toast({
                title: 'Akce hodiny',
                description: 'Pro zobrazení akcí (např. zápis do třídnice) podržte prst na hodině.',
            })
            return;
        }

        const lesson = lessonData.lesson || lessonData.substituted;
        if (!lesson) return;
        
        const slug = [
            format(selectedDate, 'yyyy-MM-dd'),
            lessonData.period,
            classId,
            lesson.id,
        ];
        router.push(`/dashboard/hodina/${slug.join('/')}`);
    };


    return (
        <div className="flex flex-col h-full bg-background text-foreground p-4 space-y-4">
             {/* Day Selector */}
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

            {/* Schedule List */}
            <div className="flex-1 overflow-y-auto space-y-3">
                {lessonsForDay.length === 0 && (
                    <div className="text-center text-muted-foreground pt-16">
                        Žádné hodiny pro tento den.
                    </div>
                )}
                {lessonsForDay.map((item, idx) => {
                     if (!item || !selectedDaySchedule) return null;
                     const timeRange = timeSlots[item.period];
                     
                     if (item.type === 'lesson' || item.type === 'substituted') {
                        const lesson = item.type === 'substituted' ? item.substituted : item.lesson;
                        const originalLesson = item.type === 'substituted' ? item.original : null;
                        const dayInfo = { fullDate: selectedDate };

                        const lessonGrades = grades?.filter(g => 
                            g.predmet === lesson.subjectName && 
                            g.datum === format(selectedDate, 'dd.MM.yyyy')
                        ) || [];
                        
                        const lessonCard = (
                            <div 
                                key={idx} 
                                className={cn("rounded-lg bg-card border p-3", originalLesson && "border-primary/50")}
                                onClick={() => handleLessonClick(item, selectedDaySchedule.tridaId)}
                            >
                                <div className="flex gap-4">
                                    <div className="text-center w-12 flex-shrink-0">
                                        <p className="font-bold text-lg">{item.period + 1}</p>
                                        <p className="text-xs text-muted-foreground">{timeRange?.split('-')[0]}</p>
                                    </div>
                                    <div className="flex-grow">
                                        <p className="font-semibold">{lesson.subjectName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {lesson.className}
                                        </p>
                                        {originalLesson && (
                                        <p className="text-xs text-primary/80 line-through">
                                                Původně: {originalLesson.subjectShortcut} s {originalLesson.teacherName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {lessonGrades.length > 0 && (
                                    <div className="mt-2 pt-2 border-t flex items-center gap-3">
                                        <Award className="h-4 w-4 text-primary" />
                                        <div className="flex flex-wrap gap-2">
                                            {lessonGrades.map((grade, gIdx) => (
                                                <div key={gIdx} className="flex items-baseline">
                                                    <span className="font-bold text-primary text-lg">{grade.znamka}</span>
                                                    <span className="text-xs text-muted-foreground ml-0.5">({grade.vaha})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );

                        return isTeacher ? (
                            <TeacherLessonContextMenu key={idx} lesson={lesson} dayInfo={dayInfo} period={item.period} classId={selectedDaySchedule.tridaId}>
                                {lessonCard}
                            </TeacherLessonContextMenu>
                        ) : lessonCard;
                     }
                     if (item.type === 'event') {
                        return (
                             <div key={idx} className="flex gap-4 p-3 rounded-lg bg-card border border-accent">
                               <div className="text-center w-12 flex-shrink-0">
                                    <p className="font-bold text-lg">{item.period + 1}</p>
                                    <p className="text-xs text-muted-foreground">{timeRange?.split('-')[0]}</p>
                                </div>
                                <div className="flex-grow">
                                    <p className="font-semibold">{item.event.nazev}</p>
                                    <Badge variant="outline" className="mt-1 border-accent text-accent">{item.event.typ}</Badge>
                                </div>
                            </div>
                        )
                     }
                      if (item.type === 'cancelled') {
                        return (
                             <div key={idx} className="flex gap-4 p-3 rounded-lg bg-card border border-destructive/50">
                               <div className="text-center w-12 flex-shrink-0">
                                    <p className="font-bold text-lg">{item.period + 1}</p>
                                    <p className="text-xs text-muted-foreground">{timeRange?.split('-')[0]}</p>
                                </div>
                                <div className="flex-grow">
                                    <p className="font-semibold text-destructive line-through">
                                        {item.substitution.originalLesson.lessonBlock.subjectName}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Hodina odpadá</p>
                                </div>
                            </div>
                        )
                     }
                     return null;
                })}
            </div>
        </div>
    );
}
