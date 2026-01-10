'use client';
import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution } from "@/lib/types";
import { format, getDay, isSameDay, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

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
    userClassId?: string;
    days: Date[];
}

export function MobileTimetable({
    schedules,
    eventsData,
    substitutionsData,
    isTeacher,
    userId,
    userClassId,
    days,
}: MobileTimetableProps) {
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState(today);

    const timeSlots = schedules[0]?.timeSlots || defaultTimeSlots;
    
    const selectedDaySchedule = schedules.find(s => isSameDay(parseISO(s.datum), selectedDate));
    
    const lessonsForDay = selectedDaySchedule?.hodiny.map((lesson, index) => {
        if (!lesson) return null;

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
    }).filter(Boolean) || [];

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
                     if (!item) return null;
                     const timeRange = timeSlots[item.period];
                     const [startTime, endTime] = timeRange ? timeRange.split('-') : ['',''];
                     
                     if (item.type === 'lesson' || item.type === 'substituted') {
                        const lesson = item.type === 'substituted' ? item.substituted : item.lesson;
                        const originalLesson = item.type === 'substituted' ? item.original : null;
                        
                        return (
                             <div key={idx} className={cn("flex gap-4 p-3 rounded-lg bg-card border", originalLesson && "border-primary/50")}>
                                <div className="text-center w-12 flex-shrink-0">
                                    <p className="font-bold text-lg">{item.period + 1}</p>
                                    <p className="text-xs text-muted-foreground">{startTime}</p>
                                    <div className="h-1 w-2 mx-auto my-0.5 bg-border"></div>
                                    <p className="text-xs text-muted-foreground">{endTime}</p>
                                </div>
                                <div className="flex-grow">
                                    <p className="font-semibold">{lesson.subjectName}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {isTeacher ? lesson.className : lesson.teacherName} | {lesson.ucebnaName || 'N/A'}
                                    </p>
                                    {originalLesson && (
                                       <p className="text-xs text-primary/80 line-through">
                                            Původně: {originalLesson.subjectShortcut} s {originalLesson.teacherName}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                     }
                     if (item.type === 'event') {
                        return (
                             <div key={idx} className="flex gap-4 p-3 rounded-lg bg-card border border-accent">
                               <div className="text-center w-12 flex-shrink-0">
                                    <p className="font-bold text-lg">{item.period + 1}</p>
                                    <p className="text-xs text-muted-foreground">{startTime}</p>
                                    <div className="h-1 w-2 mx-auto my-0.5 bg-border"></div>
                                    <p className="text-xs text-muted-foreground">{endTime}</p>
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
                                    <p className="text-xs text-muted-foreground">{startTime}</p>
                                    <div className="h-1 w-2 mx-auto my-0.5 bg-border"></div>
                                    <p className="text-xs text-muted-foreground">{endTime}</p>
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
