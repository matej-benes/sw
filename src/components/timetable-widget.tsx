'use client';
import React from 'react';
import { cn } from "@/lib/utils";
import type { Timetable, Lesson } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const timeSlots = [
    "07:55 - 08:40", "08:55 - 09:40", "09:55 - 10:40", "10:45 - 11:30",
    "11:35 - 12:20", "12:30 - 13:15", "13:20 - 14:05", "14:15 - 15:00",
    "15:05 - 15:50", "15:55 - 16:40"
];

const dayMapping: { [key: string]: { short: string; date: string } } = {
    'Středa': { short: 'St', date: '1.9.' },
    'Čtvrtek': { short: 'Čt', date: '2.9.' },
    'Pondělí': { short: 'Po', date: '30.8.' },
    'Úterý': { short: 'Út', date: '31.8.' },
    'Pátek': { short: 'Pá', date: '3.9.' },
};

function LessonTooltipContent({ lesson, day, period }: { lesson: Lesson, day: string, period: number }) {
    return (
        <div className="p-2 text-sm">
            <h3 className="font-bold text-base mb-2">{lesson.subject}</h3>
            <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Předmět:</span>
                <span>{lesson.subject}</span>

                <span className="text-muted-foreground">Učitel:</span>
                <span>{lesson.teacher || 'N/A'}</span>

                <span className="text-muted-foreground">Učebna:</span>
                <span>{lesson.room}</span>

                <span className="text-muted-foreground">Den (vyuč. hodina):</span>
                <span>{day.substring(0,2)} {dayMapping[day]?.date || ''} ({period})</span>

                <span className="text-muted-foreground">Komentář:</span>
                <span>-</span>
            </div>
        </div>
    )
}

function LessonContextMenu({ children, lesson }: { children: React.ReactNode, lesson: Lesson }) {
    const router = useRouter();

    const handleClassBookEntry = () => {
        // Assuming lesson has a unique ID. If not, we might need to generate one.
        const lessonId = `${lesson.class}-${lesson.subject}-${lesson.time}`.replace(/[^a-zA-Z0-9]/g, '-');
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


function LessonBlock({ lesson, isTeacher, day, period }: { lesson: Lesson; isTeacher: boolean, day: string, period: number }) {
    const getSubjectColor = (subject: string) => {
        let hash = 0;
        for (let i = 0; i < subject.length; i++) {
            hash = subject.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, 60%, 85%)`;
    };

    const blockContent = (
         <div 
            className="h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer"
            style={{ backgroundColor: getSubjectColor(lesson.subject) }}
        >
            <div className="font-bold">{lesson.subject}</div>
            <div>{isTeacher ? lesson.class : lesson.teacher}</div>
            <div className="text-muted-foreground">{lesson.room}</div>
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

export function TimetableWidget({ timetableData, isTeacher, studentName, teacherName, className }: { timetableData: Timetable, isTeacher: boolean, studentName: string, teacherName: string, className: string }) {
    
    const days = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];

    const findLesson = (day: string, time: string) => {
        const lessons = timetableData[day];
        if (!lessons) return null;
        
        const [start] = time.split(' - ');

        return lessons.find(lesson => lesson.time.startsWith(start.trim()));
    }

    return (
        <div>
            <div className="grid grid-cols-[auto_repeat(10,1fr)] border-t border-l border-border">
                {/* Header */}
                <div className="border-b border-r border-border"></div>
                {timeSlots.map((time, index) => (
                    <div key={index} className="p-2 text-center bg-muted/50 border-b border-r border-border">
                        <div className="font-bold">{index + 1}</div>
                        <div className="text-xs text-muted-foreground">{time}</div>
                    </div>
                ))}

                {/* Body */}
                {days.map(day => (
                    <React.Fragment key={day}>
                        <div className="flex flex-col items-center justify-center p-2 bg-muted/50 border-b border-r border-border">
                           <div className="font-bold">{dayMapping[day]?.short || day.substring(0,2)}</div>
                           <div className="text-xs text-muted-foreground">{dayMapping[day]?.date || ''}</div>
                        </div>
                        {timeSlots.map((time, index) => {
                            const lesson = findLesson(day, time);
                            return (
                                <div key={index} className="p-0.5 border-b border-r border-border min-h-[60px]">
                                    {lesson ? (
                                        <LessonBlock lesson={lesson} isTeacher={isTeacher} day={day} period={index + 1}/>
                                    ) : (
                                        isTeacher ? (
                                            <EmptySlotContextMenu>
                                                <div className="h-full w-full cursor-pointer"></div>
                                            </EmptySlotContextMenu>
                                        ) : (
                                            <div className="h-full w-full"></div>
                                        )
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
