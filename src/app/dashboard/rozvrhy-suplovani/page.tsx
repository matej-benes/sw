'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, Save, Edit, Plus, Minus, Calendar as CalendarIcon, X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDoc, setDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { Trida, User, Predmet, Ucebna, LessonBlock, ScheduleGrid, Substitution, Rozvrh } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const lessonSchema = z.object({
    subjectId: z.string().min(1, "Předmět je povinný"),
    teacherId: z.string().min(1, "Učitel je povinný"),
    classId: z.string().min(1, "Třída je povinná"),
    ucebnaId: z.string().optional(),
});

type LessonFormData = z.infer<typeof lessonSchema>;

const initialTimeSlots = [
    "7:55-8:40", "8:55-9:40", "9:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00"
];
const daysOfWeek = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];

const buildInitialSchedule = (slots: string[]): ScheduleGrid => {
    return daysOfWeek.reduce((acc, day) => {
      acc[day] = {};
      slots.forEach((_, index) => {
        acc[day][index] = null;
      });
      return acc;
    }, {} as ScheduleGrid);
}

const initialSchedule = buildInitialSchedule(initialTimeSlots);

// Substitution Component
type DailyLesson = { day: string; period: number; classInfo: Trida; lesson: LessonBlock | null };

function SubstitutionManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [dailySchedule, setDailySchedule] = useState<DailyLesson[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [selectedLessonForSub, setSelectedLessonForSub] = useState<DailyLesson | null>(null);

    // Data fetching
    const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
    const { data: tridy } = useCollection<Trida>(tridyCollection);

    const uciteleQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]);
    const { data: ucitele } = useCollection<User>(uciteleQuery);

    const ucebnyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'ucebny') : null, [firestore]);
    const { data: ucebny } = useCollection<Ucebna>(ucebnyCollection);

    const predmetyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]);
    const { data: predmety } = useCollection<Predmet>(predmetyCollection);

    useEffect(() => {
        const fetchDailySchedule = async () => {
            if (!firestore || !tridy) return;
            setIsLoading(true);

            const dayIndex = selectedDate.getDay(); // 0 (Sun) - 6 (Sat)
            const dayOfWeek = daysOfWeek[dayIndex -1];
            if (!dayOfWeek) {
                setDailySchedule([]);
                setIsLoading(false);
                return;
            }

            const allLessons: DailyLesson[] = [];
            
            for(const trida of tridy) {
                const rozvrhRef = doc(firestore, 'rozvrhy', `${trida.id}-${dayOfWeek}`);
                const rozvrhSnap = await getDoc(rozvrhRef);
                if (rozvrhSnap.exists()) {
                    const rozvrhData = rozvrhSnap.data() as Rozvrh;
                    const lessonsForDay = rozvrhData.hodiny || [];
                    const timeSlots = rozvrhData.timeSlots || initialTimeSlots;

                    for(let i = 0; i < timeSlots.length; i++) {
                        allLessons.push({
                            day: dayOfWeek,
                            period: i,
                            classInfo: trida,
                            lesson: lessonsForDay[i] || null
                        });
                    }
                }
            }
            setDailySchedule(allLessons.filter(l => l.lesson));
            setIsLoading(false);
        }
        fetchDailySchedule();

    }, [selectedDate, tridy, firestore]);

    const handleOpenSubDialog = (lesson: DailyLesson) => {
        setSelectedLessonForSub(lesson);
        setIsSubModalOpen(true);
    };

    const handleSaveSubstitution = async (changes: any) => {
        if (!firestore || !selectedLessonForSub) return;
        
        const subData: Omit<Substitution, 'id'> = {
            date: format(selectedDate, 'yyyy-MM-dd'),
            originalLesson: {
                day: selectedLessonForSub.day,
                period: selectedLessonForSub.period,
                classId: selectedLessonForSub.classInfo.id,
                lessonBlock: selectedLessonForSub.lesson!
            },
            changes: changes
        };

        try {
            await addDocumentNonBlocking(collection(firestore, 'suplovani'), subData);
            toast({ title: "Suplování uloženo", description: "Změna byla úspěšně zapsána."});
            setIsSubModalOpen(false);
            setSelectedLessonForSub(null);
            // TODO: Refresh view to show substitution
        } catch (error) {
            toast({ variant: 'destructive', title: "Chyba", description: "Nepodařilo se uložit suplování."});
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-center">
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-[280px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP', { locale: cs }) : <span>Vyberte datum</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(startOfDay(date))} initialFocus />
                    </PopoverContent>
                </Popover>
                 <Button>Spojit hodiny</Button>
            </div>
           
            <Card>
                <CardHeader>
                    <CardTitle>Denní přehled hodin pro {format(selectedDate, 'd. M. yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Načítání...</p> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {dailySchedule.map((item, index) => (
                                <Card key={index} className="cursor-pointer hover:shadow-lg" onClick={() => handleOpenSubDialog(item)}>
                                    <CardContent className="p-3">
                                        <p className="font-bold">{item.period + 1}. hodina</p>
                                        <p>{item.classInfo.nazev} - {item.lesson?.subjectShortcut}</p>
                                        <p className="text-sm text-muted-foreground">{item.lesson?.teacherName}</p>
                                        <p className="text-sm text-muted-foreground">{item.lesson?.ucebnaName || 'N/A'}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {selectedLessonForSub && (
                <SubstitutionDialog 
                    isOpen={isSubModalOpen}
                    setIsOpen={setIsSubModalOpen}
                    lessonData={selectedLessonForSub}
                    onSave={handleSaveSubstitution}
                    teachers={ucitele || []}
                    classrooms={ucebny || []}
                />
            )}
        </div>
    );
}

function SubstitutionDialog({ isOpen, setIsOpen, lessonData, onSave, teachers, classrooms }: { isOpen: boolean, setIsOpen: (val: boolean) => void, lessonData: DailyLesson, onSave: (changes: any) => void, teachers: User[], classrooms: Ucebna[] }) {
    const [subTeacherId, setSubTeacherId] = useState<string | undefined>(lessonData.lesson?.teacherId);
    const [subUcebnaId, setSubUcebnaId] = useState<string | undefined>(lessonData.lesson?.ucebnaId);
    const [note, setNote] = useState('');
    const [isCancelled, setIsCancelled] = useState(false);

    useEffect(() => {
        setSubTeacherId(lessonData.lesson?.teacherId);
        setSubUcebnaId(lessonData.lesson?.ucebnaId);
        setNote('');
        setIsCancelled(false);
    }, [lessonData]);


    const handleSave = () => {
        const changes: Partial<Substitution['changes']> = {};
        const types: ('zmena-ucitele' | 'zmena-ucebny' | 'zruseno' | 'spojeno')[] = [];

        if(isCancelled) {
            types.push('zruseno');
        } else {
            if(subTeacherId !== lessonData.lesson?.teacherId) {
                types.push('zmena-ucitele');
                changes.teacherId = subTeacherId;
            }
            if(subUcebnaId !== lessonData.lesson?.ucebnaId) {
                types.push('zmena-ucebny');
                changes.ucebnaId = subUcebnaId;
            }
        }

        if (types.length === 0 && !note) {
            setIsOpen(false);
            return;
        }
        
        changes.type = types;
        if (note) changes.note = note;

        onSave(changes);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Zadat suplování</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {lessonData.classInfo.nazev} - {lessonData.period + 1}. hodina ({lessonData.lesson?.subjectName})
                    </p>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <div className="grid gap-1.5">
                        <Label>Učitel</Label>
                        <Select onValueChange={setSubTeacherId} defaultValue={subTeacherId} disabled={isCancelled}>
                            <SelectTrigger><SelectValue placeholder="Vyberte učitele" /></SelectTrigger>
                            <SelectContent>{teachers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-1.5">
                        <Label>Učebna</Label>
                        <Select onValueChange={setSubUcebnaId} defaultValue={subUcebnaId} disabled={isCancelled}>
                            <SelectTrigger><SelectValue placeholder="Vyberte učebnu" /></SelectTrigger>
                            <SelectContent>{classrooms.map(u => <SelectItem key={u.id} value={u.id}>{u.nazev}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Poznámka</Label>
                        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Button variant={isCancelled ? "destructive" : "outline"} onClick={() => setIsCancelled(!isCancelled)}>
                            <X className="mr-2 h-4 w-4" />
                            Hodina odpadá
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                     <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Zrušit</Button>
                    <Button type="button" onClick={handleSave}>Uložit změnu</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


function ScheduleEditor({ selectedClassId, onScheduleChange }: { selectedClassId: string, onScheduleChange: (schedule: ScheduleGrid, slots: string[]) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    // Data fetching
    const predmetyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]);
    const { data: predmety } = useCollection<Predmet>(predmetyCollection);

    const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
    const { data: tridy } = useCollection<Trida>(tridyCollection);

    const uciteleQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]);
    const { data: ucitele } = useCollection<User>(uciteleQuery);
    
    const ucebnyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'ucebny') : null, [firestore]);
    const { data: ucebny } = useCollection<Ucebna>(ucebnyCollection);

    // State
    const [timeSlots, setTimeSlots] = useState(initialTimeSlots);
    const [isEditingTimes, setIsEditingTimes] = useState(false);
    const [lessonBlocks, setLessonBlocks] = useState<LessonBlock[]>([]);
    const [schedule, setSchedule] = useState<ScheduleGrid>(initialSchedule);

    const { control, handleSubmit, reset, watch } = useForm<LessonFormData>({
        resolver: zodResolver(lessonSchema),
        defaultValues: { subjectId: '', teacherId: '', classId: '', ucebnaId: '' }
    });
    
    const subjectId = watch('subjectId');
    const teacherId = watch('teacherId');
    const classId = watch('classId');
    const ucebnaId = watch('ucebnaId');

    // Effect to load schedule when selectedClassId changes
    useEffect(() => {
        const loadSchedule = async (classId: string) => {
            if (!classId || !firestore) {
                const newSchedule = buildInitialSchedule(initialTimeSlots);
                setSchedule(newSchedule);
                setTimeSlots(initialTimeSlots);
                onScheduleChange(newSchedule, initialTimeSlots);
                return;
            };

            const batch = writeBatch(firestore);
            const schedulePromises = daysOfWeek.map(day => getDoc(doc(firestore, 'rozvrhy', `${classId}-${day}`)));
            
            try {
                const scheduleSnapshots = await Promise.all(schedulePromises);
                
                let loadedSomething = false;
                let newScheduleGrid: ScheduleGrid = buildInitialSchedule(initialTimeSlots);
                let newTimeSlots: string[] | null = null;
                
                scheduleSnapshots.forEach((docSnap, index) => {
                    const day = daysOfWeek[index];
                    if (docSnap.exists()) {
                        loadedSomething = true;
                        const data = docSnap.data() as Rozvrh;
                        if (!newTimeSlots) newTimeSlots = data.timeSlots; // Take from first available
                        
                        data.hodiny.forEach((lesson, period) => {
                            newScheduleGrid[day][period] = lesson;
                        });
                    }
                });

                const finalTimeSlots = newTimeSlots || initialTimeSlots;
                if(newTimeSlots) {
                  // Rebuild grid if timeslots were different
                  newScheduleGrid = buildInitialSchedule(finalTimeSlots);
                  scheduleSnapshots.forEach((docSnap, index) => {
                    const day = daysOfWeek[index];
                    if(docSnap.exists()){
                      const data = docSnap.data() as Rozvrh;
                       data.hodiny.forEach((lesson, period) => {
                            if(newScheduleGrid[day] && newScheduleGrid[day].hasOwnProperty(period)) {
                                newScheduleGrid[day][period] = lesson;
                            }
                        });
                    }
                  });
                }
                
                setSchedule(newScheduleGrid);
                setTimeSlots(finalTimeSlots);
                onScheduleChange(newScheduleGrid, finalTimeSlots);

                if (loadedSomething) {
                    toast({ title: 'Rozvrh načten', description: `Rozvrh pro vybranou třídu byl načten.` });
                } else {
                    toast({ title: 'Nový rozvrh', description: 'Pro tuto třídu zatím neexistuje žádný rozvrh.' });
                }
            } catch (error) {
                console.error("Error loading schedule: ", error);
                toast({ variant: 'destructive', title: 'Chyba při načítání', description: 'Nepodařilo se načíst rozvrh.' });
            }
        };

        loadSchedule(selectedClassId);
    }, [selectedClassId, firestore, toast, onScheduleChange]);


    const handleCreateLessonBlock = (data: LessonFormData) => {
        const subject = predmety?.find(p => p.id === data.subjectId);
        const teacher = ucitele?.find(u => u.id === data.teacherId);
        const aClass = tridy?.find(t => t.id === data.classId);
        const aUcebna = ucebny?.find(u => u.id === data.ucebnaId);

        if (!subject || !teacher || !aClass) {
            toast({ variant: 'destructive', title: "Chyba", description: "Nepodařilo se najít vybrané položky." });
            return;
        }

        const newBlock: LessonBlock = {
            id: `${Date.now()}`,
            subjectId: subject.id,
            teacherId: teacher.id,
            classId: aClass.id,
            ucebnaId: aUcebna?.id,
            subjectName: subject.name,
            subjectShortcut: subject.shortcut,
            teacherName: teacher.name.split(' ').pop() || teacher.name, // Last name
            className: aClass.nazev,
            ucebnaName: aUcebna?.nazev
        };

        setLessonBlocks(prev => [...prev, newBlock]);
        reset();
    };

    const handleDragStart = (e: React.DragEvent, block: LessonBlock) => {
        e.dataTransfer.setData("lessonBlock", JSON.stringify(block));
    };

    const handleDrop = (e: React.DragEvent, day: string, period: number) => {
        e.preventDefault();
        const lessonData = e.dataTransfer.getData("lessonBlock");
        if (lessonData) {
            const block = JSON.parse(lessonData) as LessonBlock;
            const newSchedule = {
                ...schedule,
                [day]: {
                    ...schedule[day],
                    [period]: block
                }
            };
            setSchedule(newSchedule);
            onScheduleChange(newSchedule, timeSlots);
        }
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeLessonFromSchedule = (day: string, period: number) => {
        const newSchedule = {
            ...schedule,
            [day]: { ...schedule[day], [period]: null }
        };
        setSchedule(newSchedule);
        onScheduleChange(newSchedule, timeSlots);
    };
    
    const getSubjectColor = (subjectId?: string) => {
        if (!subjectId) return '#E5E7EB';
        let hash = 0;
        for (let i = 0; i < subjectId.length; i++) {
            hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, 70%, 80%)`;
    };

    const handleTimeChange = (index: number, value: string) => {
        const newTimes = [...timeSlots];
        newTimes[index] = value;
        setTimeSlots(newTimes);
        onScheduleChange(schedule, newTimes);
    };

    const addTimeSlot = () => {
        const newTime = "16:00-16:45"; // Default new time
        const newTimeSlots = [...timeSlots, newTime];
        const newSchedule = buildInitialSchedule(newTimeSlots);
        // copy old data
        Object.keys(schedule).forEach(day => {
          Object.keys(schedule[day]).forEach(period => {
              const pIdx = parseInt(period);
              if (newSchedule[day] && newSchedule[day].hasOwnProperty(pIdx)) {
                 newSchedule[day][pIdx] = schedule[day][pIdx];
              }
          })
        });

        setTimeSlots(newTimeSlots);
        setSchedule(newSchedule);
        onScheduleChange(newSchedule, newTimeSlots);
    };

    const removeTimeSlot = () => {
        if (timeSlots.length > 1) {
            const newTimeSlots = timeSlots.slice(0, -1);
            const newSchedule = buildInitialSchedule(newTimeSlots);
             // copy old data
            Object.keys(schedule).forEach(day => {
                Object.keys(schedule[day]).forEach(period => {
                    const pIdx = parseInt(period);
                    if (newSchedule[day] && newSchedule[day].hasOwnProperty(pIdx)) {
                        newSchedule[day][pIdx] = schedule[day][pIdx];
                    }
                })
            });

            setTimeSlots(newTimeSlots);
            setSchedule(newSchedule);
            onScheduleChange(newSchedule, newTimeSlots);
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Editor rozvrhu pro třídu: {tridy?.find(t => t.id === selectedClassId)?.nazev || 'Nevybrána'}</CardTitle>
                         <CardDescription className="flex justify-between items-center">
                            <span>Přetáhněte hodiny z panelu vpravo do mřížky.</span>
                            <div className='flex gap-2'>
                                 <Button variant="outline" size="sm" onClick={addTimeSlot}><Plus className="mr-2 h-4 w-4"/> Přidat hodinu</Button>
                                <Button variant="outline" size="sm" onClick={removeTimeSlot} disabled={timeSlots.length <= 1}><Minus className="mr-2 h-4 w-4"/> Odebrat hodinu</Button>
                            </div>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="grid grid-cols-[auto_repeat(5,1fr)] border-t border-l rounded-tl-lg">
                            {/* Header - Dny */}
                            <div className="border-b border-r p-2 font-bold bg-muted/50 text-center flex items-center justify-center gap-2">
                                Čas
                                <Button variant="ghost" size="icon" onClick={() => setIsEditingTimes(!isEditingTimes)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                            {daysOfWeek.map(day => (
                                <div key={day} className="border-b border-r p-2 font-bold bg-muted/50 text-center">{day}</div>
                            ))}

                            {/* Řádky */}
                            {timeSlots.map((time, periodIndex) => (
                                <React.Fragment key={periodIndex}>
                                    <div className="border-b border-r p-2 font-mono text-xs text-muted-foreground text-center bg-muted/50 flex flex-col justify-center">
                                        <span className='font-bold text-sm'>{periodIndex + 1}.</span>
                                        {isEditingTimes ? (
                                            <Input 
                                                type="text" 
                                                value={time}
                                                onChange={(e) => handleTimeChange(periodIndex, e.target.value)}
                                                className="h-8 text-center mt-1"
                                            />
                                        ) : (
                                            time
                                        )}
                                    </div>
                                    {daysOfWeek.map(day => (
                                        <div 
                                            key={`${day}-${periodIndex}`} 
                                            className="border-b border-r h-24"
                                            onDrop={(e) => handleDrop(e, day, periodIndex)}
                                            onDragOver={handleDragOver}
                                        >
                                            {schedule[day]?.[periodIndex] && (
                                                <div 
                                                    className="h-full p-1 text-xs rounded-sm relative flex flex-col justify-center items-center"
                                                    style={{ backgroundColor: getSubjectColor(schedule[day][periodIndex]!.subjectId) }}
                                                >
                                                    <button 
                                                        onClick={() => removeLessonFromSchedule(day, periodIndex)}
                                                        className="absolute top-0 right-0 p-0.5 bg-black/20 rounded-full text-white hover:bg-destructive"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    <div className="font-bold">{schedule[day][periodIndex]!.subjectShortcut}</div>
                                                    <div>{schedule[day][periodIndex]!.className}</div>
                                                    <div className="text-muted-foreground">{schedule[day][periodIndex]!.teacherName}</div>
                                                    <div className="text-muted-foreground">{schedule[day][periodIndex]!.ucebnaName}</div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Vytvořit hodinu</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(handleCreateLessonBlock)} className="space-y-4">
                            <Controller
                                name="subjectId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                                        <SelectContent>{predmety?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                            />
                            <Controller
                                name="teacherId"
                                control={control}
                                render={({ field }) => (
                                     <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Vyberte učitele" /></SelectTrigger>
                                        <SelectContent>{ucitele?.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                            />
                            <Controller
                                name="classId"
                                control={control}
                                render={({ field }) => (
                                     <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                                        <SelectContent>{tridy?.map(t => <SelectItem key={t.id} value={t.id}>{t.nazev}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                            />
                             <Controller
                                name="ucebnaId"
                                control={control}
                                render={({ field }) => (
                                     <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Vyberte učebnu" /></SelectTrigger>
                                        <SelectContent>{ucebny?.map(u => <SelectItem key={u.id} value={u.id}>{u.nazev}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={!subjectId || !teacherId || !classId}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Přidat blok hodiny
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Připravené hodiny</CardTitle>
                        <CardDescription>Přetáhněte je do rozvrhu</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                        {lessonBlocks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Žádné připravené hodiny.</p>}
                        {lessonBlocks.map((block) => (
                            <div
                                key={block.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, block)}
                                className="p-2 border rounded-lg cursor-grab active:cursor-grabbing text-center text-sm"
                                style={{ backgroundColor: getSubjectColor(block.subjectId) }}
                            >
                                <p className="font-bold">{block.subjectShortcut} - {block.className}</p>
                                <p className="text-xs text-muted-foreground">{block.teacherName}</p>
                                <p className="text-xs text-muted-foreground">{block.ucebnaName}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function RozvrhySuplovaniPage() {
    const firestore = useFirestore();
    const [selectedClassForSchedule, setSelectedClassForSchedule] = useState<string | undefined>();
    const [currentSchedule, setCurrentSchedule] = useState<ScheduleGrid>(initialSchedule);
    const [currentTimeSlots, setCurrentTimeSlots] = useState<string[]>(initialTimeSlots);
    const { toast } = useToast();

    // Data fetching
    const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
    const { data: tridy } = useCollection<Trida>(tridyCollection);

    const handleScheduleChange = (schedule: ScheduleGrid, slots: string[]) => {
        setCurrentSchedule(schedule);
        setCurrentTimeSlots(slots);
    };

    const handleSaveSchedule = async () => {
        if (!selectedClassForSchedule || !firestore) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Prosím, vyberte třídu pro uložení rozvrhu.' });
            return;
        }
        try {
            const batch = writeBatch(firestore);
            
            daysOfWeek.forEach(day => {
                const docId = `${selectedClassForSchedule}-${day}`;
                const scheduleRef = doc(firestore, 'rozvrhy', docId);

                const hodiny: (LessonBlock | null)[] = [];
                for(let i=0; i < currentTimeSlots.length; i++) {
                    hodiny.push(currentSchedule[day]?.[i] || null)
                }

                const dayScheduleData: Omit<Rozvrh, 'id'> = {
                    tridaId: selectedClassForSchedule,
                    den: day,
                    timeSlots: currentTimeSlots,
                    hodiny: hodiny
                };
                
                batch.set(scheduleRef, dayScheduleData);
            });

            await batch.commit();
            toast({ title: 'Rozvrh uložen', description: `Rozvrh pro třídu byl úspěšně uložen.` });
        } catch (error) {
            console.error("Save schedule error: ", error)
            toast({ variant: 'destructive', title: 'Chyba při ukládání', description: 'Nepodařilo se uložit rozvrh.' });
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Rozvrhy a suplování</h1>
                    <p className="text-muted-foreground">Vytvářejte a upravujte týdenní rozvrhy pro třídy a spravujte suplování.</p>
                </div>
                 <div className="flex gap-2">
                     <Select onValueChange={setSelectedClassForSchedule}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Vyberte třídu" />
                        </SelectTrigger>
                        <SelectContent>
                            {tridy?.map(t => <SelectItem key={t.id} value={t.id}>{t.nazev}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Button onClick={handleSaveSchedule} disabled={!selectedClassForSchedule}>
                        <Save className="mr-2 h-4 w-4" />
                        Uložit rozvrh
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="editor">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="editor">Editor rozvrhu</TabsTrigger>
                    <TabsTrigger value="substitution">Správa suplování</TabsTrigger>
                </TabsList>
                <TabsContent value="editor" className="mt-4">
                   <ScheduleEditor selectedClassId={selectedClassForSchedule || ''} onScheduleChange={handleScheduleChange} />
                </TabsContent>
                <TabsContent value="substitution" className="mt-4">
                   <SubstitutionManagement />
                </TabsContent>
            </Tabs>

        </div>
    );
}
