'use client';

import { cn } from "@/lib/utils";
import type { Timetable } from "@/lib/types";

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

export function TimetableWidget({ timetableData, isTeacher, studentName, teacherName, className }: { timetableData: Timetable, isTeacher: boolean, studentName: string, teacherName: string, className: string }) {
    
    const days = ['Středa', 'Čtvrtek'];

    const findLesson = (day: string, time: string) => {
        const lessons = timetableData[day];
        if (!lessons) return null;
        
        const [start] = time.split(' - ');

        return lessons.find(lesson => lesson.time.startsWith(start));
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span><span className="font-semibold text-foreground">Třída:</span> {className}</span>
                {!isTeacher && <span><span className="font-semibold text-foreground">Žák/Student:</span> {studentName}</span>}
                <span><span className="font-semibold text-foreground">Třídní učitel:</span> {teacherName}</span>
            </div>
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
                           <div className="font-bold">{dayMapping[day]?.short || ''}</div>
                           <div className="text-xs text-muted-foreground">{dayMapping[day]?.date || ''}</div>
                        </div>
                        {timeSlots.map((time, index) => {
                            const lesson = findLesson(day, time);
                            return (
                                <div key={index} className="p-1 border-b border-r border-border min-h-[60px]">
                                    {lesson && (
                                        <div className="flex flex-col h-full items-center justify-center text-center rounded-md p-1 bg-accent/20 border border-accent text-accent-foreground text-xs">
                                            <span className="font-bold text-sm">{lesson.subject}</span>
                                            <span>{isTeacher ? lesson.class : lesson.teacher}</span>
                                            <span className="text-muted-foreground/80">{lesson.room}</span>
                                        </div>
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
