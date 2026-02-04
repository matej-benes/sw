'use client';
import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, User, Predmet, ZapisHodiny } from "@/lib/types";
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
import { PlusCircle, Info, XCircle, VenetianMask, Save, PencilRuler, UserPlus, X, BookOpen } from 'lucide-react';
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
import { Checkbox } from './ui/checkbox';
import { GradingDialog } from './grading-dialog';
import { Separator } from './ui/separator';


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
    const [isTeacherPickerOpen, setIsTeacherPickerOpen] = useState(false);

    useEffect(() => {
        if (isOpen && lessonInfo) {
             if (substitution) {
                const type = substitution.changes?.type;
                const isCancelled = Array.isArray(type) ? type.includes('zruseno') : type === 'zruseno';
                if (isCancelled) setSubType('odpada');
                else setSubType('suplovat');
                setSubTeacherIds(substitution.changes?.teacherIds || [lessonInfo.lesson.teacherId]);
                setSubSubjectId(substitution.changes?.subjectId || lessonInfo.lesson.subjectId);
                setNote(substitution.changes?.note || '');
            } else {
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
            if (JSON.stringify(sortedOriginal) !== JSON.stringify(sortedNew)) type.push('zmena-ucitele');
            changes.teacherIds = subTeacherIds;
            if (subSubjectId && subSubjectId !== lessonInfo.lesson.subjectId) {
                changes.subjectId = subSubjectId;
                if (!type.includes('zmena-predmetu')) type.push('zmena-predmetu' as any);
            }
            if (note) changes.note = note;
            if (type.length > 0) changes.type = type;
        }
        onSave({
            originalLesson: {
                day: format(lessonInfo.dayInfo.fullDate, 'EEEE', { locale: cs }),
                period: lessonInfo.period - 1,
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
        <>
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Zadat suplování</DialogTitle>
                    <DialogDescription>Hodina: {lesson.subjectName} ({lesson.className}), {format(dayInfo.fullDate, "d.M.yyyy")}, {period}. hodina</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <RadioGroup value={subType} onValueChange={setSubType}>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="odpada" id="odpada" /><Label htmlFor="odpada">Hodina odpadá</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="suplovat" id="suplovat" /><Label htmlFor="suplovat">Supluje se / mění se</Label></div>
                    </RadioGroup>
                    {subType === 'suplovat' && (
                        <div className="space-y-4 pt-4 border-t">
                            <div className="grid gap-2">
                                <Label>Suplující učitel/é</Label>
                                <div className="space-y-2">
                                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setIsTeacherPickerOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Vybrat vyučujícího / vyučující</Button>
                                    {subTeacherIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {subTeacherIds.map(id => {
                                                const t = teachers.find(t => t.id === id);
                                                return t ? <Badge key={id} variant="secondary" className="flex items-center gap-1 pr-1">{t.name}<X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSubTeacherIds(prev => prev.filter(tid => tid !== id))} /></Badge> : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Nový předmět (nepovinné)</Label>
                                 <Select value={subSubjectId} onValueChange={setSubSubjectId}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                                    <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.shortcut})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                     <div className="grid gap-2"><Label>Poznámka</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Zadejte poznámku k suplování..." /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button><Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Uložit suplování</Button></DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={isTeacherPickerOpen} onOpenChange={setIsTeacherPickerOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader><DialogTitle>Vybrat vyučující</DialogTitle><DialogDescription>Vyberte jednoho nebo více kolegů pro suplování.</DialogDescription></DialogHeader>
                <div className="py-4 max-h-[50vh] overflow-y-auto space-y-1">
                    {teachers.map(t => (
                        <div key={t.id} className="flex items-center space-x-3 p-3 hover:bg-muted rounded-md cursor-pointer transition-colors" onClick={() => setSubTeacherIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}><Checkbox checked={subTeacherIds.includes(t.id)} onCheckedChange={() => {}} /><Label className="flex-grow cursor-pointer font-medium">{t.name}</Label></div>
                    ))}
                </div>
                <DialogFooter><Button onClick={() => setIsTeacherPickerOpen(false)} className="w-full sm:w-auto">Hotovo</Button></DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

function LessonTooltipContent({ lesson, dayInfo, period, topic }: { lesson: LessonBlock, dayInfo: DayMappingInfo, period: number, topic?: string }) {
    return (
        <div className="p-2 text-sm min-w-[200px]">
            <h3 className="font-bold text-base mb-2">{lesson.subjectName}</h3>
            <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Předmět:</span><span>{lesson.subjectName} ({lesson.subjectShortcut})</span>
                <span className="text-muted-foreground">Učitel:</span><span>{lesson.teacherName || 'N/A'}</span>
                <span className="text-muted-foreground">Třída:</span><span>{lesson.className}</span>
                <span className="text-muted-foreground">Učebna:</span><span>{lesson.ucebnaName || 'N/A'}</span>
                <span className="text-muted-foreground">Čas:</span><span>{dayInfo.short} {dayInfo.date} ({period}. hodina)</span>
            </div>
            {topic && (
                <>
                    <Separator className="my-2" />
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-primary font-semibold">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Probrané učivo:</span>
                        </div>
                        <p className="italic text-muted-foreground">{topic}</p>
                    </div>
                </>
            )}
        </div>
    )
}

function EventTooltipContent({ event }: { event: Udalost }) {
    return (
        <div className="p-2 text-sm">
            <div className="flex items-center gap-2 mb-2"><Info className="h-4 w-4 text-accent" /><h3 className="font-bold text-base">{event.nazev}</h3></div>
            <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Typ:</span><span>{event.typ}</span>
                <span className="text-muted-foreground">Datum:</span><span>{format(parseISO(event.datum), 'PPP', { locale: cs })}</span>
                <span className="text-muted-foreground">Čas:</span><span>{event.cas}</span>
            </div>
        </div>
    )
}

function LessonContextMenu({ children, lesson, dayInfo, period, classId, onSubstitute, onGrade, isTeacher, isSubstitutedLesson, onCancelSubstitution }: { children: React.ReactNode, lesson: LessonBlock, dayInfo: DayMappingInfo, period: number, classId: string, onSubstitute: () => void, onGrade: () => void, isTeacher: boolean, isSubstitutedLesson?: boolean, onCancelSubstitution?: () => void }) {
    const router = useRouter();
    const handleNavigation = (path: string, params: Record<string, string>) => router.push(`${path}?${new URLSearchParams(params).toString()}`);
    if (!isTeacher) return <>{children}</>;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/tridni-kniha/zapis', { tridaId: lesson.classId, datum: format(dayInfo.fullDate, 'yyyy-MM-dd'), hodina: (period).toString(), predmetId: lesson.subjectId })}>Zapsat do třídní knihy</DropdownMenuItem>
                <DropdownMenuItem onClick={onGrade}><PencilRuler className="mr-2"/>Nové hodnocení</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/poznamky-zaka')}>Poznámka žáka do třídní knihy</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/ukoly', { tridaId: lesson.classId, predmetId: lesson.subjectId, datumZadani: format(dayInfo.fullDate, 'yyyy-MM-dd') })}>Nový domácí úkol</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSubstitute}><VenetianMask className="mr-2 h-4 w-4" /><span>{isSubstitutedLesson ? 'Upravit suplování' : 'Zadat suplování'}</span></DropdownMenuItem>
                {isSubstitutedLesson && onCancelSubstitution && <DropdownMenuItem onClick={onCancelSubstitution} className="text-destructive focus:text-destructive focus:bg-destructive/10"><XCircle className="mr-2 h-4 w-4" /><span>Zrušit suplování</span></DropdownMenuItem>}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function EmptySlotContextMenu({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuItem onClick={() => router.push('/dashboard/udalosti')}><PlusCircle className="mr-2 h-4 w-4" />Vytvořit událost</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  );
}


function LessonBlockCmp({ lesson, isTeacher, dayInfo, period, classId, onSubstitute, onGrade, onCancelSubstitution, isSubstituted = false, substitutionNote, isNewSubstitutedLesson = false, topic }: { lesson: LessonBlock; isTeacher: boolean, dayInfo: DayMappingInfo, period: number, classId: string, onSubstitute: () => void, onGrade: () => void, onCancelSubstitution?: () => void, isSubstituted?: boolean, substitutionNote?: string, isNewSubstitutedLesson?: boolean, topic?: string }) {
    const getSubjectColor = (subjectId: string) => {
        if (!subjectId) return `hsl(0, 0%, 85%)`;
        let hash = 0;
        for (let i = 0; i < subjectId.length; i++) hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
        const h = hash % 360;
        return `hsl(${h}, 60%, 85%)`;
    };
    const blockContent = (
         <button className={cn("w-full h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer relative border-none outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", isSubstituted && 'bg-muted text-muted-foreground')} style={{ backgroundColor: isNewSubstitutedLesson ? 'hsl(346.8 77.2% 49.8% / 0.2)' : isSubstituted ? 'hsl(var(--muted))' : getSubjectColor(lesson.subjectId) }}>
            <div className="font-bold text-sm">{lesson.subjectShortcut}</div>
        </button>
    );
    const interactiveBlock = (isTeacher && !isSubstituted) ? <LessonContextMenu lesson={lesson} dayInfo={dayInfo} period={period} classId={classId} onSubstitute={onSubstitute} onGrade={onGrade} isTeacher={isTeacher} isSubstitutedLesson={isNewSubstitutedLesson} onCancelSubstitution={onCancelSubstitution}>{blockContent}</LessonContextMenu> : blockContent;
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{interactiveBlock}</TooltipTrigger>
                <TooltipContent><LessonTooltipContent lesson={lesson} dayInfo={dayInfo} period={period} topic={topic} />{substitutionNote && <p className="mt-2 p-2 border-t text-sm">Pozn. k supl.: {substitutionNote}</p>}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function EventBlock({ event }: { event: Udalost }) {
    const blockContent = <div className="h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer bg-accent/30 border border-dashed border-accent"><div className="font-bold">{event.nazev}</div><div className="text-muted-foreground">{event.cas}</div></div>;
    return (<TooltipProvider><Tooltip><TooltipTrigger asChild>{blockContent}</TooltipTrigger><TooltipContent><EventTooltipContent event={event} /></TooltipContent></Tooltip></TooltipProvider>)
}

function CancelledLessonBlock({ substitution }: { substitution: Substitution }) {
     const blockContent = <div className="h-full p-1 text-xs rounded-sm flex flex-col justify-center items-center text-center cursor-pointer bg-muted/50 border border-dashed border-muted-foreground"><XCircle className="h-4 w-4 text-muted-foreground mb-1" /><div className="font-bold text-muted-foreground">Odpadá</div><div className="text-muted-foreground text-xs line-through">{substitution.originalLesson.lessonBlock.subjectShortcut}</div></div>;
     return (<TooltipProvider><Tooltip><TooltipTrigger asChild>{blockContent}</TooltipTrigger><TooltipContent><div className="p-2 text-sm"><h3 className="font-bold text-base mb-2 text-destructive">Zrušená hodina</h3><p>Hodina předmětu {substitution.originalLesson.lessonBlock.subjectName} byla zrušena.</p>{substitution.changes?.note && <p className="mt-1">Poznámka: {substitution.changes.note}</p>}</div></TooltipContent></Tooltip></TooltipProvider>)
}

export function TimetableWidget({ dailySchedule, eventsData, substitutionsData, zapisyData, isTeacher, userId, userClassId, day, teachers, subjects }: { dailySchedule: Rozvrh | undefined | null, eventsData: Udalost[], substitutionsData: Substitution[], zapisyData: ZapisHodiny[], isTeacher: boolean, userId: string, userClassId?: string, day: Date, teachers: User[], subjects: Predmet[] }) {
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [editingSubFor, setEditingSubFor] = useState<{ lesson: LessonBlock; dayInfo: DayMappingInfo; period: number; classId: string; substitution: Substitution | null; } | null>(null);
    const [deletingSubstitution, setDeletingSubstitution] = useState<Substitution | null>(null);
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    const [isGradingDialogOpen, setIsGradingDialogOpen] = useState(false);
    const [gradingLessonInfo, setGradingLessonInfo] = useState<{ lesson: LessonBlock; dayInfo: DayMappingInfo; period: number; classId: string; } | null>(null);

    const { data: students } = useCollection<User>(useMemoFirebase(() => { if (!firestore || !userClassId) return null; return query(collection(firestore, "users"), where("tridaId", "==", userClassId), where("roles", "array-contains", "ziak")); }, [firestore, userClassId]));
    const timeSlots = dailySchedule?.timeSlots || defaultTimeSlots;
    
    const findEventForCell = (dayDate: Date, periodIndex: number) => eventsData.find(event => isSameDay(parseISO(event.datum), dayDate) && event.cas === timeSlots[periodIndex]?.split('-')[0]);
    const findSubstitutionForCell = (dayDate: Date, periodIndex: number, classId: string) => substitutionsData.find(sub => isSameDay(parseISO(sub.date), dayDate) && sub.originalLesson.period === periodIndex && sub.originalLesson.classId === classId);
    const getLessonForCell = (dayDate: Date, periodIndex: number) => {
        if (!dailySchedule) return null;
        const lesson = dailySchedule.hodiny[periodIndex];
        if (lesson) {
            if (userClassId === undefined) return { lesson, classId: lesson.classId };
            if (dailySchedule.tridaId === userClassId) return { lesson, classId: dailySchedule.tridaId };
        }
        return null;
    };
    
    const handleSaveSubstitution = async (subData: any) => {
        if (!firestore || !user ) return;
        const subId = `${subData.originalLesson.classId}-${subData.date}-${subData.originalLesson.period}`;
        const subRef = doc(firestore, 'suplovani', subId);
        const orgsSnap = await getDocs(query(collection(firestore, 'organizations'), limit(1)));
        if (orgsSnap.empty) { toast({ variant: 'destructive', title: 'Chyba', description: 'V databázi neexistuje žádná organizace.' }); return; }
        await setDocumentNonBlocking(subRef, { ...subData, id: subId, organizationId: orgsSnap.docs[0].id }, { merge: true });
        toast({ title: "Suplování uloženo." });
    };

    const handleDeleteSubstitution = async () => {
        if (!firestore || !deletingSubstitution) return;
        await deleteDocumentNonBlocking(doc(firestore, 'suplovani', deletingSubstitution.id));
        toast({ title: 'Suplování zrušeno.' });
        setDeletingSubstitution(null);
    };

    const handleCellClick = (isTeacher: boolean, lessonInfo: any, dayDate: Date, periodIndex: number) => {
        if(isTeacher || !lessonInfo?.lesson || !lessonInfo?.classId) return;
        router.push(`/dashboard/hodina/${[format(dayDate, 'yyyy-MM-dd'), periodIndex.toString(), lessonInfo.classId, lessonInfo.lesson.id].join('/')}`);
    }

    const dayInfo: DayMappingInfo = { short: format(day, 'EEEEEE', { locale: cs }), date: format(day, 'd.M.'), fullDate: day };
    const handleGrade = (lesson: LessonBlock, dayInfo: DayMappingInfo, period: number, classId: string) => { setGradingLessonInfo({ lesson, dayInfo, period, classId }); setIsGradingDialogOpen(true); }

    return (
        <div>
            <div className={cn("grid border-t border-l border-border", `grid-cols-[auto_repeat(${timeSlots.length},1fr)]`)} style={{ gridTemplateColumns: `auto repeat(${timeSlots.length}, 1fr)`}}>
                <div className="border-b border-r border-border"></div>
                {timeSlots.map((time, index) => (
                    <div key={index} className="p-2 text-center bg-muted/50 border-b border-r border-border"><div className="font-bold">{index + 1}</div><div className="text-xs text-muted-foreground">{time}</div></div>
                ))}
                 <React.Fragment>
                    <div className="flex flex-col items-center justify-center p-2 bg-muted/50 border-b border-r border-border"><div className="font-bold">{dayInfo.short}</div><div className="text-xs text-muted-foreground">{dayInfo.date}</div></div>
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
                            if (substitution.changes?.teacherIds && substitution.changes.teacherIds.length > 0) newTeacherName = substitution.changes.teacherIds.map(id => teachers.find(t => t.id === id)?.name).filter(Boolean).join(', ');
                            const newSubject = subjects.find(s => s.id === substitution.changes?.subjectId);
                            substitutedLesson = { ...lesson, teacherName: newTeacherName, teacherId: substitution.changes?.teacherIds?.[0] || lesson.teacherId, subjectId: newSubject ? newSubject.id : lesson.subjectId, subjectName: newSubject ? newSubject.name : lesson.subjectName, subjectShortcut: newSubject ? newSubject.shortcut : lesson.subjectShortcut };
                        }

                        const zapis = zapisyData.find(z => z.datum === format(day, 'yyyy-MM-dd') && parseInt(z.hodina) === (periodIndex + 1) && z.tridaId === classId);
                        const cellHasContent = isCancelledByEvent || (isCancelledBySub && substitution) || lesson;

                        return (
                             <div key={periodIndex} className={cn("p-0.5 border-b border-r border-border min-h-[70px] flex flex-col gap-0.5 justify-center", !cellHasContent && isTeacher && "cursor-pointer")}>
                                {isCancelledByEvent ? <EventBlock event={event!} /> : isCancelledBySub && substitution ? <CancelledLessonBlock substitution={substitution} /> : substitutedLesson && lesson && dayInfo && classId ? (
                                    <>
                                        <div onClick={() => handleCellClick(isTeacher, {lesson: substitutedLesson, classId}, day, periodIndex)} className="h-1/2">
                                            <LessonBlockCmp lesson={substitutedLesson} isTeacher={isTeacher} dayInfo={dayInfo} period={periodIndex + 1} classId={classId!} substitutionNote={substitution?.changes?.note} isNewSubstitutedLesson={true} onSubstitute={() => { setEditingSubFor({ lesson: lesson!, dayInfo, period: periodIndex + 1, classId: classId!, substitution }); setIsSubDialogOpen(true); }} onGrade={() => handleGrade(substitutedLesson, dayInfo, periodIndex + 1, classId!)} onCancelSubstitution={() => setDeletingSubstitution(substitution)} topic={zapis?.topic} />
                                        </div>
                                        <div className="h-1/2">
                                            <LessonBlockCmp lesson={lesson!} isTeacher={false} dayInfo={dayInfo} period={periodIndex + 1} classId={classId!} isSubstituted={true} onSubstitute={() => {}} onGrade={() => {}} />
                                        </div>
                                    </>
                                ) : lesson && dayInfo && classId ? (
                                    <div onClick={() => handleCellClick(isTeacher, lessonInfo, day, periodIndex)} className="h-full">
                                        <LessonBlockCmp lesson={lesson} isTeacher={isTeacher} dayInfo={dayInfo} period={periodIndex + 1} classId={classId} isNewSubstitutedLesson={lesson.isSubstitution} onSubstitute={() => { setEditingSubFor({ lesson, dayInfo, period: periodIndex + 1, classId, substitution: null }); setIsSubDialogOpen(true); }} onGrade={() => handleGrade(lesson, dayInfo, periodIndex + 1, classId)} topic={zapis?.topic} />
                                    </div>
                                ) : (isTeacher && !event && <EmptySlotContextMenu><button className="h-full w-full bg-transparent border-none appearance-none cursor-pointer"></button></EmptySlotContextMenu>)}
                            </div>
                        )
                    })}
                </React.Fragment>
            </div>
            <SubstitutionDialog isOpen={isSubDialogOpen} onOpenChange={setIsSubDialogOpen} lessonInfo={editingSubFor} substitution={editingSubFor?.substitution ?? null} teachers={teachers} subjects={subjects} onSave={handleSaveSubstitution} />
            <AlertDialog open={!!deletingSubstitution} onOpenChange={() => setDeletingSubstitution(null)}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Opravdu chcete zrušit toto suplování?</AlertDialogTitle><AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Zpět</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSubstitution} className="bg-destructive hover:bg-destructive/90">Zrušit suplování</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
            {gradingLessonInfo && <GradingDialog isOpen={isGradingDialogOpen} onOpenChange={setIsGradingDialogOpen} lesson={gradingLessonInfo.lesson} students={students || []} subjects={subjects || []} day={gradingLessonInfo.dayInfo.fullDate} />}
        </div>
    );
}
