'use client';
import React from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, getDay, parseISO, startOfWeek, addDays } from 'date-fns';
import { cs } from 'date-fns/locale';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
];
const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];

const generateDayMapping = () => {
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const mapping: { [key: string]: { short: string; date: string; dayIndex: number } } = {};

    daysOfWeek.forEach((day, index) => {
        const date = addDays(monday, index);
        mapping[day] = {
            short: format(date, 'E', { locale: cs }),
            date: format(date, 'd.M.'),
            dayIndex: index + 1
        };
    });
    return mapping;
}

const dayMapping = generateDayMapping();


function LessonTooltipContent({ lesson, day, period }: { lesson: LessonBlock, day: string, period: number }) {
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
                <span>{day.substring(0,2)} {dayMapping[day]?.date || ''} ({period})</span>

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
                <span>{format(new Date(event.datum), 'PPP', { locale: cs })}</span>
                
                <span className="text-muted-foreground">Čas:</span>
                <span>{event.cas}</span>
            </div>
        </div>
    )
}

function LessonContextMenu({ children, lesson }: { children: React.ReactNode, lesson: LessonBlock }) {
    const router = useRouter();

    const handleClassBookEntry = () => {
        const lessonId = `${lesson.classId}-${lesson.subjectId}-${lesson.id}`.replace(/[^a-zA-Z0-9]/g, '-');
        router.push(`/dashboard/tridni-kniha/${lessonId}`);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onContextMenu={(e) => e.preventDefault()}>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={handleClassBookEntry}>Zapsat do třídní knihy</DropdownMenuItem>
                <DropdownMenuItem>Nové hodnocení</DropdownMenuItem>
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


function LessonBlock({ lesson, isTeacher, day, period }: { lesson: LessonBlock; isTeacher: boolean, day: string, period: number }) {
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
            className="h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer"
            style={{ backgroundColor: getSubjectColor(lesson.subjectId) }}
        >
            <div className="font-bold">{lesson.subjectShortcut}</div>
            <div>{isTeacher ? lesson.className : lesson.teacherName}</div>
            <div className="text-muted-foreground">{lesson.className}</div>
        </div>
    );
    
    const interactiveBlock = isTeacher ? (
        <LessonContextMenu lesson={lesson}>{blockContent}</LessonContextMenu>
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

export function TimetableWidget({ schedules, eventsData, isTeacher, userId }: { schedules: Rozvrh[], eventsData: Udalost[], isTeacher: boolean, userId: string }) {
    
    // Use the timeslots from the first schedule as a reference, or default.
    const timeSlots = schedules[0]?.timeSlots || defaultTimeSlots;
    
    const findEvent = (day: string, time: string) => {
        const dayIndex = dayMapping[day]?.dayIndex;
        if (dayIndex === undefined) return null;

        return eventsData.find(event => {
            const eventDate = new Date(event.datum + 'T12:00:00');
            let eventDayIndex = getDay(eventDate); 
            if (eventDayIndex === 0) eventDayIndex = 7; 

            // This is still placeholder logic and needs a real calendar to be accurate
            const isSameDay = true; 

            const [timeStart] = time.split(' - ');
            return isSameDay && event.cas.startsWith(timeStart.trim());
        });
    }

    const getLessonForCell = (day: string, periodIndex: number) => {
        if (!schedules) return null;

        for (const schedule of schedules) {
            const lesson = schedule.scheduleData?.[day]?.[periodIndex];
            if (lesson) {
                 if (isTeacher) {
                    // For teachers, only return the lesson if they are the teacher
                    if (lesson.teacherId === userId) {
                        return lesson;
                    }
                } else {
                    // For students, return the lesson of their class
                    return lesson;
                }
            }
        }
        return null;
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
                {daysOfWeek.map(day => (
                    <React.Fragment key={day}>
                        <div className="flex flex-col items-center justify-center p-2 bg-muted/50 border-b border-r border-border">
                           <div className="font-bold">{dayMapping[day]?.short || day.substring(0,2)}</div>
                           <div className="text-xs text-muted-foreground">{dayMapping[day]?.date || ''}</div>
                        </div>
                        {timeSlots.map((time, periodIndex) => {
                            const lesson = getLessonForCell(day, periodIndex);
                            const event = findEvent(day, time);

                            return (
                                <div key={periodIndex} className="p-0.5 border-b border-r border-border min-h-[70px] relative">
                                    {lesson && <LessonBlock lesson={lesson} isTeacher={isTeacher} day={day} period={periodIndex + 1}/>}
                                    {event && <EventBlock event={event} />}
                                    {!lesson && !event && isTeacher && (
                                        <EmptySlotContextMenu>
                                            <div className="h-full w-full cursor-pointer"></div>
                                        </EmptySlotContextMenu>
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
