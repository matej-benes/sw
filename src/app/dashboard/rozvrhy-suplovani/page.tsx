'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, Save, Edit, Plus, Minus, Copy, ArrowLeft, ArrowRight } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, getDocs, writeBatch, query, where } from 'firebase/firestore';
import type { Trida, User, Predmet, Ucebna, LessonBlock, DailySchedule, Rozvrh } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format, startOfWeek, addDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { cs } from 'date-fns/locale';

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

const buildInitialWeekSchedule = (week: Date[]): DailySchedule[] => {
    return week.map(date => ({
        date,
        timeSlots: [...initialTimeSlots],
        lessons: Array(initialTimeSlots.length).fill(null),
    }));
};

export default function RozvrhySuplovaniPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedClassId, setSelectedClassId] = useState<string>();
    
    // Week navigation
    const [currentDate, setCurrentDate] = useState(new Date());
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 4) });

    // Data fetching
    const { data: predmety } = useCollection<Predmet>(useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]));
    const { data: tridy } = useCollection<Trida>(useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]));
    const { data: ucitele } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]));
    const { data: ucebny } = useCollection<Ucebna>(useMemoFirebase(() => firestore ? collection(firestore, 'ucebny') : null, [firestore]));

    // State
    const [weekSchedule, setWeekSchedule] = useState<DailySchedule[]>(() => buildInitialWeekSchedule(weekDays));
    const [lessonBlocks, setLessonBlocks] = useState<LessonBlock[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sourceWeek, setSourceWeek] = useState<Date | undefined>();

    const { control, handleSubmit, reset, watch } = useForm<LessonFormData>({
        resolver: zodResolver(lessonSchema),
        defaultValues: { subjectId: '', teacherId: '', classId: '', ucebnaId: '' }
    });
    
    const { subjectId, teacherId, classId, ucebnaId } = watch();

    const loadScheduleForWeek = useCallback(async (classId: string, week: Date[]) => {
        if (!firestore) return;
        setIsLoading(true);

        const newWeekSchedule = buildInitialWeekSchedule(week);
        
        try {
            const docIds = week.map(day => `${classId}-${format(day, 'yyyy-MM-dd')}`);
            const scheduleQuery = query(collection(firestore, 'rozvrhy'), where('__name__', 'in', docIds));
            const querySnapshot = await getDocs(scheduleQuery);

            querySnapshot.forEach(docSnap => {
                const data = docSnap.data() as Rozvrh;
                const date = new Date(data.datum + 'T00:00:00'); // Ensure correct date parsing
                const dayIndex = newWeekSchedule.findIndex(d => isSameDay(d.date, date));
                
                if (dayIndex !== -1) {
                    newWeekSchedule[dayIndex] = {
                        date: date,
                        timeSlots: data.timeSlots || initialTimeSlots,
                        lessons: data.hodiny
                    };
                }
            });
            
            setWeekSchedule(newWeekSchedule);
            toast({ title: 'Rozvrh načten', description: `Rozvrh pro třídu na vybraný týden byl načten.` });
        } catch (error) {
            console.error("Error loading week schedule: ", error);
            toast({ variant: 'destructive', title: 'Chyba při načítání', description: 'Nepodařilo se načíst rozvrh.' });
        } finally {
            setIsLoading(false);
        }
    }, [firestore, toast]);
    
    useEffect(() => {
        if (selectedClassId) {
            loadScheduleForWeek(selectedClassId, weekDays);
        } else {
            setWeekSchedule(buildInitialWeekSchedule(weekDays));
        }
    }, [selectedClassId, weekDays, loadScheduleForWeek]);

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
            teacherName: teacher.name.split(' ').pop() || teacher.name,
            className: aClass.nazev,
            ucebnaName: aUcebna?.nazev
        };

        setLessonBlocks(prev => [...prev, newBlock]);
        reset();
    };
    
    const handleSaveSchedule = async () => {
        if (!selectedClassId || !firestore) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Prosím, vyberte třídu.' });
            return;
        }
        try {
            const batch = writeBatch(firestore);
            
            weekSchedule.forEach(daySchedule => {
                const docId = `${selectedClassId}-${format(daySchedule.date, 'yyyy-MM-dd')}`;
                const scheduleRef = doc(firestore, 'rozvrhy', docId);

                const scheduleData: Omit<Rozvrh, 'id'> = {
                    tridaId: selectedClassId,
                    datum: format(daySchedule.date, 'yyyy-MM-dd'),
                    timeSlots: daySchedule.timeSlots,
                    hodiny: daySchedule.lessons,
                };
                
                batch.set(scheduleRef, scheduleData);
            });

            await batch.commit();
            toast({ title: 'Rozvrh uložen', description: `Rozvrh pro třídu byl úspěšně uložen.` });
        } catch (error) {
            console.error("Save schedule error: ", error);
            toast({ variant: 'destructive', title: 'Chyba při ukládání', description: 'Nepodařilo se uložit rozvrh.' });
        }
    };
    
    const handleCopyWeek = async () => {
        if (!sourceWeek || !selectedClassId || !firestore) {
            toast({ variant: "destructive", title: "Chyba", description: "Vyberte prosím zdrojový týden a třídu." });
            return;
        }
        
        setIsLoading(true);
        const sourceWeekStart = startOfWeek(sourceWeek, { weekStartsOn: 1 });
        const sourceWeekDays = eachDayOfInterval({ start: sourceWeekStart, end: addDays(sourceWeekStart, 4) });
        
        const docIds = sourceWeekDays.map(day => `${selectedClassId}-${format(day, 'yyyy-MM-dd')}`);
        const scheduleQuery = query(collection(firestore, 'rozvrhy'), where('__name__', 'in', docIds));
        const querySnapshot = await getDocs(scheduleQuery);

        const newWeekSchedule = buildInitialWeekSchedule(weekDays);

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data() as Rozvrh;
            const sourceDate = new Date(data.datum + 'T00:00:00');
            const dayOfWeek = sourceDate.getDay(); // 0=Sun, 1=Mon
            const targetDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // adjust for our Mon-Fri array
            
            if (targetDayIndex >= 0 && targetDayIndex < 5) {
                newWeekSchedule[targetDayIndex].lessons = data.hodiny;
                newWeekSchedule[targetDayIndex].timeSlots = data.timeSlots;
            }
        });
        
        setWeekSchedule(newWeekSchedule);
        setIsLoading(false);
        toast({ title: "Rozvrh zkopírován", description: "Nyní můžete provést úpravy a uložit." });
    };

    const handleDragStart = (e: React.DragEvent, block: LessonBlock) => {
        e.dataTransfer.setData("lessonBlock", JSON.stringify(block));
    };

    const handleDrop = (e: React.DragEvent, dayIndex: number, periodIndex: number) => {
        e.preventDefault();
        const lessonData = e.dataTransfer.getData("lessonBlock");
        if (lessonData) {
            const block = JSON.parse(lessonData) as LessonBlock;
            setWeekSchedule(prev => {
                const newWeek = [...prev];
                newWeek[dayIndex].lessons[periodIndex] = block;
                return newWeek;
            });
        }
    };
    
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const removeLessonFromSchedule = (dayIndex: number, periodIndex: number) => {
        setWeekSchedule(prev => {
            const newWeek = [...prev];
            newWeek[dayIndex].lessons[periodIndex] = null;
            return newWeek;
        });
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Rozvrhy a suplování</h1>
                    <p className="text-muted-foreground">Vytvářejte a upravujte týdenní rozvrhy pro třídy.</p>
                </div>
                 <div className="flex gap-2">
                     <Select onValueChange={setSelectedClassId} value={selectedClassId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Vyberte třídu" />
                        </SelectTrigger>
                        <SelectContent>
                            {tridy?.map(t => <SelectItem key={t.id} value={t.id}>{t.nazev}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Button onClick={handleSaveSchedule} disabled={!selectedClassId}>
                        <Save className="mr-2 h-4 w-4" />
                        Uložit rozvrh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Editor rozvrhu pro třídu: {tridy?.find(t => t.id === selectedClassId)?.nazev || 'Nevybrána'}</CardTitle>
                             <CardDescription className="flex flex-wrap justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                     <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))}><ArrowLeft /></Button>
                                     <h3 className="font-semibold">{format(weekStart, 'd.M.')} - {format(addDays(weekStart, 4), 'd. M. yyyy')}</h3>
                                     <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ArrowRight /></Button>
                                </div>
                                <div className='flex items-center gap-2'>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                        <Button variant={"outline"} className="w-[180px] justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {sourceWeek ? format(sourceWeek, 'd.M.yyyy') + "..." : <span>Vyberte týden</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={sourceWeek} onSelect={setSourceWeek} initialFocus locale={cs}/>
                                        </PopoverContent>
                                    </Popover>
                                    <Button onClick={handleCopyWeek} disabled={!sourceWeek || !selectedClassId}><Copy className="mr-2 h-4 w-4" /> Kopírovat týden</Button>
                                </div>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            {isLoading ? <p>Načítání rozvrhu...</p> : (
                             <div className="grid grid-cols-[auto_repeat(5,1fr)] border-t border-l rounded-tl-lg">
                                {/* Header - Dny */}
                                <div className="border-b border-r p-2 font-bold bg-muted/50 text-center flex items-center justify-center gap-2">
                                    Hodina
                                </div>
                                {weekDays.map(day => (
                                    <div key={day.toISOString()} className="border-b border-r p-2 font-bold bg-muted/50 text-center">
                                       <p>{format(day, 'EEEE', { locale: cs })}</p>
                                       <p className="text-sm font-normal text-muted-foreground">{format(day, 'd.M.')}</p>
                                    </div>
                                ))}

                                {/* Řádky */}
                                {initialTimeSlots.map((time, periodIndex) => (
                                    <React.Fragment key={periodIndex}>
                                        <div className="border-b border-r p-2 font-mono text-xs text-muted-foreground text-center bg-muted/50 flex flex-col justify-center">
                                            <span className='font-bold text-sm'>{periodIndex + 1}.</span>
                                            {time}
                                        </div>
                                        {weekDays.map((day, dayIndex) => {
                                            const lesson = weekSchedule[dayIndex]?.lessons[periodIndex];
                                            return (
                                            <div 
                                                key={day.toISOString()} 
                                                className="border-b border-r h-24"
                                                onDrop={(e) => handleDrop(e, dayIndex, periodIndex)}
                                                onDragOver={handleDragOver}
                                            >
                                                {lesson && (
                                                    <div 
                                                        className="h-full p-1 text-xs rounded-sm relative flex flex-col justify-center items-center"
                                                        style={{ backgroundColor: getSubjectColor(lesson.subjectId) }}
                                                    >
                                                        <button 
                                                            onClick={() => removeLessonFromSchedule(dayIndex, periodIndex)}
                                                            className="absolute top-0 right-0 p-0.5 bg-black/20 rounded-full text-white hover:bg-destructive"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                        <div className="font-bold">{lesson.subjectShortcut}</div>
                                                        <div>{lesson.className}</div>
                                                        <div className="text-muted-foreground">{lesson.teacherName}</div>
                                                        <div className="text-muted-foreground">{lesson.ucebnaName}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )})}
                                    </React.Fragment>
                                ))}
                            </div>
                            )}
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
        </div>
    );
}

    