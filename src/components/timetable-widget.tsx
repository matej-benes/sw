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
import { useIsMobile } from '@/hooks/use-mobile';


const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
];

const dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

type DayMappingInfo = { short: string; date: string; fullDate: Date };


function LessonTooltipContent({ lesson, dayInfo, period }: { lesson: LessonBlock, dayInfo: DayMappingInfo, period: number }) {
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
                <span>{dayInfo.short} {dayInfo.date} ({period})</span>

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

function LessonContextMenu({ children, lesson, dayInfo, period, classId }: { children: React.ReactNode, lesson: LessonBlock, dayInfo: DayMappingInfo, period: number, classId: string }) {
    const router = useRouter();
    
    const handleNavigation = (path: string, params: Record<string, string>) => {
        const query = new URLSearchParams(params).toString();
        router.push(`${path}?${query}`);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onContextMenu={(e) => e.preventDefault()}>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/tridni-kniha/zapis', {
                    tridaId: lesson.classId,
                    datum: format(dayInfo.fullDate, 'yyyy-MM-dd'),
                    hodina: (period).toString(),
                    predmetId: lesson.subjectId,
                })}>Zapsat do třídní knihy</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/hodnoceni/nove', {
                     tridaId: lesson.classId,
                    predmetId: lesson.subjectId,
                    datum: format(dayInfo.fullDate, 'yyyy-MM-dd'),
                    hodina: period.toString()
                })}>Nové hodnocení</DropdownMenuItem>
                <DropdownMenuItem>Probrané učivo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/poznamky-zaka')}>Poznámka dítěte/žáka/studenta do třídní knihy</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Informace k výuce</DropdownMenuItem>
                <DropdownMenuItem>Přiložit výukový zdroj</DropdownMenuItem>
                <DropdownMenuItem>Odeslat zprávu</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/ukoly', {
                    tridaId: lesson.classId,
                    predmetId: lesson.subjectId,
                    datumZadani: format(dayInfo.fullDate, 'yyyy-MM-dd'),
                })}>Nový domácí úkol</DropdownMenuItem>
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


function LessonBlockCmp({ lesson, isTeacher, dayInfo, period, classId, isSubstituted = false, substitutionNote }: { lesson: LessonBlock; isTeacher: boolean, dayInfo: DayMappingInfo, period: number, classId: string, isSubstituted?: boolean, substitutionNote?: string }) {
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
            <div className="text-muted-foreground">{lesson.ucebnaName}</div>
        </div>
    );
    
    const interactiveBlock = isTeacher ? (
        <LessonContextMenu lesson={lesson} dayInfo={dayInfo} period={period} classId={classId}>{blockContent}</LessonContextMenu>
    ) : blockContent;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{interactiveBlock}</TooltipTrigger>
                <TooltipContent>
                    <LessonTooltipContent lesson={lesson} dayInfo={dayInfo} period={period} />
                     {substitutionNote && <p className="mt-2 p-2 border-t text-sm">Pozn. k supl.: {substitutionNote}</p>}
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

export function TimetableWidget({ schedules, eventsData, substitutionsData, isTeacher, userId, userClassId, days }: { schedules: Rozvrh[], eventsData: Udalost[], substitutionsData: Substitution[], isTeacher: boolean, userId: string, userClassId?: string, days: Date[] }) {
    const isMobile = useIsMobile();
    const router = useRouter();
    
    if (isMobile) {
        return null; // Don't render on mobile, MobileTimetable will be used instead
    }
    
    const timeSlots = schedules[0]?.timeSlots || defaultTimeSlots;
    
    const findEventForCell = (dayDate: Date, periodIndex: number) => {
        return eventsData.find(event => {
            const eventDate = parseISO(event.datum);
            const isSame = isSameDay(eventDate, dayDate);
            if (!isSame) return false;
            
            const lessonStartTime = timeSlots[periodIndex]?.split('-')[0];
            return event.cas === lessonStartTime;
        });
    };
    
    const findSubstitutionForCell = (dayDate: Date, periodIndex: number, classId: string) => {
         return substitutionsData.find(sub => {
             const subDate = parseISO(sub.date);
             const dayName = dayNames[getDay(dayDate)];
             const isSame = isSameDay(subDate, dayDate);
             return isSame && sub.originalLesson.day === dayName && sub.originalLesson.period === periodIndex && sub.originalLesson.classId === classId;
        })
    };


    const getLessonForCell = (dayDate: Date, periodIndex: number) => {
        if (!schedules) return null;
        
        for (const schedule of schedules) {
            const scheduleDate = parseISO(schedule.datum);
            if (isSameDay(scheduleDate, dayDate)) {
                 const lesson = schedule.hodiny[periodIndex];
                 if (lesson) {
                     if (isTeacher) {
                         if (lesson.teacherId === userId) return { lesson, classId: schedule.tridaId };
                     } else {
                         if (schedule.tridaId === userClassId) return { lesson, classId: schedule.tridaId };
                     }
                 }
            }
        }

        return null;
    };
    
    const handleCellClick = (isTeacher: boolean, lessonInfo: any, dayDate: Date, periodIndex: number) => {
        if(isTeacher || !lessonInfo?.lesson || !lessonInfo?.classId) return;

        const slug = [
            format(dayDate, 'yyyy-MM-dd'),
            periodIndex,
            lessonInfo.classId,
            lessonInfo.lesson.id
        ];
        router.push(`/dashboard/hodina/${slug.join('/')}`);
    }


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
                {days.map(dayDate => {
                    const dayInfo: DayMappingInfo = {
                        short: format(dayDate, 'EEEEEE', { locale: cs }),
                        date: format(dayDate, 'd.M.'),
                        fullDate: dayDate,
                    };
                    
                    return (
                        <React.Fragment key={dayDate.toISOString()}>
                            <div className="flex flex-col items-center justify-center p-2 bg-muted/50 border-b border-r border-border">
                               <div className="font-bold">{dayInfo.short}</div>
                               <div className="text-xs text-muted-foreground">{dayInfo.date}</div>
                            </div>
                            {timeSlots.map((_, periodIndex) => {
                                const lessonInfo = getLessonForCell(dayDate, periodIndex);
                                const lesson = lessonInfo?.lesson;
                                const classId = lessonInfo?.classId;
                                
                                const event = findEventForCell(dayDate, periodIndex);
                                const substitution = lesson && classId ? findSubstitutionForCell(dayDate, periodIndex, classId) : null;
                                
                                const isCancelledByEvent = event && event.nahrazujeHodiny;

                                const isSubstituted = !!substitution;
                                const isCancelledBySub = substitution?.changes.type.includes('zruseno');

                                let substitutedLesson: LessonBlock | null = null;
                                if (isSubstituted && !isCancelledBySub && lesson) {
                                    // This is a simplified representation. A full implementation would fetch new teacher/subject names.
                                    substitutedLesson = { ...lesson, ...substitution!.changes };
                                    if (substitution!.changes.teacherId) substitutedLesson.teacherName = "Zástup"; // Placeholder
                                }


                                return (
                                    <div key={periodIndex} className="p-0.5 border-b border-r border-border min-h-[70px] relative" onClick={() => handleCellClick(isTeacher, lessonInfo, dayDate, periodIndex)}>
                                        {isCancelledByEvent ? (
                                             <EventBlock event={event!} />
                                        ) : isCancelledBySub && substitution ? (
                                            <CancelledLessonBlock substitution={substitution} />
                                        ) : (
                                            <>
                                                {lesson && dayInfo && classId && (
                                                    <LessonBlockCmp lesson={lesson} isTeacher={isTeacher} dayInfo={dayInfo} period={periodIndex + 1} classId={classId} isSubstituted={isSubstituted}/>
                                                )}
                                                {substitutedLesson && dayInfo && classId && (
                                                    <div className="absolute inset-0.5">
                                                        <LessonBlockCmp lesson={substitutedLesson} isTeacher={isTeacher} dayInfo={dayInfo} period={periodIndex + 1} classId={classId} substitutionNote={substitution?.changes.note}/>
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
                    )
                })}
            </div>
        </div>
    );
}
