'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { writeBatch, Timestamp, doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { User, Grading, LessonBlock, Predmet } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';


const gradingSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'Je třeba vybrat alespoň jednoho žáka.'),
  znamka: z.coerce.number().min(1, 'Známka musí být od 1 do 5.').max(5, 'Známka musí být od 1 do 5.'),
  vaha: z.coerce.number().min(0.1, 'Váha musí být kladná.').max(10),
  komentar: z.string().optional(),
});
type GradingFormData = z.infer<typeof gradingSchema>;

export function GradingDialog({
    isOpen,
    onOpenChange,
    lesson,
    students,
    subjects,
    day,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    lesson: LessonBlock;
    students: User[];
    subjects: Predmet[];
    day: Date;
}) {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<GradingFormData>({
        resolver: zodResolver(gradingSchema),
        defaultValues: { studentIds: [], vaha: 1.0, znamka: 1 }
    });

    useEffect(() => {
      if (!isOpen) {
        reset();
      }
    }, [isOpen, reset]);

    const onSubmit = async (data: GradingFormData) => {
        if (!firestore || !user || !user.organizationId || !lesson) return;

        const batch = writeBatch(firestore);
        const now = Timestamp.now();
        const selectedPredmet = subjects.find(p => p.id === lesson.subjectId);

        if (!selectedPredmet) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Předmět pro tuto hodinu nebyl nalezen.' });
            return;
        }
        
        for (const studentId of data.studentIds) {
            const studentData = students.find(s => s.id === studentId);
            if (!studentData) continue;

            const gradeData: Omit<Grading, 'id'> & { createdAt: Timestamp } = {
                organizationId: user.organizationId,
                tridaId: lesson.classId,
                ziakId: studentId,
                ziakJmeno: studentData.name,
                predmetId: lesson.subjectId,
                predmet: selectedPredmet.name,
                znamka: data.znamka,
                vaha: data.vaha,
                komentar: data.komentar || '',
                ucitelId: user.id,
                datum: format(day, 'yyyy-MM-dd'),
                cas: format(now.toDate(), 'HH:mm'),
                createdAt: now,
            };

            const gradeRef = doc(collection(firestore, 'grades'));
            batch.set(gradeRef, gradeData);
        }

        try {
            await batch.commit();
            toast({
                title: 'Hodnocení uloženo',
                description: `Bylo uloženo ${data.studentIds.length} známek.`,
            });
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Chyba ukládání',
                description: 'Při ukládání hodnocení došlo k chybě.',
            });
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nové hodnocení</DialogTitle>
                    <DialogDescription>
                        Známka pro předmět {lesson.subjectName}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Žáci</Label>
                        <Controller
                            name="studentIds"
                            control={control}
                            render={({ field }) => (
                                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                                    {students.length === 0 ? <p>Nenalezeni žádní žáci pro tuto třídu.</p> : students.map(s => (
                                        <div key={s.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`student-${s.id}`}
                                                checked={field.value.includes(s.id)}
                                                onCheckedChange={(checked) => {
                                                    const newValue = checked ? [...field.value, s.id] : field.value.filter(id => id !== s.id);
                                                    field.onChange(newValue);
                                                }}
                                            />
                                            <Label htmlFor={`student-${s.id}`}>{s.name}</Label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        />
                        {errors.studentIds && <p className="text-sm text-destructive">{errors.studentIds.message}</p>}
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Známka</Label>
                            <Controller name="znamka" control={control} render={({ field }) => (
                                <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(z=><SelectItem key={z} value={String(z)}>{z}</SelectItem>)}</SelectContent></Select>
                            )} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Váha</Label>
                            <Input type="number" step="0.1" {...register('vaha')} />
                        </div>
                    </div>
                     <div className="grid gap-2">
                        <Label>Komentář</Label>
                        <Textarea {...register('komentar')} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Zrušit</Button>
                        <Button type="submit">Uložit</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
