'use client';
import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, ZapisHodiny } from "@/lib/types";
import { useRouter } from 'next/navigation';
import { format, parseISO, isSameDay } from 'date-fns';
import { BookOpen, Info, XCircle, ChevronRight, PencilRuler, Pencil, StickyNote } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function LessonActionSheet({ lesson, period, time, day, isOpen, onOpenChange, isTeacher }: { lesson: LessonBlock | null, period: number, time: string, day: Date, isOpen: boolean, onOpenChange: (isOpen: boolean) => void, isTeacher: boolean }) {
    const router = useRouter();

    if (!lesson) return null;

    const handleNavigation = (path: string, params: Record<string, string>) => {
        const query = new URLSearchParams(params).toString();
        router.push(`${path}?${query}`);
        onOpenChange(false);
    }
    
    const navigateToDetail = () => {
         if (!lesson.classId) return;
        const slug = [
            format(day, 'yyyy-MM-dd'),
            (period - 1).toString(),
            lesson.classId,
            lesson.id
        ];
        router.push(`/dashboard/hodina/${slug.join('/')}`);
        onOpenChange(false);
    }

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-lg">
                <SheetHeader className="text-left">
                    <SheetTitle className="text-2xl">{lesson.subjectName}</SheetTitle>
                    <SheetDescription>
                        {period}. hodina ({time}) | {lesson.className} | {lesson.ucebnaName || 'N/A'}
                    </SheetDescription>
                </SheetHeader>
                <div className="py-6 grid grid-cols-1 gap-3">
                     {isTeacher && (
                        <>
                            <Button
                                onClick={() => handleNavigation('/dashboard/tridni-kniha/zapis', {
                                    tridaId: lesson.classId,
                                    datum: format(day, 'yyyy-MM-dd'),
                                    hodina: period.toString(),
                                    predmetId: lesson.subjectId,
                                })}
                                className="w-full justify-start h-14 text-base"
                                variant="outline"
                            >
                                <Pencil className="mr-3 h-5 w-5" />
                                Zapsat do třídní knihy
                            </Button>
                             <Button
                                onClick={() => handleNavigation('/dashboard/hodnoceni', {
                                    tridaId: lesson.classId,
                                    predmetId: lesson.subjectId,
                                })}
                                className="w-full justify-start h-14 text-base"
                                variant="outline"
                            >
                                <PencilRuler className="mr-3 h-5 w-5" />
                                Zadat nové hodnocení
                            </Button>
                             <Button
                                onClick={() => router.push('/dashboard/poznamky-zaka')}
                                className="w-full justify-start h-14 text-base"
                                variant="outline"
                            >
                                <StickyNote className="mr-3 h-5 w-5" />
                                Přidat poznámku (chování)
                            </Button>
                            <Separator className="my-2" />
                        </>
                    )}
                     <Button
                        onClick={navigateToDetail}
                        className="w-full justify-start h-14 text-base"
                        variant="ghost"
                    >
                        <Info className="mr-3 h-5 w-5" />
                        Zobrazit detail hodiny
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}


function LessonListItem({
    lesson,
    period,
    time,
    topic,
    onClick,
}: {
    lesson: LessonBlock;
    period: number;
    time: string;
    topic?: string;
    onClick: () => void;
}) {

    return (
        <div 
            onClick={onClick}
            className="flex items-start gap-4 p-3 rounded-lg border bg-card text-card-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
            <div className="flex flex-col items-center w-12">
                <span className="text-2xl font-bold">{period}</span>
                <span className="text-xs text-muted-foreground">{time.replace('-', '\n')}</span>
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-lg">{lesson.subjectName}</p>
                <p className="text-sm text-muted-foreground">{lesson.className} | {lesson.ucebnaName || 'N/A'}</p>
                {topic && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                        <BookOpen className="h-4 w-4" />
                        <span>{topic}</span>
                    </div>
                )}
            </div>
             <div className="self-center">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
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

export function MobileTimetableList({
    dailySchedule,
    eventsData,
    substitutionsData,
    zapisyData,
    isTeacher,
    userId,
    userClassId,
    day,
}: {
    dailySchedule: Rozvrh | null;
    eventsData: Udalost[];
    substitutionsData: Substitution[];
    zapisyData: ZapisHodiny[];
    isTeacher: boolean;
    userId: string;
    userClassId?: string;
    day: Date;
}) {
    const router = useRouter();
    const [selectedLesson, setSelectedLesson] = useState<{ lesson: LessonBlock, period: number, time: string } | null>(null);

    if (!dailySchedule) {
        return <p className="text-center text-muted-foreground py-8">Pro tento den není dostupný žádný rozvrh.</p>;
    }

    const { hodiny, timeSlots } = dailySchedule;

    const handleLessonClick = (lesson: LessonBlock, periodIndex: number) => {
        if (!lesson.classId) return;

        if (isTeacher) {
            setSelectedLesson({
                lesson: lesson,
                period: periodIndex + 1,
                time: timeSlots[periodIndex]
            });
        } else {
            const slug = [
                format(day, 'yyyy-MM-dd'),
                periodIndex.toString(),
                lesson.classId,
                lesson.id
            ];
            router.push(`/dashboard/hodina/${slug.join('/')}`);
        }
    };
    
    const items = hodiny.map((lesson, index) => {
        const time = timeSlots[index] || '';
        const period = index + 1;
        
        // Find events for this specific slot
        const event = eventsData.find(e => {
            const eventDate = parseISO(e.datum);
            return isSameDay(eventDate, day) && e.cas === time.split('-')[0];
        });

        if (event && event.nahrazujeHodiny) {
            return <EventListItem key={`event-${index}`} event={event} />;
        }
        
        if (!lesson) return null; // No lesson in this slot
        
        // Find substitutions
        const substitution = substitutionsData.find(sub => {
             const subDate = parseISO(sub.date);
             const isSame = isSameDay(subDate, day);
             return isSame && sub.originalLesson.period === index && sub.originalLesson.classId === dailySchedule.tridaId;
        });

        if (substitution?.changes.type.includes('zruseno')) {
            return <CancelledLessonItem key={`sub-${index}`} substitution={substitution} period={period} time={time}/>;
        }

        const finalLesson = substitution ? { ...lesson, ...substitution.changes } : lesson;
        
        const zapis = zapisyData.find(z => z.datum === format(day, 'yyyy-MM-dd') && parseInt(z.hodina) === period);
        
        return (
            <LessonListItem 
                key={`lesson-${index}`} 
                lesson={finalLesson} 
                period={period} 
                time={time}
                topic={zapis?.topic}
                onClick={() => handleLessonClick(finalLesson, index)}
            />
        );
    });

    return (
        <>
            <div className="space-y-3">
                {items.filter(Boolean).length > 0 ? items : <p className="text-center text-muted-foreground py-8">Dnes není žádná výuka.</p>}
            </div>
            <LessonActionSheet 
                lesson={selectedLesson?.lesson || null}
                period={selectedLesson?.period || 0}
                time={selectedLesson?.time || ''}
                day={day}
                isOpen={!!selectedLesson}
                onOpenChange={(isOpen) => {
                    if(!isOpen) setSelectedLesson(null);
                }}
                isTeacher={isTeacher}
            />
        </>
    );
}
