'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle, Save, Loader2, Trash2, Edit } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, useDoc, setDocumentNonBlocking } from '@/firebase';
import type { Trida, Rozvrh, LessonBlock, User, Predmet, Ucebna, ScheduleTemplate } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { setDoc, doc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from "@/components/ui/input";

const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
    "15:05-15:50", "15:55-16:40"
];

type ScheduleEditorState = (LessonBlock | null)[][];

function TimeSlotEditDialog({
    isOpen,
    onClose,
    timeSlots,
    onSave,
}: {
    isOpen: boolean;
    onClose: () => void;
    timeSlots: string[];
    onSave: (newTimeSlots: string[]) => void;
}) {
    const [localTimeSlots, setLocalTimeSlots] = useState(timeSlots);

    useEffect(() => {
        setLocalTimeSlots(timeSlots);
    }, [timeSlots]);

    const handleTimeSlotChange = (index: number, value: string) => {
        const newTimeSlots = [...localTimeSlots];
        newTimeSlots[index] = value;
        setLocalTimeSlots(newTimeSlots);
    };

    const handleAddTimeSlot = () => {
        setLocalTimeSlots([...localTimeSlots, ""]);
    };

    const handleRemoveTimeSlot = (index: number) => {
        const newTimeSlots = localTimeSlots.filter((_, i) => i !== index);
        setLocalTimeSlots(newTimeSlots);
    };

    const handleSaveChanges = () => {
        onSave(localTimeSlots.filter(ts => ts.trim() !== '')); // Uloží neprázdné
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Upravit časy vyučování</DialogTitle>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-3">
                    {localTimeSlots.map((ts, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Label className="w-10 text-right">{index + 1}.</Label>
                            <Input
                                value={ts}
                                onChange={(e) => handleTimeSlotChange(index, e.target.value)}
                                placeholder="HH:MM-HH:MM"
                            />
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTimeSlot(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" onClick={handleAddTimeSlot} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Přidat hodinu
                    </Button>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Zrušit</Button></DialogClose>
                    <Button onClick={handleSaveChanges}>Uložit změny</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LessonEditDialog({
    isOpen,
    onClose,
    onSave,
    lesson,
    teachers,
    subjects,
    classrooms,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (lesson: LessonBlock | null) => void;
    lesson: LessonBlock | null;
    teachers: User[];
    subjects: Predmet[];
    classrooms: Ucebna[];
}) {
    const [subjectId, setSubjectId] = useState(lesson?.subjectId || '');
    const [teacherId, setTeacherId] = useState(lesson?.teacherId || '');
    const [classroomId, setClassroomId] = useState(lesson?.ucebnaId || '');

    useEffect(() => {
        setSubjectId(lesson?.subjectId || '');
        setTeacherId(lesson?.teacherId || '');
        setClassroomId(lesson?.ucebnaId || '');
    }, [lesson]);

    const handleSave = () => {
        const subject = subjects.find(s => s.id === subjectId);
        const teacher = teachers.find(t => t.id === teacherId);
        const classroom = classrooms.find(c => c.id === classroomId);

        if (!subject || !teacher) {
            onSave(null); // Or show an error
        } else {
            const newLesson: LessonBlock = {
                ...(lesson || {}), // Retain other properties if editing
                id: lesson?.id || `${subjectId}-${teacherId}-${Date.now()}`,
                subjectId,
                teacherId,
                classId: lesson?.classId || '', // classId should be passed down or handled differently
                subjectName: subject.name,
                subjectShortcut: subject.shortcut,
                teacherName: teacher.name,
                className: lesson?.className || '', // same for className
                ucebnaId: classroomId,
                ucebnaName: classroom?.nazev,
            };
            onSave(newLesson);
        }
    };
    
    const handleDelete = () => {
        onSave(null);
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{lesson ? 'Upravit hodinu' : 'Přidat hodinu'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="subject">Předmět</Label>
                        <Select value={subjectId} onValueChange={setSubjectId}>
                            <SelectTrigger id="subject"><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                            <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.shortcut})</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="teacher">Učitel</Label>
                        <Select value={teacherId} onValueChange={setTeacherId}>
                            <SelectTrigger id="teacher"><SelectValue placeholder="Vyberte učitele" /></SelectTrigger>
                            <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="classroom">Učebna</Label>
                        <Select value={classroomId} onValueChange={setClassroomId}>
                            <SelectTrigger id="classroom"><SelectValue placeholder="Vyberte učebnu" /></SelectTrigger>
                            <SelectContent>{classrooms.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="justify-between">
                    <div>
                         {lesson && (
                            <Button variant="destructive" onClick={handleDelete}>Smazat hodinu</Button>
                         )}
                    </div>
                    <div className="flex gap-2">
                        <DialogClose asChild><Button variant="outline">Zrušit</Button></DialogClose>
                        <Button onClick={handleSave}>Uložit</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function ScheduleEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [timeSlots, setTimeSlots] = useState<string[]>(defaultTimeSlots);

    // Data fetching
    const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
    const { data: classes, isLoading: classesLoading } = useCollection<Trida>(tridyCollection);
    
    const scheduleTemplateRef = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        return doc(firestore, 'scheduleTemplates', selectedClassId);
    }, [firestore, selectedClassId]);
    const { data: scheduleTemplate, isLoading: templateLoading } = useDoc<ScheduleTemplate>(scheduleTemplateRef);


    const uciteleQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]);
    const { data: teachers, isLoading: teachersLoading } = useCollection<User>(uciteleQuery);

    const predmetyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]);
    const { data: subjects, isLoading: subjectsLoading } = useCollection<Predmet>(predmetyCollection);

    const ucebnyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'ucebny') : null, [firestore]);
    const { data: classrooms, isLoading: classroomsLoading } = useCollection<Ucebna>(ucebnyCollection);


    const [schedule, setSchedule] = useState<ScheduleEditorState>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
    const [isTimeSlotDialogOpen, setIsTimeSlotDialogOpen] = useState(false);
    const [editingCell, setEditingCell] = useState<{ dayIndex: number, periodIndex: number } | null>(null);


    useEffect(() => {
        if (classes && classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);
    
    useEffect(() => {
        if (selectedClassId) {
            if (scheduleTemplate) {
                const validTemplate = Array.isArray(scheduleTemplate.days) && scheduleTemplate.days.length > 0 ? scheduleTemplate.days : [];
                setSchedule(validTemplate);
                setTimeSlots(scheduleTemplate.timeSlots || defaultTimeSlots);
            } else if (!templateLoading) {
                const emptySchedule: ScheduleEditorState = Array(daysOfWeek.length).fill(null).map(() => Array(timeSlots.length).fill(null));
                setSchedule(emptySchedule);
                setTimeSlots(defaultTimeSlots);
            }
        }
    }, [selectedClassId, scheduleTemplate, templateLoading]);


    const handleSave = async () => {
        if (!selectedClassId || !firestore) {
            toast({ variant: "destructive", title: "Chyba", description: "Není vybrána žádná třída." });
            return;
        }
        setIsSaving(true);
        try {
            const templateRef = doc(firestore, 'scheduleTemplates', selectedClassId);
            const templateData: ScheduleTemplate = {
                id: selectedClassId,
                tridaId: selectedClassId,
                timeSlots: timeSlots,
                days: schedule,
                // The 'ziaciIds' field is part of the 'Trida' entity, not 'ScheduleTemplate'.
                // Adding a placeholder here to satisfy a potential implicit requirement,
                // but this should ideally be handled by fetching the class data if needed.
                // Or the type definition for ScheduleTemplate should be updated if it needs this field.
                ziaciIds: [], 
            };
            
            setDocumentNonBlocking(templateRef, templateData, { merge: true });

            toast({ title: "Šablona rozvrhu uložena", description: "Změny v šabloně byly úspěšně uloženy." });
        } catch (error) {
            console.error("Error saving schedule template:", error);
            toast({ variant: "destructive", title: "Chyba ukládání", description: "Při ukládání šablony rozvrhu došlo k chybě." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCellClick = (dayIndex: number, periodIndex: number) => {
        setEditingCell({ dayIndex, periodIndex });
        setIsLessonDialogOpen(true);
    }
    
    const handleDialogClose = () => {
        setIsLessonDialogOpen(false);
        setEditingCell(null);
    }
    
    const handleTimeSlotSave = (newTimeSlots: string[]) => {
        const oldLength = timeSlots.length;
        const newLength = newTimeSlots.length;
        setTimeSlots(newTimeSlots);

        // Adjust schedule array if number of periods changed
        if (oldLength !== newLength) {
            const newSchedule = schedule.map(daySchedule => {
                if (daySchedule.length > newLength) {
                    return daySchedule.slice(0, newLength);
                } else if (daySchedule.length < newLength) {
                    return [...daySchedule, ...Array(newLength - daySchedule.length).fill(null)];
                }
                return daySchedule;
            });
            setSchedule(newSchedule);
        }
    };

    const handleDialogSave = (lesson: LessonBlock | null) => {
        if (editingCell) {
            const { dayIndex, periodIndex } = editingCell;
            const newSchedule = [...schedule];
            if (!newSchedule[dayIndex]) {
                 newSchedule[dayIndex] = Array(timeSlots.length).fill(null);
            }
            
            const selectedClass = classes?.find(c => c.id === selectedClassId);
            
            let finalLesson = lesson;
            if(finalLesson) {
                finalLesson = {
                    ...finalLesson,
                    classId: selectedClassId || '',
                    className: selectedClass?.nazev || '',
                }
            }
            
            newSchedule[dayIndex][periodIndex] = finalLesson;
            setSchedule(newSchedule);
        }
        handleDialogClose();
    };

    const isDataLoading = classesLoading || teachersLoading || subjectsLoading || classroomsLoading || templateLoading;
    const currentLesson = editingCell ? schedule[editingCell.dayIndex]?.[editingCell.periodIndex] : null;

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Editor šablon rozvrhů</CardTitle>
                    <CardDescription>Vytvářejte a upravujte šablony rozvrhů pro jednotlivé třídy.</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                     <Select onValueChange={setSelectedClassId} value={selectedClassId || ''} disabled={classesLoading}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Vyberte třídu" />
                        </SelectTrigger>
                        <SelectContent>
                            {classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Button variant="outline" onClick={() => setIsTimeSlotDialogOpen(true)} disabled={!selectedClassId}>
                        <Edit className="mr-2 h-4 w-4" />
                        Upravit časy
                    </Button>
                    <Button onClick={handleSave} disabled={!selectedClassId || isDataLoading || isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Uložit šablonu
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isDataLoading && !scheduleTemplate ? (
                    <div className="flex justify-center items-center h-48">Načítání dat...</div>
                ) : (
                    <div className="border rounded-lg overflow-auto">
                        <div className={cn("grid", `grid-cols-[auto_repeat(${daysOfWeek.length},1fr)]`)}
                             style={{ gridTemplateColumns: `auto repeat(${daysOfWeek.length}, minmax(120px, 1fr))`}}
                        >
                             {/* Corner */}
                             <div className="border-b border-r bg-muted/50 p-2"></div>
                             {/* Day Headers */}
                             {daysOfWeek.map(day => (
                                 <div key={day} className="p-2 text-center font-semibold border-b border-r bg-muted/50">{day}</div>
                             ))}

                             {/* Time Slots and Cells */}
                             {timeSlots.map((time, periodIndex) => (
                                 <React.Fragment key={time}>
                                    <div className="flex flex-col items-center justify-center p-2 text-center font-semibold border-b border-r bg-muted/50 text-sm">
                                        <span>{periodIndex + 1}.</span>
                                        <span className="text-xs text-muted-foreground">{time}</span>
                                    </div>
                                    {daysOfWeek.map((day, dayIndex) => {
                                        const lesson = schedule[dayIndex]?.[periodIndex];
                                        return (
                                            <div 
                                                key={`${day}-${periodIndex}`} 
                                                className="p-1 border-b border-r min-h-[70px] hover:bg-accent/50 cursor-pointer transition-colors"
                                                onClick={() => handleCellClick(dayIndex, periodIndex)}
                                            >
                                                {lesson ? (
                                                    <div className="bg-primary/20 p-1 rounded-sm text-xs h-full flex flex-col justify-center text-center">
                                                        <p className="font-bold">{lesson.subjectShortcut}</p>
                                                        <p>{lesson.teacherName}</p>
                                                        <p className="text-muted-foreground">{lesson.ucebnaName}</p>
                                                    </div>
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center">
                                                        <PlusCircle className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                 </React.Fragment>
                             ))}

                        </div>
                    </div>
                )}
            </CardContent>
             <TimeSlotEditDialog
                isOpen={isTimeSlotDialogOpen}
                onClose={() => setIsTimeSlotDialogOpen(false)}
                timeSlots={timeSlots}
                onSave={handleTimeSlotSave}
            />
            <LessonEditDialog
                isOpen={isLessonDialogOpen}
                onClose={handleDialogClose}
                onSave={handleDialogSave}
                lesson={currentLesson}
                teachers={teachers || []}
                subjects={subjects || []}
                classrooms={classrooms || []}
            />
        </Card>
    );
}

// Placeholder for new components
function SubstitutionPlanner() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Plánování suplování</CardTitle>
                <CardDescription>Zde můžete zadávat a spravovat suplování za chybějící učitele.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>Obsah pro plánování suplování bude brzy doplněn.</p>
            </CardContent>
        </Card>
    );
}

function SchedulePreview() {
    const [view, setView] = useState<'static' | 'with_changes'>('with_changes');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Náhled rozvrhu</CardTitle>
                <CardDescription>Zobrazení aktuálního stavu rozvrhů a suplování.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={view} onValueChange={(value) => setView(value as any)} className="w-full">
                    <TabsList>
                        <TabsTrigger value="with_changes">Rozvrh se změnami</TabsTrigger>
                        <TabsTrigger value="static">Statický rozvrh</TabsTrigger>
                    </TabsList>
                    <TabsContent value="with_changes" className="mt-4">
                       <p>Zde se zobrazí rozvrh včetně všech suplování, odpadlých hodin a událostí.</p>
                    </TabsContent>
                     <TabsContent value="static" className="mt-4">
                       <p>Zde se zobrazí základní podoba rozvrhu dle šablony.</p>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}


export default function RozvrhySuplovaniPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Rozvrhy a suplování</h1>
                <p className="text-muted-foreground">Správa rozvrhů a plánování suplování.</p>
            </div>
            <Tabs defaultValue="rozvrhy">
                <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="rozvrhy">Šablony rozvrhů</TabsTrigger>
                        <TabsTrigger value="suplovani">Plánování suplování</TabsTrigger>
                        <TabsTrigger value="nahled">Náhled</TabsTrigger>
                    </TabsList>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Přidat novou akci
                    </Button>
                </div>
                <TabsContent value="rozvrhy" className="mt-4">
                   <ScheduleEditor />
                </TabsContent>
                <TabsContent value="suplovani" className="mt-4">
                    <SubstitutionPlanner />
                </TabsContent>
                <TabsContent value="nahled" className="mt-4">
                    <SchedulePreview />
                </TabsContent>
            </Tabs>
        </div>
    );
}
