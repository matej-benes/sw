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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Info, XCircle, VenetianMask, Save, PencilRuler } from 'lucide-react';
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
import { useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { doc, getDocs, query, collection, limit, where } from 'firebase/firestore';
import { Badge } from './ui/badge';
import { MultiSelect } from './ui/multi-select';
import { GradingDialog } from './grading-dialog';


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
    substitution,
    teachers,
    subjects,
    onSave,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    lessonInfo: { lesson: LessonBlock; dayInfo: DayMappingInfo; period: number; classId: string } | null;
    substitution: Substitution | null;
    teachers: User[];
    subjects: Predmet[];
    onSave: (subData: any) => void;
}) {
    const [subType, setSubType] = useState('suplovat');
    const [subTeacherIds, setSubTeacherIds] = useState<string[]>([]);
    const [subSubjectId, setSubSubjectId] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen && lessonInfo) {
             if (substitution) {
                // Pre-fill from existing substitution
                const type = substitution.changes?.type;
                const isCancelled = Array.isArray(type) ? type.includes('zruseno') : type === 'zruseno';

                if (isCancelled) {
                    setSubType('odpada');
                } else {
                    setSubType('suplovat');
                }
                setSubTeacherIds(substitution.changes?.teacherIds || [lessonInfo.lesson.teacherId]);
                setSubSubjectId(substitution.changes?.subjectId || lessonInfo.lesson.subjectId);
                setNote(substitution.changes?.note || '');
            } else {
                // New substitution
                setSubType('suplovat');
                setSubTeacherIds([lessonInfo.lesson.teacherId]);
                setSubSubjectId(lessonInfo.lesson.subjectId);
                setNote('');
            }
        }
    }, [isOpen, lessonInfo, substitution]);

    const handleSave = () => {
        if (!lessonInfo) return;

        let changes: any = {};
        let type: string[] = [];

        if (subType === 'odpada') {
            type.push('zruseno');
            changes = { type, note };
        } else {
            const originalTeacherIds = [lessonInfo.lesson.teacherId];
            const sortedOriginal = [...originalTeacherIds].sort();
            const sortedNew = [...subTeacherIds].sort();

            if (JSON.stringify(sortedOriginal) !== JSON.stringify(sortedNew)) {
                type.push('zmena-ucitele');
            }
            changes.teacherIds = subTeacherIds;
            
            if (subSubjectId && subSubjectId !== lessonInfo.lesson.subjectId) {
                changes.subjectId = subSubjectId;
                if (!type.includes('zmena-predmetu')) type.push('zmena-predmetu' as any); // Custom type
            }
            if (note) {
                 changes.note = note;
            }
            if (type.length > 0) {
                 changes.type = type;
            }
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
    const teacherOptions = teachers.map(t => ({ value: t.id, label: t.name }));

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
                                <Label>Suplující učitel/é</Label>
                                <MultiSelect
                                    options={teacherOptions}
                                    onValueChange={setSubTeacherIds}
                                    defaultValue={subTeacherIds}
                                    placeholder="Vyberte učitele..."
                                />
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

function LessonContextMenu({ children, lesson, dayInfo, period, classId, onSubstitute, onGrade, isTeacher, isSubstitutedLesson, onCancelSubstitution }: { children: React.ReactNode, lesson: LessonBlock, dayInfo: DayMappingInfo, period: number, classId: string, onSubstitute: () => void, onGrade: () => void, isTeacher: boolean, isSubstitutedLesson?: boolean, onCancelSubstitution?: () => void }) {
    const router = useRouter();
    
    const handleNavigation = (path: string, params: Record<string, string>) => {
        const query = new URLSearchParams(params).toString();
        router.push(`${path}?${query}`);
    }

    if (!isTeacher) {
        return <>{children}</>;
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
                <DropdownMenuItem onClick={onGrade}><PencilRuler className="mr-2"/>Nové hodnocení</DropdownMenuItem>
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
                            <span>{isSubstitutedLesson ? 'Upravit suplovanou hodinu' : 'Zadat suplování'}</span>
                        </DropdownMenuItem>
                        {isSubstitutedLesson && onCancelSubstitution && (
                            <DropdownMenuItem onClick={onCancelSubstitution} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <XCircle className="mr-2 h-4 w-4" />
                                <span>Zrušit suplování</span>
                            </DropdownMenuItem>
                        )}
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


function LessonBlockCmp({ lesson, isTeacher, dayInfo, period, classId, onSubstitute, onGrade, onCancelSubstitution, isSubstituted = false, substitutionNote, isNewSubstitutedLesson = false }: { lesson: LessonBlock; isTeacher: boolean, dayInfo: DayMappingInfo, period: number, classId: string, onSubstitute: () => void, onGrade: () => void, onCancelSubstitution?: () => void, isSubstituted?: boolean, substitutionNote?: string, isNewSubstitutedLesson?: boolean }) {
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
                isSubstituted && 'bg-muted text-muted-foreground'
            )}
            style={{
                backgroundColor: isNewSubstitutedLesson ? 'hsl(346.8 77.2% 49.8% / 0.2)' : isSubstituted ? 'hsl(var(--muted))' : getSubjectColor(lesson.subjectId),
             }}
        >
            <div className="font-bold">{lesson.subjectShortcut}</div>
            <div>{isTeacher ? lesson.className : lesson.teacherName}</div>
            <div className={cn("text-muted-foreground", isNewSubstitutedLesson && 'text-foreground/80')}>{lesson.ucebnaName}</div>
        </div>
    );
    
    const interactiveBlock = (isTeacher && !isSubstituted) ? (
        <LessonContextMenu 
            lesson={lesson} 
            dayInfo={dayInfo} 
            period={period} 
            classId={classId} 
            onSubstitute={onSubstitute} 
            onGrade={onGrade}
            isTeacher={isTeacher}
            isSubstitutedLesson={isNewSubstitutedLesson}
            onCancelSubstitution={onCancelSubstitution}
        >
            {blockContent}
        </LessonContextMenu>
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
                        {substitution.changes?.note && <p className="mt-1">Poznámka: {substitution.changes.note}</p>}
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
    const [editingSubFor, setEditingSubFor] = useState<{ lesson: LessonBlock; dayInfo: DayMappingInfo; period: number; classId: string; substitution: Substitution | null; } | null>(null);
    const [deletingSubstitution, setDeletingSubstitution] = useState<Substitution | null>(null);
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    
    const [isGradingDialogOpen, setIsGradingDialogOpen] = useState(false);
    const [gradingLessonInfo, setGradingLessonInfo] = useState<{ lesson: LessonBlock; dayInfo: DayMappingInfo; period: number; classId: string; } | null>(null);

    const { data: students } = useCollection<User>(
        useMemoFirebase(() => {
            if (!firestore || !userClassId) return null;
            return query(collection(firestore, "users"), where("tridaId", "==", userClassId), where("roles", "array-contains", "ziak"));
        }, [firestore, userClassId])
    );
    
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

    const handleDeleteSubstitution = async () => {
        if (!firestore || !deletingSubstitution) return;
        const subId = deletingSubstitution.id;
        await deleteDocumentNonBlocking(doc(firestore, 'suplovani', subId));
        toast({ title: 'Suplování zrušeno.' });
        setDeletingSubstitution(null);
    };

    const handleCellClick = (isTeacher: boolean, lessonInfo: any, dayDate: Date, periodIndex: number) => {
        if(isTeacher || !lessonInfo?.lesson || !lessonInfo?.classId) return;

        const slug = [
            format(dayDate, 'yyyy-MM-dd'),
            periodIndex.toString(),
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
    
    const handleGrade = (lesson: LessonBlock, dayInfo: DayMappingInfo, period: number, classId: string) => {
        setGradingLessonInfo({ lesson, dayInfo, period, classId });
        setIsGradingDialogOpen(true);
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

                        const isCancelledBySub = substitution ? (Array.isArray(substitution.changes?.type) ? substitution.changes.type.includes('zruseno') : substitution.changes?.type === 'zruseno') : false;

                        let substitutedLesson: LessonBlock | null = null;
                        if (substitution && !isCancelledBySub && lesson) {
                            let newTeacherName = lesson.teacherName;
                            if (substitution.changes?.teacherIds && substitution.changes.teacherIds.length > 0) {
                                newTeacherName = substitution.changes.teacherIds
                                    .map(id => teachers.find(t => t.id === id)?.name)
                                    .filter(Boolean)
                                    .join(', ');
                            }
                            
                            const newSubject = subjects.find(s => s.id === substitution.changes?.subjectId);
                            substitutedLesson = { 
                                ...lesson, 
                                teacherName: newTeacherName,
                                teacherId: substitution.changes?.teacherIds?.[0] || lesson.teacherId, // For logic, but name shows all
                                subjectId: newSubject ? newSubject.id : lesson.subjectId,
                                subjectName: newSubject ? newSubject.name : lesson.subjectName,
                                subjectShortcut: newSubject ? newSubject.shortcut : lesson.subjectShortcut,
                             };
                        }

                        const cellHasContent = isCancelledByEvent || (isCancelledBySub && substitution) || lesson;

                        return (
                             <div 
                                key={periodIndex} 
                                className={cn(
                                    "p-0.5 border-b border-r border-border min-h-[70px] flex flex-col gap-0.5 justify-center",
                                    !cellHasContent && isTeacher && "cursor-pointer"
                                )}
                            >
                                {isCancelledByEvent ? (
                                        <EventBlock event={event!} />
                                ) : isCancelledBySub && substitution ? (
                                    <CancelledLessonBlock substitution={substitution} />
                                ) : substitutedLesson && lesson && dayInfo && classId ? (
                                    <>
                                        <div onClick={() => handleCellClick(isTeacher, {lesson: substitutedLesson, classId}, day, periodIndex)} className="h-1/2">
                                            <LessonBlockCmp 
                                                lesson={substitutedLesson} 
                                                isTeacher={isTeacher} 
                                                dayInfo={dayInfo} 
                                                period={periodIndex + 1} 
                                                classId={classId!} 
                                                substitutionNote={substitution?.changes?.note} 
                                                isNewSubstitutedLesson={true} 
                                                onSubstitute={() => { setEditingSubFor({ lesson: lesson!, dayInfo, period: periodIndex + 1, classId: classId!, substitution }); setIsSubDialogOpen(true); }}
                                                onGrade={() => handleGrade(substitutedLesson, dayInfo, periodIndex + 1, classId!)}
                                                onCancelSubstitution={() => setDeletingSubstitution(substitution)}
                                            />
                                        </div>
                                        <div onClick={() => { /* no action for grayed out lesson */ }} className="h-1/2">
                                            <LessonBlockCmp 
                                                lesson={lesson!} 
                                                isTeacher={false} 
                                                dayInfo={dayInfo} 
                                                period={periodIndex + 1} 
                                                classId={classId!} 
                                                isSubstituted={true} 
                                                onSubstitute={() => { /* no-op for original */ }}
                                                onGrade={() => {}}
                                            />
                                        </div>
                                    </>
                                ) : lesson && dayInfo && classId ? (
                                    <div onClick={() => handleCellClick(isTeacher, lessonInfo, day, periodIndex)} className="h-full">
                                        <LessonBlockCmp 
                                            lesson={lesson} 
                                            isTeacher={isTeacher} 
                                            dayInfo={dayInfo} 
                                            period={periodIndex + 1} 
                                            classId={classId} 
                                            onSubstitute={() => { setEditingSubFor({ lesson, dayInfo, period: periodIndex + 1, classId, substitution: null }); setIsSubDialogOpen(true); }}
                                            onGrade={() => handleGrade(lesson, dayInfo, periodIndex + 1, classId)}
                                        />
                                    </div>
                                ) : (
                                    isTeacher && !event && (
                                        <EmptySlotContextMenu>
                                            <div className="h-full w-full"></div>
                                        </EmptySlotContextMenu>
                                    )
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
                substitution={editingSubFor?.substitution ?? null}
                teachers={teachers}
                subjects={subjects}
                onSave={handleSaveSubstitution}
            />
            <AlertDialog open={!!deletingSubstitution} onOpenChange={() => setDeletingSubstitution(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Opravdu chcete zrušit toto suplování?</AlertDialogTitle>
                        <AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Zpět</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSubstitution} className="bg-destructive hover:bg-destructive/90">
                            Zrušit suplování
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {gradingLessonInfo && (
                <GradingDialog
                    isOpen={isGradingDialogOpen}
                    onOpenChange={setIsGradingDialogOpen}
                    lesson={gradingLessonInfo.lesson}
                    students={students || []}
                    subjects={subjects || []}
                    day={gradingLessonInfo.dayInfo.fullDate}
                />
            )}
        </div>
    );
}
