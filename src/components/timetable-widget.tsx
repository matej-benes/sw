'use client';
import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, User, Predmet } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Info, XCircle, VenetianMask, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, getDay, parse, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Button } from './ui/button';
import { useFirestore, setDocumentNonBlocking, useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, getDocs, query, collection, limit } from 'firebase/firestore';
import { Badge } from './ui/badge';


const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
];

const dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

type DayMappingInfo = { short: string; date: string; fullDate: Date };


function SubstitutionDialog({
    isOpen,
    onOpenChange,
    lessonInfo,
    teachers,
    subjects,
    onSave,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    lessonInfo: { lesson: LessonBlock; dayInfo: DayMappingInfo; period: number; classId: string } | null;
    teachers: User[];
    subjects: Predmet[];
    onSave: (subData: any) => void;
}) {
    const [subType, setSubType] = useState('suplovat');
    const [subTeacherId, setSubTeacherId] = useState('');
    const [subSubjectId, setSubSubjectId] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen && lessonInfo) {
            setSubType('suplovat');
            setSubTeacherId('');
            setSubSubjectId(lessonInfo.lesson.subjectId);
            setNote('');
        }
    }, [isOpen, lessonInfo]);

    const handleSave = () => {
        if (!lessonInfo) return;

        let changes: any = {};
        let type: string[] = [];

        if (subType === 'odpada') {
            type.push('zruseno');
            changes = { type, note };
        } else {
            if (subTeacherId && subTeacherId !== lessonInfo.lesson.teacherId) {
                type.push('zmena-ucitele');
                changes.teacherId = subTeacherId;
            }
            if (subSubjectId && subSubjectId !== lessonInfo.lesson.subjectId) {
                changes.subjectId = subSubjectId;
                if (!type.includes('zmena-predmetu')) type.push('zmena-predmetu' as any); // Custom type
            }
            if (note) {
                 changes.note = note;
            }
            changes.type = type;
        }

        onSave({
            originalLesson: {
                day: format(lessonInfo.dayInfo.fullDate, 'EEEE', { locale: cs }),
                period: lessonInfo.period - 1, // 0-indexed
                classId: lessonInfo.classId,
                lessonBlock: lessonInfo.lesson,
            },
            changes: changes,
            date: format(lessonInfo.dayInfo.fullDate, 'yyyy-MM-dd'),
        });
        onOpenChange(false);
    };

    if (!lessonInfo) return null;
    
    const { lesson, dayInfo, period } = lessonInfo;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Zadat suplování</DialogTitle>
                    <DialogDescription>
                        Hodina: {lesson.subjectName} ({lesson.className}), {format(dayInfo.fullDate, "d.M.yyyy")}, {period}. hodina
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <RadioGroup value={subType} onValueChange={setSubType}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="odpada" id="odpada" />
                            <Label htmlFor="odpada">Hodina odpadá</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="suplovat" id="suplovat" />
                            <Label htmlFor="suplovat">Supluje se / mění se</Label>
                        </div>
                    </RadioGroup>

                    {subType === 'suplovat' && (
                        <div className="space-y-4 pt-4 border-t">
                            <div className="grid gap-2">
                                <Label>Suplující učitel (nepovinné)</Label>
                                <Select value={subTeacherId} onValueChange={setSubTeacherId}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte učitele" /></SelectTrigger>
                                    <SelectContent>
                                        {teachers.filter(t => t.id !== lesson.teacherId).map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Nový předmět (nepovinné)</Label>
                                 <Select value={subSubjectId} onValueChange={setSubSubjectId}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                                    <SelectContent>
                                        {subjects.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.shortcut})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                     <div className="grid gap-2">
                        <Label>Poznámka</Label>
                        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Zadejte poznámku k suplování..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
                    <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Uložit suplování</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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

function LessonContextMenu({ children, lesson, dayInfo, period, classId, onSubstitute, isTeacher }: { children: React.ReactNode, lesson: LessonBlock, dayInfo: DayMappingInfo, period: number, classId: string, onSubstitute: () => void, isTeacher: boolean }) {
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
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/hodnoceni', {
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
                {isTeacher && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onSubstitute}>
                            <VenetianMask className="mr-2 h-4 w-4" />
                            Zadat suplování
                        </DropdownMenuItem>
                    </>
                )}
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


function LessonBlockCmp({ lesson, isTeacher, dayInfo, period, classId, onSubstitute, isSubstituted = false, substitutionNote, isNewSubstitutedLesson = false }: { lesson: LessonBlock; isTeacher: boolean, dayInfo: DayMappingInfo, period: number, classId: string, onSubstitute: () => void, isSubstituted?: boolean, substitutionNote?: string, isNewSubstitutedLesson?: boolean }) {
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
            className={cn(
                "h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer relative",
                isSubstituted && 'opacity-50 line-through'
            )}
            style={{
                backgroundColor: isNewSubstitutedLesson ? 'hsl(var(--destructive) / 0.2)' : getSubjectColor(lesson.subjectId),
                color: isNewSubstitutedLesson ? 'hsl(var(--destructive-foreground))' : undefined,
             }}
        >
            {isNewSubstitutedLesson && (
                <Badge variant="destructive" className="absolute top-0.5 right-0.5 text-[10px] px-1 h-4 leading-none">SUPL</Badge>
            )}
            <div className="font-bold">{lesson.subjectShortcut}</div>
            <div>{isTeacher ? lesson.className : lesson.teacherName}</div>
            <div className={cn("text-muted-foreground", isNewSubstitutedLesson && 'text-destructive-foreground/80')}>{lesson.ucebnaName}</div>
        </div>
    );
    
    const interactiveBlock = isTeacher ? (
        <LessonContextMenu lesson={lesson} dayInfo={dayInfo} period={period} classId={classId} onSubstitute={onSubstitute} isTeacher={isTeacher}>{blockContent}</LessonContextMenu>
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
            className="h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer bg-muted/50 border border-dashed border-muted-foreground"
        >
             <XCircle className="h-4 w-4 text-muted-foreground mb-1" />
            <div className="font-bold text-muted-foreground">Odpadá</div>
            <div className="text-muted-foreground text-xs line-through">{substitution.originalLesson.lessonBlock.subjectShortcut}</div>
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

export function TimetableWidget({ dailySchedule, eventsData, substitutionsData, isTeacher, userId, userClassId, day, teachers, subjects }: { dailySchedule: Rozvrh | undefined | null, eventsData: Udalost[], substitutionsData: Substitution[], isTeacher: boolean, userId: string, userClassId?: string, day: Date, teachers: User[], subjects: Predmet[] }) {
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [editingSubFor, setEditingSubFor] = useState<{ lesson: LessonBlock; dayInfo: DayMappingInfo; period: number; classId: string; } | null>(null);
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    
    const timeSlots = dailySchedule?.timeSlots || defaultTimeSlots;
    
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
             return isSameDay(subDate, dayDate) && sub.originalLesson.period === periodIndex && sub.originalLesson.classId === classId;
        })
    };

    const getLessonForCell = (dayDate: Date, periodIndex: number) => {
        if (!dailySchedule) return null;
        const lesson = dailySchedule.hodiny[periodIndex];
        if (lesson) {
            if (isTeacher) {
                 return { lesson, classId: dailySchedule.tridaId };
            } else {
                if (dailySchedule.tridaId === userClassId) return { lesson, classId: dailySchedule.tridaId };
            }
        }
        return null;
    };
    
    const handleSaveSubstitution = async (subData: any) => {
        if (!firestore || !user ) return;
        const subId = `${subData.originalLesson.classId}-${subData.date}-${subData.originalLesson.period}`;
        const subRef = doc(firestore, 'suplovani', subId);
        
        const orgsQuery = query(collection(firestore, 'organizations'), limit(1));
        const orgsSnap = await getDocs(orgsQuery);
         if (orgsSnap.empty) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'V databázi neexistuje žádná organizace.' });
            return;
        }
        const organizationId = orgsSnap.docs[0].id;

        await setDocumentNonBlocking(subRef, { ...subData, id: subId, organizationId }, { merge: true });
        toast({ title: "Suplování uloženo." });
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

    const dayInfo: DayMappingInfo = {
        short: format(day, 'EEEEEE', { locale: cs }),
        date: format(day, 'd.M.'),
        fullDate: day,
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
                 <React.Fragment>
                    <div className="flex flex-col items-center justify-center p-2 bg-muted/50 border-b border-r border-border">
                       <div className="font-bold">{dayInfo.short}</div>
                       <div className="text-xs text-muted-foreground">{dayInfo.date}</div>
                    </div>
                    {timeSlots.map((_, periodIndex) => {
                        const lessonInfo = getLessonForCell(day, periodIndex);
                        const lesson = lessonInfo?.lesson;
                        const classId = lessonInfo?.classId;
                        
                        const event = findEventForCell(day, periodIndex);
                        const substitution = lesson && classId ? findSubstitutionForCell(day, periodIndex, classId) : null;
                        
                        const isCancelledByEvent = event && event.nahrazujeHodiny;

                        const isSubstituted = !!substitution;
                        const isCancelledBySub = !!substitution?.changes.type.includes('zruseno');

                        let substitutedLesson: LessonBlock | null = null;
                        if (isSubstituted && !isCancelledBySub && lesson) {
                            const newTeacher = teachers.find(t => t.id === substitution!.changes.teacherId);
                            const newSubject = subjects.find(s => s.id === substitution!.changes.subjectId);
                            substitutedLesson = { 
                                ...lesson, 
                                teacherId: newTeacher ? newTeacher.id : lesson.teacherId,
                                teacherName: newTeacher ? newTeacher.name : lesson.teacherName,
                                subjectId: newSubject ? newSubject.id : lesson.subjectId,
                                subjectName: newSubject ? newSubject.name : lesson.subjectName,
                                subjectShortcut: newSubject ? newSubject.shortcut : lesson.subjectShortcut,
                             };
                        }


                        return (
                            <div key={periodIndex} className="p-0.5 border-b border-r border-border min-h-[70px] relative" onClick={() => handleCellClick(isTeacher, lessonInfo, day, periodIndex)}>
                                {isCancelledByEvent ? (
                                     <EventBlock event={event!} />
                                ) : isCancelledBySub && substitution ? (
                                    <CancelledLessonBlock substitution={substitution} />
                                ) : (
                                    <>
                                        {lesson && dayInfo && classId && (
                                            <LessonBlockCmp lesson={lesson} isTeacher={isTeacher} dayInfo={dayInfo} period={periodIndex + 1} classId={classId} isSubstituted={isSubstituted} onSubstitute={() => { setEditingSubFor({ lesson, dayInfo, period: periodIndex + 1, classId }); setIsSubDialogOpen(true); }}/>
                                        )}
                                        {substitutedLesson && dayInfo && classId && (
                                            <div className="absolute inset-0.5">
                                                <LessonBlockCmp lesson={substitutedLesson} isTeacher={isTeacher} dayInfo={dayInfo} period={periodIndex + 1} classId={classId} substitutionNote={substitution?.changes.note} isNewSubstitutedLesson={true} onSubstitute={() => { setEditingSubFor({ lesson: substitutedLesson, dayInfo, period: periodIndex + 1, classId }); setIsSubDialogOpen(true); }}/>
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
            </div>
             <SubstitutionDialog
                isOpen={isSubDialogOpen}
                onOpenChange={setIsSubDialogOpen}
                lessonInfo={editingSubFor}
                teachers={teachers}
                subjects={subjects}
                onSave={handleSaveSubstitution}
            />
        </div>
    );
}
