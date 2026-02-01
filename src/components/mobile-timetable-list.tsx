'use client';
import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, ZapisHodiny, User, Predmet } from "@/lib/types";
import { useRouter } from 'next/navigation';
import { format, parseISO, isSameDay } from 'date-fns';
import { BookOpen, Info, XCircle, ChevronRight, PencilRuler, Pencil, StickyNote } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

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
                isSubstituting && "bg-destructive/90 text-destructive-foreground border-destructive"
            )}
        >
            <div className={cn("flex flex-col items-center w-12", isSubstituted && "opacity-50")}>
                <span className="text-2xl font-bold">{period}</span>
                <span className="text-xs">{time.replace('-', '\n')}</span>
            </div>
            <div className={cn("flex-grow", isSubstituted && "line-through opacity-50")}>
                 <div className="flex items-center gap-2">
                    {isSubstituting && <Badge variant="secondary" className="bg-white text-destructive font-bold">Supl</Badge>}
                    <p className="font-semibold text-lg">{lesson.subjectName}</p>
                </div>
                <p className="text-sm">{lesson.className} | {lesson.ucebnaName || 'N/A'}</p>
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
    
    const items = hodiny.flatMap((lesson, index) => {
        const time = timeSlots[index] || '';
        const period = index + 1;
        const keyPrefix = `${day.toISOString()}-${index}`;

        const event = eventsData.find(e => {
            const eventDate = parseISO(e.datum);
            return isSameDay(eventDate, day) && e.cas === time.split('-')[0];
        });

        if (event && event.nahrazujeHodiny) {
            return [<EventListItem key={`event-${keyPrefix}`} event={event} />];
        }
        
        if (!lesson) return [];
        
        const substitution = substitutionsData.find(sub => {
             const subDate = parseISO(sub.date);
             return isSameDay(subDate, day) && sub.originalLesson.period === index && sub.originalLesson.classId === dailySchedule.tridaId;
        });
        
        const zapis = zapisyData.find(z => z.datum === format(day, 'yyyy-MM-dd') && parseInt(z.hodina) === period);

        if (substitution) {
            if (substitution.changes.type.includes('zruseno')) {
                return [<CancelledLessonItem key={`sub-cancelled-${keyPrefix}`} substitution={substitution} period={period} time={time}/>];
            }

            const newTeacher = teachers.find(t => t.id === substitution!.changes.teacherId);
            const newSubject = subjects.find(s => s.id === substitution!.changes.subjectId);
            
            const finalLesson: LessonBlock = {
                ...lesson,
                teacherId: newTeacher ? newTeacher.id : lesson.teacherId,
                teacherName: newTeacher ? newTeacher.name : lesson.teacherName,
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
        <>
            <div className="space-y-3">
                {items.filter(Boolean).length > 0 ? items.flat() : <p className="text-center text-muted-foreground py-8">Dnes není žádná výuka.</p>}
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
