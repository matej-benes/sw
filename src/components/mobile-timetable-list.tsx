'use client';
import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import type { LessonBlock, Udalost, Rozvrh, Substitution, ZapisHodiny, User, Predmet } from "@/lib/types";
import { useRouter } from 'next/navigation';
import { format, parseISO, isSameDay } from 'date-fns';
import { BookOpen, Info, XCircle, ChevronRight, PencilRuler, Pencil, StickyNote, VenetianMask, Save } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { doc, getDocs, query, collection, limit } from 'firebase/firestore';
import { MultiSelect } from './ui/multi-select';

function SubstitutionDialog({
    isOpen,
    onOpenChange,
    lessonInfo,
    day,
    substitution,
    teachers,
    subjects,
    onSave,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    lessonInfo: { lesson: LessonBlock; period: number; classId: string; } | null;
    day: Date;
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
                const type = substitution.changes.type;
                setSubType(type.includes('zruseno') ? 'odpada' : 'suplovat');
                setSubTeacherIds(substitution.changes.teacherIds || []);
                setSubSubjectId(substitution.changes.subjectId || lessonInfo.lesson.subjectId);
                setNote(substitution.changes.note || '');
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

            if (JSON.stringify(sortedOriginal) !== JSON.stringify(sortedNew)) {
                type.push('zmena-ucitele');
            }
            changes.teacherIds = subTeacherIds;
            
            if (subSubjectId && subSubjectId !== lessonInfo.lesson.subjectId) {
                changes.subjectId = subSubjectId;
                if (!type.includes('zmena-predmetu')) type.push('zmena-predmetu' as any);
            }
            if (note) changes.note = note;
            if (type.length === 0 && !changes.note && subSubjectId === lessonInfo.lesson.subjectId) {
                // No actual change
            } else {
                 changes.type = type;
            }
        }

        onSave({
            originalLesson: {
                day: format(day, 'EEEE', { locale: cs }),
                period: lessonInfo.period - 1,
                classId: lessonInfo.classId,
                lessonBlock: lessonInfo.lesson,
            },
            changes: changes,
            date: format(day, 'yyyy-MM-dd'),
        });
        onOpenChange(false);
    };

    if (!lessonInfo) return null;
    
    const { lesson, period } = lessonInfo;
    const teacherOptions = teachers.map(t => ({ value: t.id, label: t.name }));

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Zadat suplování</DialogTitle>
                    <DialogDescription>
                        Hodina: {lesson.subjectName} ({lesson.className}), {format(day, "d.M.yyyy")}, {period}. hodina
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

function LessonActionSheet({ lesson, period, time, day, isOpen, onOpenChange, isTeacher, substitution, onSubstitute, onCancelSubstitution }: { lesson: LessonBlock | null, period: number, time: string, day: Date, isOpen: boolean, onOpenChange: (isOpen: boolean) => void, isTeacher: boolean, substitution: Substitution | null, onSubstitute: () => void, onCancelSubstitution: () => void }) {
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
                                onClick={() => onSubstitute()}
                                className="w-full justify-start h-14 text-base"
                                variant="outline"
                            >
                                <VenetianMask className="mr-3 h-5 w-5" />
                                {substitution ? 'Upravit suplování' : 'Zadat suplování'}
                            </Button>
                            {substitution && (
                                <Button
                                    onClick={() => onCancelSubstitution()}
                                    className="w-full justify-start h-14 text-base"
                                    variant="destructive"
                                >
                                    <XCircle className="mr-3 h-5 w-5" />
                                    Zrušit suplování
                                </Button>
                            )}
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
                isSubstituting && "bg-destructive/20 border-destructive"
            )}
        >
            <div className={cn("flex flex-col items-center w-12", isSubstituted && "opacity-50")}>
                <span className="text-2xl font-bold">{period}</span>
                <span className="text-xs">{time.replace('-', '\n')}</span>
            </div>
            <div className={cn("flex-grow", isSubstituted && "line-through opacity-50")}>
                 <div className="flex items-center gap-2">
                    {isSubstituting && <Badge variant="destructive">SUPL</Badge>}
                    <p className="font-semibold text-lg">{lesson.subjectName}</p>
                </div>
                <p className="text-sm">{lesson.className} | {lesson.teacherName} | {lesson.ucebnaName || 'N/A'}</p>
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
    const firestore = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();

    const [selectedLesson, setSelectedLesson] = useState<{ lesson: LessonBlock, period: number, time: string, substitution: Substitution | null } | null>(null);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    const [deletingSubstitution, setDeletingSubstitution] = useState<Substitution | null>(null);

    if (!dailySchedule) {
        return <p className="text-center text-muted-foreground py-8">Pro tento den není dostupný žádný rozvrh.</p>;
    }

    const { hodiny, timeSlots } = dailySchedule;

    const handleLessonClick = (lesson: LessonBlock, periodIndex: number) => {
        if (!lesson.classId) return;

        if (isTeacher) {
             const substitution = substitutionsData.find(sub => {
                 const subDate = parseISO(sub.date);
                 return isSameDay(subDate, day) && sub.originalLesson.period === periodIndex && sub.originalLesson.classId === dailySchedule.tridaId;
            });
            setSelectedLesson({
                lesson: lesson,
                period: periodIndex + 1,
                time: timeSlots[periodIndex],
                substitution: substitution || null
            });
            setIsActionSheetOpen(true);
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

            let newTeacherName = lesson.teacherName;
            if (substitution!.changes.teacherIds && substitution!.changes.teacherIds.length > 0) {
                newTeacherName = substitution!.changes.teacherIds
                    .map(id => teachers.find(t => t.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');
            }
            
            const newSubject = subjects.find(s => s.id === substitution!.changes.subjectId);
            
            const finalLesson: LessonBlock = {
                ...lesson,
                teacherName: newTeacherName,
                teacherId: substitution!.changes.teacherIds?.[0] || lesson.teacherId,
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
                {items.flat().length > 0 ? items.flat() : <p className="text-center text-muted-foreground py-8">Dnes není žádná výuka.</p>}
            </div>
            <LessonActionSheet 
                lesson={selectedLesson?.lesson || null}
                period={selectedLesson?.period || 0}
                time={selectedLesson?.time || ''}
                day={day}
                isOpen={isActionSheetOpen}
                onOpenChange={setIsActionSheetOpen}
                isTeacher={isTeacher}
                substitution={selectedLesson?.substitution || null}
                onSubstitute={() => {
                    setIsActionSheetOpen(false);
                    setIsSubDialogOpen(true);
                }}
                onCancelSubstitution={() => {
                    if (selectedLesson?.substitution) {
                        setDeletingSubstitution(selectedLesson.substitution);
                    }
                    setIsActionSheetOpen(false);
                }}
            />
             <SubstitutionDialog
                isOpen={isSubDialogOpen}
                onOpenChange={setIsSubDialogOpen}
                lessonInfo={selectedLesson ? {
                    lesson: selectedLesson.lesson,
                    period: selectedLesson.period,
                    classId: dailySchedule.tridaId,
                } : null}
                day={day}
                substitution={selectedLesson?.substitution || null}
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
        </>
    );
}
