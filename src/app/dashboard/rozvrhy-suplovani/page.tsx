'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Trida, Rozvrh, LessonBlock } from '@/lib/types';
import { collection } from 'firebase/firestore';
import React, { useState, useMemo, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { setDoc, doc } from 'firebase/firestore';


const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
const timeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
    "15:05-15:50", "15:55-16:40"
];

type ScheduleEditorState = (LessonBlock | null)[][];


function ScheduleEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
    const { data: classes, isLoading: classesLoading } = useCollection<Trida>(tridyCollection);

    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [schedule, setSchedule] = useState<ScheduleEditorState>([]);

    useEffect(() => {
        if (classes && classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);

    // This would fetch the schedule for the selected class
    useEffect(() => {
        if (selectedClassId) {
            // For now, we initialize an empty schedule
            const emptySchedule: ScheduleEditorState = Array(daysOfWeek.length).fill(null).map(() => Array(timeSlots.length).fill(null));
            setSchedule(emptySchedule);
        }
    }, [selectedClassId]);

    const handleSave = async () => {
        if (!selectedClassId || !firestore) {
            toast({ variant: "destructive", title: "Chyba", description: "Není vybrána žádná třída." });
            return;
        }

        // This is a simplified save. In a real scenario, you'd have one document per day/week.
        // For this example, let's create one document for the entire week's template.
        try {
            // In a real app, we would probably save one document per day of the week
            // For simplicity, we can create a single document representing the "template"
            // Let's assume we are saving the schedule for a specific date range, e.g., a week
            // But for a generic editor, let's just save one doc per day of the week
            for (let i = 0; i < daysOfWeek.length; i++) {
                const day = daysOfWeek[i];
                // Using a composite ID, but a real app might use a more robust system
                // For a template, we might just use the classId and day name.
                // Let's create a placeholder for a specific date for now.
                const rozvrhId = `${selectedClassId}-2024-09-0${i + 2}`; // Example: 7A-2024-09-02
                const rozvrhRef = doc(firestore, 'rozvrhy', rozvrhId);
                const daySchedule: Omit<Rozvrh, 'id'> = {
                    tridaId: selectedClassId,
                    datum: `2024-09-0${i + 2}`, // Example date
                    timeSlots: timeSlots,
                    hodiny: schedule[i] || [],
                }
                await setDoc(rozvrhRef, daySchedule);
            }

            toast({ title: "Rozvrh uložen", description: "Změny v rozvrhu byly úspěšně uloženy." });
        } catch (error) {
            console.error("Error saving schedule:", error);
            toast({ variant: "destructive", title: "Chyba ukládání", description: "Při ukládání rozvrhu došlo k chybě." });
        }
    };
    
    const handleCellClick = (dayIndex: number, periodIndex: number) => {
        // Here you would open a dialog to edit the lesson
        console.log(`Editing: Day ${dayIndex}, Period ${periodIndex}`);
    }


    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Editor rozvrhu</CardTitle>
                    <CardDescription>Vytvářejte a upravujte rozvrhy pro jednotlivé třídy.</CardDescription>
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
                    <Button onClick={handleSave} disabled={!selectedClassId}>
                        <Save className="mr-2 h-4 w-4" /> Uložit rozvrh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
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
                        <TabsTrigger value="rozvrhy">Správa rozvrhů</TabsTrigger>
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
                <TabsContent value="suplovani">
                    <Card>
                        <CardHeader>
                            <CardTitle>Plánování suplování</CardTitle>
                            <CardDescription>Zde můžete zadávat a spravovat suplování za chybějící učitele.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Obsah pro plánování suplování...</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="nahled">
                    <Card>
                        <CardHeader>
                            <CardTitle>Náhled</CardTitle>
                            <CardDescription>Zobrazení aktuálního stavu rozvrhů a suplování.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Obsah pro náhled...</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
