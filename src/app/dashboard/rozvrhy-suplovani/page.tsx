'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, Save, Download, Edit, Plus, Minus } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, getDoc, setDoc, query, where } from 'firebase/firestore';
import type { Trida, User, Predmet, LessonBlock, ScheduleGrid } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const lessonSchema = z.object({
    subjectId: z.string().min(1, "Předmět je povinný"),
    teacherId: z.string().min(1, "Učitel je povinný"),
    classId: z.string().min(1, "Třída je povinná"),
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


export default function RozvrhySuplovaniPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    // Data fetching
    const predmetyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]);
    const { data: predmety } = useCollection<Predmet>(predmetyCollection);

    const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
    const { data: tridy } = useCollection<Trida>(tridyCollection);

    const uciteleQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]);
    const { data: ucitele } = useCollection<User>(uciteleQuery);

    // State
    const [timeSlots, setTimeSlots] = useState(initialTimeSlots);
    const [isEditingTimes, setIsEditingTimes] = useState(false);
    const [lessonBlocks, setLessonBlocks] = useState<LessonBlock[]>([]);
    const [schedule, setSchedule] = useState<ScheduleGrid>(initialSchedule);
    const [selectedClassForSchedule, setSelectedClassForSchedule] = useState<string>('');

    const { control, handleSubmit, reset, watch } = useForm<LessonFormData>({
        resolver: zodResolver(lessonSchema),
        defaultValues: { subjectId: '', teacherId: '', classId: '' }
    });
    
    const subjectId = watch('subjectId');
    const teacherId = watch('teacherId');
    const classId = watch('classId');

    const handleCreateLessonBlock = (data: LessonFormData) => {
        const subject = predmety?.find(p => p.id === data.subjectId);
        const teacher = ucitele?.find(u => u.id === data.teacherId);
        const aClass = tridy?.find(t => t.id === data.classId);

        if (!subject || !teacher || !aClass) {
            toast({ variant: 'destructive', title: "Chyba", description: "Nepodařilo se najít vybrané položky." });
            return;
        }

        const newBlock: LessonBlock = {
            id: `${Date.now()}`,
            subjectId: subject.id,
            teacherId: teacher.id,
            classId: aClass.id,
            subjectName: subject.name,
            subjectShortcut: subject.shortcut,
            teacherName: teacher.name.split(' ').pop() || teacher.name, // Last name
            className: aClass.nazev
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
            setSchedule(prev => ({
                ...prev,
                [day]: {
                    ...prev[day],
                    [period]: block
                }
            }));
        }
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeLessonFromSchedule = (day: string, period: number) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [period]: null }
        }));
    };
    
    const handleSaveSchedule = async () => {
        if (!selectedClassForSchedule || !firestore) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Prosím, vyberte třídu pro uložení rozvrhu.' });
            return;
        }
        try {
            const scheduleRef = doc(firestore, 'rozvrhy', selectedClassForSchedule);
            // Save schedule with current timeSlots
            await setDoc(scheduleRef, { scheduleData: schedule, timeSlots });
            toast({ title: 'Rozvrh uložen', description: `Rozvrh pro třídu byl úspěšně uložen.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Chyba při ukládání', description: 'Nepodařilo se uložit rozvrh.' });
        }
    };

    const handleLoadSchedule = async (classId: string) => {
        setSelectedClassForSchedule(classId);
        if (!classId || !firestore) {
            setTimeSlots(initialTimeSlots);
            setSchedule(buildInitialSchedule(initialTimeSlots));
            return;
        };
        try {
            const scheduleRef = doc(firestore, 'rozvrhy', classId);
            const docSnap = await getDoc(scheduleRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const loadedSchedule = data.scheduleData;
                const loadedTimeSlots = data.timeSlots || initialTimeSlots;
                
                setTimeSlots(loadedTimeSlots);
                const fullSchedule = buildInitialSchedule(loadedTimeSlots);

                daysOfWeek.forEach(day => {
                    if (loadedSchedule[day]) {
                        for (const period in loadedSchedule[day]) {
                            if (fullSchedule[day].hasOwnProperty(period)) {
                                fullSchedule[day][parseInt(period)] = loadedSchedule[day][period];
                            }
                        }
                    }
                });

                setSchedule(fullSchedule);
                toast({ title: 'Rozvrh načten', description: `Rozvrh pro vybranou třídu byl načten.` });
            } else {
                setTimeSlots(initialTimeSlots);
                setSchedule(buildInitialSchedule(initialTimeSlots));
                toast({ title: 'Nový rozvrh', description: 'Pro tuto třídu zatím neexistuje žádný rozvrh.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Chyba při načítání', description: 'Nepodařilo se načíst rozvrh.' });
        }
    };
    
    const getSubjectColor = (subjectId: string) => {
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
    };

    const addTimeSlot = () => {
        const newTime = "16:00-16:45"; // Default new time
        const newTimeSlots = [...timeSlots, newTime];
        setTimeSlots(newTimeSlots);

        // Add a new empty period to the schedule for each day
        const newSchedule = { ...schedule };
        const newPeriodIndex = newTimeSlots.length - 1;
        daysOfWeek.forEach(day => {
            if (!newSchedule[day]) newSchedule[day] = {};
            newSchedule[day][newPeriodIndex] = null;
        });
        setSchedule(newSchedule);
    };

    const removeTimeSlot = () => {
        if (timeSlots.length > 1) {
            const newTimeSlots = timeSlots.slice(0, -1);
            setTimeSlots(newTimeSlots);

             // Remove the last period from the schedule for each day
            const newSchedule = { ...schedule };
            const lastPeriodIndex = timeSlots.length - 1;
            daysOfWeek.forEach(day => {
                if (newSchedule[day]) {
                    delete newSchedule[day][lastPeriodIndex];
                }
            });
            setSchedule(newSchedule);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Rozvrhy a suplování</h1>
                    <p className="text-muted-foreground">Vytvářejte a upravujte týdenní rozvrhy pro třídy.</p>
                </div>
                <div className="flex gap-2">
                     <Select onValueChange={handleLoadSchedule} value={selectedClassForSchedule}>
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Editor rozvrhu pro třídu: {tridy?.find(t => t.id === selectedClassForSchedule)?.nazev || 'Nevybrána'}</CardTitle>
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
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
