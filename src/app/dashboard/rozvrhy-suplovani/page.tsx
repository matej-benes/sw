'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle, Save, Loader2, Trash2, Edit, CalendarIcon, X, Info, VenetianMask } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, useDoc, setDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { Trida, LessonBlock, User, Predmet, Ucebna, ScheduleTemplate, Rozvrh, Substitution, Absence, Udalost } from '@/lib/types';
import { collection, query, where, doc, getDoc, writeBatch } from 'firebase/firestore';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, getDay, isSameDay } from "date-fns";
import { cs } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { ScheduleGenerator } from "@/components/schedule-generator";
import { useAuth } from "@/hooks/use-auth";


const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
    "15:05-15:50", "15:55-16:40"
];

type ScheduleEditorState = (LessonBlock | null)[][];
type StorableDay = { dayIndex: number; lessons: (LessonBlock | null)[] };

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
                ucebnaId: classroomId || null,
                ucebnaName: classroom?.nazev || null,
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
    const { activeOrganizationId } = useAuth();

    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [timeSlots, setTimeSlots] = useState<string[]>(defaultTimeSlots);

    // Data fetching
    const { data: classes, isLoading: classesLoading } = useCollection<Trida>(
      useMemoFirebase(() => (firestore ? collection(firestore, 'tridy') : null), [firestore])
    );
    
    const scheduleTemplateRef = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        return doc(firestore, 'scheduleTemplates', selectedClassId);
    }, [firestore, selectedClassId]);
    const { data: scheduleTemplate, isLoading: templateLoading } = useDoc<ScheduleTemplate>(scheduleTemplateRef);


    const uciteleQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "users"), where("roles", "array-contains", "ucitel"));
    }, [firestore]);
    const { data: teachers, isLoading: teachersLoading } = useCollection<User>(uciteleQuery);

    const predmetyCollection = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'predmety'))
    }, [firestore]);
    const { data: subjects, isLoading: subjectsLoading } = useCollection<Predmet>(predmetyCollection);

    const ucebnyCollection = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'ucebny'))
    }, [firestore]);
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
            if (scheduleTemplate && scheduleTemplate.days) {
                // Convert from Firestore format to 2D array for the editor
                const newSchedule: ScheduleEditorState = Array(daysOfWeek.length).fill(null).map(() => Array(timeSlots.length).fill(null));
                scheduleTemplate.days.forEach(day => {
                    newSchedule[day.dayIndex] = day.lessons;
                });
                setSchedule(newSchedule);
                setTimeSlots(scheduleTemplate.timeSlots || defaultTimeSlots);
            } else if (!templateLoading) {
                 // No template exists, create an empty one
                const emptySchedule: ScheduleEditorState = Array(daysOfWeek.length).fill(null).map(() => Array(timeSlots.length).fill(null));
                setSchedule(emptySchedule);
                setTimeSlots(defaultTimeSlots);
            }
        }
    }, [selectedClassId, scheduleTemplate, templateLoading]);


    const handleSave = async () => {
        if (!selectedClassId || !firestore || !activeOrganizationId) {
            toast({ variant: "destructive", title: "Chyba", description: "Není vybrána žádná třída nebo chybí ID organizace." });
            return;
        }
        setIsSaving(true);
        try {
            const templateRef = doc(firestore, 'scheduleTemplates', selectedClassId);

            // Function to sanitize an object, replacing undefined with null recursively
            const sanitizeObject = (obj: any): any => {
                if (obj === null || obj === undefined) return null;
                if (typeof obj !== 'object') return obj;

                if (Array.isArray(obj)) {
                    return obj.map(sanitizeObject);
                }

                const newObj: { [key: string]: any } = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        const value = obj[key];
                        newObj[key] = value === undefined ? null : sanitizeObject(value);
                    }
                }
                return newObj;
            };
            
            // Convert 2D schedule array to a format Firestore accepts and sanitize it
            const storableDays: StorableDay[] = schedule.map((dayLessons, index) => ({
                dayIndex: index,
                lessons: (dayLessons || []).map(lesson => sanitizeObject(lesson))
            })).filter(day => day.lessons.some(l => l !== null));

            const templateData: ScheduleTemplate = {
                id: selectedClassId,
                organizationId: activeOrganizationId,
                tridaId: selectedClassId,
                timeSlots: timeSlots,
                days: storableDays,
            };
            
            await setDocumentNonBlocking(templateRef, templateData, { merge: true });

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

function AbsencePlanner() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeOrganizationId } = useAuth();

    const [teacherId, setTeacherId] = useState<string>('');
    const [date, setDate] = useState<DateRange | undefined>({ from: new Date(), to: addDays(new Date(), 1) });
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const { data: teachers, isLoading: teachersLoading } = useCollection<User>(
        useMemoFirebase(() => {
            if (!firestore) return null;
            return query(collection(firestore, "users"), where("roles", "array-contains", "ucitel"));
        }, [firestore])
    );
    const { data: absences, isLoading: absencesLoading } = useCollection<Absence>(
        useMemoFirebase(() => {
            if (!firestore || !activeOrganizationId) return null;
            return query(collection(firestore, 'absences'), where('organizationId', '==', activeOrganizationId));
        }, [firestore, activeOrganizationId])
    );

    const teacherAbsences = useMemo(() => {
        if (!absences) return [];
        return absences.filter((a: any) => a.teacherId && a.startDate && a.endDate);
    }, [absences]);
    
    const handleDelete = async (absenceId: string) => {
        if (!firestore) return;
        await deleteDocumentNonBlocking(doc(firestore, 'absences', absenceId));
        toast({ title: "Absence smazána" });
    }

    const handleSave = async () => {
        if (!firestore || !teacherId || !date?.from || !date?.to || !activeOrganizationId) {
            toast({ variant: "destructive", title: "Chybějící údaje", description: "Vyberte učitele a rozsah data." });
            return;
        }
        setIsSaving(true);
        try {
            await addDocumentNonBlocking(collection(firestore, 'absences'), {
                organizationId: activeOrganizationId,
                teacherId,
                startDate: format(date.from, 'yyyy-MM-dd'),
                endDate: format(date.to, 'yyyy-MM-dd'),
                reason,
            });
            toast({ title: "Absence uložena" });
            setTeacherId('');
            setReason('');
            setDate({ from: new Date(), to: addDays(new Date(), 1) });
        } catch (error) {
            console.error("Error saving absence: ", error);
            toast({ variant: "destructive", title: "Chyba při ukládání" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const getTeacherName = (id: string) => teachers?.find(t => t.id === id)?.name || 'Neznámý učitel';

     return (
        <Card>
            <CardHeader>
                <CardTitle>Evidence absencí</CardTitle>
                <CardDescription>Zde můžete zadávat absence učitelů, které slouží jako podklad pro suplování.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Nová absence</h3>
                     <div className="grid gap-1.5">
                        <Label>Učitel</Label>
                        <Select value={teacherId} onValueChange={setTeacherId} disabled={teachersLoading}>
                            <SelectTrigger>
                                <SelectValue placeholder="Vyberte učitele" />
                            </SelectTrigger>
                            <SelectContent>
                                {teachers?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-1.5">
                        <Label>Datum od - do</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                date.to ? (
                                    <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                    </>
                                ) : (
                                    format(date.from, "LLL dd, y")
                                )
                                ) : (
                                <span>Vyberte datum</span>
                                )}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                                locale={cs}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Důvod (nepovinné)</Label>
                        <Textarea value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                        Uložit absenci
                    </Button>
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Seznam zadaných absencí</h3>
                    {absencesLoading ? <p>Načítání...</p> : (
                        <div className="border rounded-md max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Učitel</TableHead>
                                        <TableHead>Od</TableHead>
                                        <TableHead>Do</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {teacherAbsences && teacherAbsences.length > 0 ? teacherAbsences.map((absence: any) => (
                                        <TableRow key={absence.id}>
                                            <TableCell className="font-medium">{getTeacherName(absence.teacherId)}</TableCell>
                                            <TableCell>{format(parseISO(absence.startDate), "d.M.yyyy")}</TableCell>
                                            <TableCell>{format(parseISO(absence.endDate), "d.M.yyyy")}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(absence.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">Žádné absence k zobrazení.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function SubstitutionPlanner() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [date, setDate] = useState(new Date());

    const { data: absences, isLoading: absencesLoading } = useCollection<Absence>(useMemoFirebase(() => firestore ? collection(firestore, 'absences') : null, [firestore]));
    const { data: allTemplates, isLoading: templatesLoading } = useCollection<ScheduleTemplate>(useMemoFirebase(() => firestore ? collection(firestore, 'scheduleTemplates') : null, [firestore]));
    const { data: teachers, isLoading: teachersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]));

    const absentTeachersToday = useMemo(() => {
        if (!absences) return [];
        return absences
            .filter((a: any) => a.startDate && a.endDate && isWithinInterval(date, { start: parseISO(a.startDate), end: parseISO(a.endDate) }))
            .map((a: any) => a.teacherId);
    }, [absences, date]);

    const lessonsToSubstitute = useMemo(() => {
        if (!allTemplates || absentTeachersToday.length === 0) return [];
        const dayIndex = (getDay(date) + 6) % 7; // Monday = 0
        
        let lessons: { lesson: LessonBlock, day: string, period: number, classId: string }[] = [];

        allTemplates.forEach(template => {
            const daySchedule = template.days.find(d => d.dayIndex === dayIndex);
            if (daySchedule) {
                daySchedule.lessons.forEach((lesson, periodIndex) => {
                    if (lesson && absentTeachersToday.includes(lesson.teacherId)) {
                        lessons.push({
                            lesson,
                            day: daysOfWeek[dayIndex],
                            period: periodIndex,
                            classId: template.tridaId,
                        });
                    }
                });
            }
        });
        return lessons;
    }, [allTemplates, absentTeachersToday, date]);

    const isLoading = absencesLoading || templatesLoading || teachersLoading;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Plánování suplování</CardTitle>
                        <CardDescription>Zadejte a spravujte suplování za chybějící učitele.</CardDescription>
                    </div>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" /> {format(date, "d. MMMM yyyy", { locale: cs })}</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={cs} />
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="font-semibold">Hodiny k suplování</h3>
                     {isLoading ? (
                        <p>Načítání...</p>
                    ) : lessonsToSubstitute.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Pro tento den nejsou žádné hodiny k suplování.</p>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {lessonsToSubstitute.map((item, index) => (
                                <div key={index} className="p-3 border rounded-lg hover:bg-muted cursor-pointer">
                                    <p className="font-bold">{item.lesson.subjectName} <span className="font-normal text-muted-foreground">({item.lesson.className})</span></p>
                                    <p className="text-sm">Původní učitel: {item.lesson.teacherName}</p>
                                    <p className="text-sm text-muted-foreground">{item.period + 1}. hodina ({allTemplates?.find(t => t.id === item.classId)?.timeSlots[item.period]})</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                 <div className="lg:col-span-2">
                    <h3 className="font-semibold">Detail suplování</h3>
                    <div className="mt-4 border rounded-lg p-6 h-full flex items-center justify-center bg-muted/50">
                        <p className="text-muted-foreground">Vyberte hodinu vlevo pro zadání suplování.</p>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}

function SchedulePreview() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    
    const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
    const { data: classes, isLoading: classesLoading } = useCollection<Trida>(tridyCollection);

    const scheduleId = useMemo(() => {
        if (!selectedClassId) return null;
        return `${selectedClassId}-${format(selectedDate, 'yyyy-MM-dd')}`;
    }, [selectedClassId, selectedDate]);

    const scheduleRef = useMemoFirebase(() => scheduleId ? doc(firestore, 'rozvrhy', scheduleId) : null, [scheduleId, firestore]);
    const { data: scheduleData, isLoading: scheduleLoading } = useDoc<Rozvrh>(scheduleRef);

    const eventsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        return query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains', selectedClassId));
    }, [firestore, selectedClassId]);

    const { data: events, isLoading: eventsLoading } = useCollection<Udalost>(eventsQuery);

    const dailyEvents = useMemo(() => {
        if (!events || !selectedClassId) return [];
        return events.filter(event => 
            isSameDay(parseISO(event.datum), selectedDate) &&
            event.tridyIds.includes(selectedClassId)
        );
    }, [events, selectedDate, selectedClassId]);

    useEffect(() => {
        if (classes && classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);

    const handleDeleteLesson = async (periodIndex: number) => {
        if (!scheduleRef || !scheduleData) return;

        const newHodiny = [...scheduleData.hodiny];
        newHodiny[periodIndex] = null;

        try {
            await updateDocumentNonBlocking(scheduleRef, { hodiny: newHodiny });
            toast({
                title: "Hodina smazána",
                description: `Hodina byla pro tento den odstraněna z rozvrhu.`,
            });
        } catch (error) {
            console.error("Error deleting lesson:", error);
            toast({
                variant: "destructive",
                title: "Chyba",
                description: "Nepodařilo se smazat hodinu.",
            });
        }
    };
    
    const isLoading = classesLoading || scheduleLoading || eventsLoading;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Náhled a úprava denního rozvrhu</CardTitle>
                <CardDescription>Zobrazení aktuálního stavu rozvrhu pro vybraný den s možností jednorázových úprav.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <Select onValueChange={setSelectedClassId} value={selectedClassId || ''} disabled={classesLoading}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Vyberte třídu" />
                        </SelectTrigger>
                        <SelectContent>
                            {classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className="w-[280px] justify-start text-left font-normal"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP", {locale: cs}) : <span>Vyberte datum</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(day) => day && setSelectedDate(day)}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                {isLoading ? (
                     <div className="text-center p-8">Načítání rozvrhu...</div>
                ) : !scheduleData ? (
                    <div className="text-center p-8 text-muted-foreground">Pro tento den nebyl nalezen žádný rozvrh. Zkuste jiný den nebo třídu.</div>
                ) : (
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                           <thead>
                                <tr className="bg-muted/50">
                                    <th className="p-2 text-left font-semibold">Hodina</th>
                                    <th className="p-2 text-left font-semibold">Čas</th>
                                    <th className="p-2 text-left font-semibold">Předmět</th>
                                    <th className="p-2 text-left font-semibold">Učitel</th>
                                    <th className="p-2 text-left font-semibold">Učebna</th>
                                    <th className="p-2 text-center font-semibold">Akce</th>
                                </tr>
                           </thead>
                            <tbody>
                                {scheduleData.hodiny.map((lesson, index) => {
                                    const timeSlot = scheduleData.timeSlots[index];
                                    const event = dailyEvents.find(e => e.cas === timeSlot?.split('-')[0] && e.nahrazujeHodiny);
                                    
                                    if (event) {
                                        return (
                                            <tr key={index} className="border-t bg-accent/10">
                                                <td className="p-2 font-medium">{index + 1}.</td>
                                                <td className="p-2 text-muted-foreground">{timeSlot}</td>
                                                <td colSpan={3} className="p-2 font-semibold text-accent-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <Info className="h-4 w-4 text-accent" />
                                                        {event.nazev} ({event.typ})
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center"></td>
                                            </tr>
                                        )
                                    }
                                    
                                    return (
                                        <tr key={index} className="border-t">
                                            <td className="p-2 font-medium">{index + 1}.</td>
                                            <td className="p-2 text-muted-foreground">{timeSlot}</td>
                                            {lesson ? (
                                                <>
                                                    <td className="p-2 font-semibold">{lesson.subjectName} ({lesson.subjectShortcut})</td>
                                                    <td className="p-2">{lesson.teacherName}</td>
                                                    <td className="p-2">{lesson.ucebnaName}</td>
                                                    <td className="p-2 text-center">
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Opravdu chcete smazat tuto hodinu?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Tato akce trvale odstraní hodinu <strong>{lesson.subjectName}</strong> z rozvrhu pro den <strong>{format(selectedDate, "d. M. yyyy")}.</strong> Tato změna se neprojeví v šabloně.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteLesson(index)}>Smazat</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </td>
                                                </>
                                            ) : (
                                                <td colSpan={4} className="p-2 text-center text-muted-foreground italic">Volná hodina</td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}

export default function RozvrhySuplovaniPage() {
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const { hasRole } = useAuth();
    const isAdministrator = hasRole('administrator');
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
                         <TabsTrigger value="absence">Absence</TabsTrigger>
                        <TabsTrigger value="suplovani">Plánování suplování</TabsTrigger>
                        {isAdministrator && <TabsTrigger value="nahled">Náhled a úpravy</TabsTrigger>}
                    </TabsList>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsGeneratorOpen(true)}>
                            <VenetianMask className="mr-2 h-4 w-4" />
                            Generovat rozvrh z šablon
                        </Button>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Přidat novou akci
                        </Button>
                    </div>

                </div>
                <TabsContent value="rozvrhy" className="mt-4">
                   <ScheduleEditor />
                </TabsContent>
                 <TabsContent value="absence" className="mt-4">
                    <AbsencePlanner />
                </TabsContent>
                <TabsContent value="suplovani" className="mt-4">
                    <SubstitutionPlanner />
                </TabsContent>
                 {isAdministrator && (
                    <TabsContent value="nahled" className="mt-4">
                        <SchedulePreview />
                    </TabsContent>
                 )}
            </Tabs>
             <ScheduleGenerator 
                isOpen={isGeneratorOpen}
                onOpenChange={setIsGeneratorOpen}
            />
        </div>
    );
}
