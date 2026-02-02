'use client';
import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, ZapisHodiny, Predmet, User } from "@/lib/types";
import { useRouter } from 'next/navigation';
import { format, parseISO, isSameDay } from 'date-fns';
import { BookOpen, Info, XCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


function LessonListItem({
    lesson,
    period,
    time,
    topic,
    onClick,
    isSubstituted,
    isSubstituting,
}: {
    lesson: LessonBlock;
    period: number;
    time: string;
    topic?: string;
    onClick: () => void;
    isSubstituted?: boolean;
    isSubstituting?: boolean;
}) {

    return (
        <div 
            onClick={!isSubstituted ? onClick : undefined}
            className={cn(
                "flex items-start gap-4 p-3 rounded-lg border text-card-foreground transition-colors",
                isSubstituted
                    ? "bg-muted/30 border-dashed text-muted-foreground"
                    : "bg-card cursor-pointer hover:bg-muted/50",
                isSubstituting && "bg-destructive/20 border-destructive"
            )}
        >
            <div className={cn("flex flex-col items-center w-12", isSubstituted && "opacity-50")}>
                <span className="text-2xl font-bold">{period}</span>
                <span className="text-xs">{time.replace('-', '\n')}</span>
            </div>
            <div className={cn("flex-grow", isSubstituted && "line-through opacity-50")}>
                 <div className="flex items-center gap-2">
                    {isSubstituting && <Badge variant="destructive">SUPL</Badge>}
                    <p className="font-semibold text-lg">{lesson.subjectName}</p>
                </div>
                <p className="text-sm">{lesson.className} | {lesson.teacherName} | {lesson.ucebnaName || 'N/A'}</p>
                {topic && !isSubstituted && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                        <BookOpen className="h-4 w-4" />
                        <span>{topic}</span>
                    </div>
                )}
            </div>
             <div className="self-center">
                {!isSubstituted && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
            </div>
        </div>
    );
}

function EventListItem({ event }: { event: Udalost }) {
    return (
        <div className="flex items-start gap-4 p-3 rounded-lg border bg-accent/20 text-accent-foreground">
             <div className="flex flex-col items-center w-12 pt-1">
                <Info className="h-6 w-6" />
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-lg">{event.nazev}</p>
                <p className="text-sm text-muted-foreground">{event.typ} v {event.cas}</p>
            </div>
        </div>
    );
}

function CancelledLessonItem({ substitution, period, time }: { substitution: Substitution; period: number; time: string; }) {
    return (
         <div className="flex items-start gap-4 p-3 rounded-lg border border-dashed border-destructive/50 bg-destructive/10 text-destructive-foreground">
             <div className="flex flex-col items-center w-12">
                <span className="text-2xl font-bold text-destructive">{period}</span>
                <span className="text-xs text-muted-foreground">{time.replace('-', '\n')}</span>
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-lg flex items-center gap-2"><XCircle/>Odpadá</p>
                <p className="text-sm text-muted-foreground line-through">{substitution.originalLesson.lessonBlock.subjectName}</p>
                 {substitution.changes.note && <p className="mt-2 text-xs">Poznámka: {substitution.changes.note}</p>}
            </div>
        </div>
    );
}

// Helper function to safely parse date strings
function safeParseISO(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    try {
        const date = parseISO(dateString);
        if (isNaN(date.getTime())) {
            console.warn(`Invalid date string encountered: ${dateString}`);
            return null; // Invalid date
        }
        return date;
    } catch (e) {
        console.error(`Error parsing date string: ${dateString}`, e);
        return null;
    }
}


export function MobileTimetableList({
    dailySchedule,
    eventsData,
    substitutionsData,
    zapisyData,
    isTeacher,
    userId,
    userClassId,
    day,
    teachers,
    subjects,
}: {
    dailySchedule: Rozvrh | null;
    eventsData: Udalost[];
    substitutionsData: Substitution[];
    zapisyData: ZapisHodiny[];
    isTeacher: boolean;
    userId: string;
    userClassId?: string;
    day: Date;
    teachers: User[];
    subjects: Predmet[];
}) {
    const router = useRouter();

    const handleLessonClick = (lesson: LessonBlock, periodIndex: number) => {
        if (!lesson.classId) return;

        const slug = [
            format(day, 'yyyy-MM-dd'),
            periodIndex.toString(),
            lesson.classId,
            lesson.id
        ];
        router.push(`/dashboard/hodina/${slug.join('/')}`);
    };
    
    if (!dailySchedule) {
        return <p className="text-center text-muted-foreground py-8">Pro tento den není dostupný žádný rozvrh.</p>;
    }

    const { hodiny, timeSlots } = dailySchedule;
    
    const items = hodiny.flatMap((lesson, index) => {
        const time = timeSlots[index] || '';
        const period = index + 1;
        const keyPrefix = `${day.toISOString()}-${index}`;

        const event = eventsData.find(e => {
            const eventDate = safeParseISO(e.datum);
            if (!eventDate) return false;
            return isSameDay(eventDate, day) && e.cas === time.split('-')[0];
        });

        if (event && event.nahrazujeHodiny) {
            return [<EventListItem key={`event-${keyPrefix}`} event={event} />];
        }
        
        if (!lesson) return [];
        
        const substitution = substitutionsData.find(sub => {
             if (!sub.date || !sub.originalLesson) return false;
             const subDate = safeParseISO(sub.date);
             if (!subDate) return false;
             return isSameDay(subDate, day) && sub.originalLesson.period === index && sub.originalLesson.classId === dailySchedule.tridaId;
        });
        
        const zapis = zapisyData.find(z => z.datum === format(day, 'yyyy-MM-dd') && parseInt(z.hodina) === period);

        if (substitution) {
            const isCancelled = Array.isArray(substitution.changes?.type) 
                ? substitution.changes.type.includes('zruseno') 
                : substitution.changes?.type === 'zruseno';
            if (isCancelled) {
                return [<CancelledLessonItem key={`sub-cancelled-${keyPrefix}`} substitution={substitution} period={period} time={time}/>];
            }

            let newTeacherName = lesson.teacherName;
            if (substitution.changes?.teacherIds && substitution.changes.teacherIds.length > 0) {
                newTeacherName = substitution.changes.teacherIds
                    .map(id => teachers.find(t => t.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');
            }
            
            const newSubject = subjects.find(s => s.id === substitution.changes?.subjectId);
            
            const finalLesson: LessonBlock = {
                ...lesson,
                teacherName: newTeacherName,
                teacherId: substitution.changes?.teacherIds?.[0] || lesson.teacherId,
                subjectId: newSubject ? newSubject.id : lesson.subjectId,
                subjectName: newSubject ? newSubject.name : lesson.subjectName,
                subjectShortcut: newSubject ? newSubject.shortcut : lesson.subjectShortcut,
            };

            return [
                <LessonListItem 
                    key={`sub-new-${keyPrefix}`} 
                    lesson={finalLesson} 
                    period={period} 
                    time={time}
                    topic={zapis?.topic}
                    onClick={() => handleLessonClick(finalLesson, index)}
                    isSubstituting
                />,
                <LessonListItem 
                    key={`sub-old-${keyPrefix}`} 
                    lesson={lesson} 
                    period={period} 
                    time={time}
                    onClick={() => {}}
                    isSubstituted
                />
            ];
        }
        
        return [
            <LessonListItem 
                key={`lesson-${keyPrefix}`} 
                lesson={lesson} 
                period={period} 
                time={time}
                topic={zapis?.topic}
                onClick={() => handleLessonClick(lesson, index)}
            />
        ];
    });

    return (
        <div className="space-y-3">
            {items.flat().length > 0 ? items.flat() : <p className="text-center text-muted-foreground py-8">Dnes není žádná výuka.</p>}
        </div>
    );
}
