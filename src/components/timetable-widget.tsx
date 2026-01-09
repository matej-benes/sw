'use client';
import React from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, Info, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, getDay, parse, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cs } from 'date-fns/locale';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
];
const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];

const generateDayMapping = () => {
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const mapping: { [key: string]: { short: string; date: string; dayIndex: number, fullDate: Date } } = {};

    daysOfWeek.forEach((day, index) => {
        const date = addDays(monday, index);
        mapping[day] = {
            short: format(date, 'E', { locale: cs }),
            date: format(date, 'd.M.'),
            dayIndex: index + 1,
            fullDate: date,
        };
    });
    return mapping;
}

const dayMapping = generateDayMapping();


function LessonTooltipContent({ lesson, day, period }: { lesson: LessonBlock, day: string, period: number }) {
    const dayInfo = Object.values(dayMapping).find(d => d.short === day.substring(0,2));
    return (
        <div className="p-2 text-sm">
            <h3 className="font-bold text-base mb-2">{lesson.subjectName}</h3>
            <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Předmět:</span>
                <span>{lesson.subjectName} ({lesson.subjectShortcut})</span>

                <span className="text-muted-foreground">Učitel:</span>
                <span>{lesson.teacherName || 'N/A'}</span>

                <span className="text-muted-foreground">Třída:</span>
                <span>{lesson.className}</span>

                <span className="text-muted-foreground">Den (vyuč. hodina):</span>
                <span>{day.substring(0,2)} {dayInfo?.date || ''} ({period})</span>

                <span className="text-muted-foreground">Komentář:</span>
                <span>-</span>
            </div>
        </div>
    )
}

function EventTooltipContent({ event }: { event: Udalost }) {
    return (
        <div className="p-2 text-sm">
            <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-accent" />
                <h3 className="font-bold text-base">{event.nazev}</h3>
            </div>
            <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Typ:</span>
                <span>{event.typ}</span>

                <span className="text-muted-foreground">Datum:</span>
                <span>{format(parseISO(event.datum), 'PPP', { locale: cs })}</span>
                
                <span className="text-muted-foreground">Čas:</span>
                <span>{event.cas}</span>
            </div>
        </div>
    )
}

function LessonContextMenu({ children, lesson, day, period }: { children: React.ReactNode, lesson: LessonBlock, day: string, period: number }) {
    const router = useRouter();
    const dayInfo = Object.values(dayMapping).find(d => d.short === day.substring(0,2));

    const handleClassBookEntry = () => {
        if (!dayInfo) return;
        const query = new URLSearchParams({
            tridaId: lesson.classId,
            datum: format(dayInfo.fullDate, 'yyyy-MM-dd'),
            hodina: (period).toString(),
            predmetId: lesson.subjectId,
        }).toString();
        router.push(`/dashboard/tridni-kniha/zapis?${query}`);
    }

    const handleNewGrading = () => {
        if(!dayInfo) return;
        const query = new URLSearchParams({
            tridaId: lesson.classId,
            predmetId: lesson.subjectId,
            datum: format(dayInfo.fullDate, 'yyyy-MM-dd'),
            hodina: period.toString()
        }).toString();
        router.push(`/dashboard/hodnoceni/nove?${query}`);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onContextMenu={(e) => e.preventDefault()}>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={handleClassBookEntry}>Zapsat do třídní knihy</DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewGrading}>Nové hodnocení</DropdownMenuItem>
                <DropdownMenuItem>Probrané učivo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/poznamky-zaka')}>Poznámka dítěte/žáka/studenta do třídní knihy</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Informace k výuce</DropdownMenuItem>
                <DropdownMenuItem>Přiložit výukový zdroj</DropdownMenuItem>
                <DropdownMenuItem>Odeslat zprávu</DropdownMenuItem>
                <DropdownMenuItem>Nový domácí úkol</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Vytvořit online schůzku</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function EmptySlotContextMenu({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onContextMenu={(e) => e.preventDefault()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => router.push('/dashboard/udalosti')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Vytvořit událost
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function LessonBlockCmp({ lesson, isTeacher, day, period, isSubstituted = false }: { lesson: LessonBlock; isTeacher: boolean, day: string, period: number, isSubstituted?: boolean }) {
    const getSubjectColor = (subjectId: string) => {
        if (!subjectId) return `hsl(0, 0%, 85%)`;
        let hash = 0;
        for (let i = 0; i < subjectId.length; i++) {
            hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, 60%, 85%)`;
    };

    const blockContent = (
         <div 
            className={cn("h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer", isSubstituted && 'opacity-50 line-through')}
            style={{ backgroundColor: getSubjectColor(lesson.subjectId) }}
        >
            <div className="font-bold">{lesson.subjectShortcut}</div>
            <div>{isTeacher ? lesson.className : lesson.teacherName}</div>
            <div className="text-muted-foreground">{lesson.className}</div>
        </div>
    );
    
    const interactiveBlock = isTeacher ? (
        <LessonContextMenu lesson={lesson} day={day} period={period}>{blockContent}</LessonContextMenu>
    ) : blockContent;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{interactiveBlock}</TooltipTrigger>
                <TooltipContent>
                    <LessonTooltipContent lesson={lesson} day={day} period={period} />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function EventBlock({ event }: { event: Udalost }) {
    const blockContent = (
         <div 
            className="h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer bg-accent/30 border border-dashed border-accent"
        >
            <div className="font-bold">{event.nazev}</div>
            <div className="text-muted-foreground">{event.cas}</div>
        </div>
    );
    
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{blockContent}</TooltipTrigger>
                <TooltipContent>
                    <EventTooltipContent event={event} />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function CancelledLessonBlock({ substitution }: { substitution: Substitution }) {
     const blockContent = (
         <div 
            className="h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer bg-destructive/10 border border-dashed border-destructive"
        >
             <XCircle className="h-4 w-4 text-destructive mb-1" />
            <div className="font-bold text-destructive">Odpadá</div>
            <div className="text-muted-foreground text-xs">{substitution.originalLesson.lessonBlock.subjectShortcut}</div>
        </div>
    );

     return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{blockContent}</TooltipTrigger>
                <TooltipContent>
                   <div className="p-2 text-sm">
                        <h3 className="font-bold text-base mb-2 text-destructive">Zrušená hodina</h3>
                        <p>Hodina předmětu {substitution.originalLesson.lessonBlock.subjectName} byla zrušena.</p>
                        {substitution.changes.note && <p className="mt-1">Poznámka: {substitution.changes.note}</p>}
                   </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export function TimetableWidget({ schedules, eventsData, substitutionsData, isTeacher, userId }: { schedules: Rozvrh[], eventsData: Udalost[], substitutionsData: Substitution[], isTeacher: boolean, userId: string }) {
    
    const timeSlots = schedules[0]?.timeSlots || defaultTimeSlots;
    
    const findEventForCell = (day: string, periodIndex: number) => {
        const dayInfo = dayMapping[day];
        if (!dayInfo) return null;

        return eventsData.find(event => {
            const eventDate = parseISO(event.datum);
            const isSame = isSameDay(eventDate, dayInfo.fullDate);
            if (!isSame) return false;
            
            const lessonStartTime = timeSlots[periodIndex]?.split('-')[0];
            return event.cas === lessonStartTime;
        });
    };
    
    const findSubstitutionForCell = (day: string, periodIndex: number, classId: string) => {
        const dayInfo = dayMapping[day];
        if (!dayInfo) return null;

        return substitutionsData.find(sub => {
             const subDate = parseISO(sub.date);
             const isSame = isSameDay(subDate, dayInfo.fullDate);
             return isSame && sub.originalLesson.day === day && sub.originalLesson.period === periodIndex && sub.originalLesson.classId === classId;
        })
    };


    const getLessonForCell = (day: string, periodIndex: number) => {
        if (!schedules) return null;

        for (const schedule of schedules) {
            const lesson = schedule.scheduleData?.[day]?.[periodIndex];
            if (lesson) {
                 if (isTeacher) {
                    if (lesson.teacherId === userId) return { lesson, classId: schedule.id };
                } else {
                    // For students/parents, we need to check if they are part of the class for this lesson
                    if(schedule.id === userId) return { lesson, classId: schedule.id };
                }
            }
        }
        return null;
    };


    return (
        <div>
            <div className={cn("grid border-t border-l border-border", `grid-cols-[auto_repeat(${timeSlots.length},1fr)]`)}
              style={{ gridTemplateColumns: `auto repeat(${timeSlots.length}, 1fr)`}}
            >
                {/* Header */}
                <div className="border-b border-r border-border"></div>
                {timeSlots.map((time, index) => (
                    <div key={index} className="p-2 text-center bg-muted/50 border-b border-r border-border">
                        <div className="font-bold">{index + 1}</div>
                        <div className="text-xs text-muted-foreground">{time}</div>
                    </div>
                ))}

                {/* Body */}
                {daysOfWeek.map(day => (
                    <React.Fragment key={day}>
                        <div className="flex flex-col items-center justify-center p-2 bg-muted/50 border-b border-r border-border">
                           <div className="font-bold">{dayMapping[day]?.short || day.substring(0,2)}</div>
                           <div className="text-xs text-muted-foreground">{dayMapping[day]?.date || ''}</div>
                        </div>
                        {timeSlots.map((_, periodIndex) => {
                            const lessonInfo = getLessonForCell(day, periodIndex);
                            const lesson = lessonInfo?.lesson;
                            
                            const event = findEventForCell(day, periodIndex);
                            const substitution = lesson ? findSubstitutionForCell(day, periodIndex, lesson.classId) : null;
                            
                            const isCancelledByEvent = event && event.nahrazujeHodiny;

                            const isSubstituted = !!substitution;
                            const isCancelledBySub = substitution?.changes.type.includes('zruseno');

                            let substitutedLesson: LessonBlock | null = null;
                            if (isSubstituted && !isCancelledBySub) {
                                // This is a simplified representation. A full implementation would fetch new teacher/subject names.
                                substitutedLesson = { ...lesson!, ...substitution!.changes };
                                if (substitution!.changes.teacherId) substitutedLesson.teacherName = "Zástup"; // Placeholder
                            }


                            return (
                                <div key={periodIndex} className="p-0.5 border-b border-r border-border min-h-[70px] relative">
                                    {isCancelledByEvent ? (
                                         <EventBlock event={event!} />
                                    ) : isCancelledBySub && substitution ? (
                                        <CancelledLessonBlock substitution={substitution} />
                                    ) : (
                                        <>
                                            {lesson && (
                                                <LessonBlockCmp lesson={lesson} isTeacher={isTeacher} day={day} period={periodIndex + 1} isSubstituted={isSubstituted}/>
                                            )}
                                            {substitutedLesson && (
                                                <div className="absolute inset-0.5">
                                                    <LessonBlockCmp lesson={substitutedLesson} isTeacher={isTeacher} day={day} period={periodIndex + 1} />
                                                </div>
                                            )}
                                            
                                            {!lesson && !event && isTeacher && (
                                                <EmptySlotContextMenu>
                                                    <div className="h-full w-full cursor-pointer"></div>
                                                </EmptySlotContextMenu>
                                            )}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
