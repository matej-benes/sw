'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, doc } from 'firebase/firestore';
import type { Grading, User, Trida, Predmet } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Pencil, Loader2, BarChart2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';


// --- Zod Schema for New Grading ---
const gradingSchema = z.object({
  ziakId: z.string().min(1, 'Musíte vybrat žáka.'),
  predmet: z.string().min(1, 'Musíte vybrat předmět.'),
  znamka: z.coerce.number().min(1, 'Známka musí být mezi 1-5').max(5, 'Známka musí být mezi 1-5'),
  vaha: z.coerce.number().min(1, 'Váha musí být kladné číslo.'),
  komentar: z.string().optional(),
});

type GradingFormData = z.infer<typeof gradingSchema>;


// --- Teacher Components ---

function NewGradingDialog({ open, onOpenChange, students, subjects, ucitelId }: { open: boolean; onOpenChange: (open: boolean) => void; students: User[]; subjects: Predmet[]; ucitelId: string; }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<GradingFormData>({
    resolver: zodResolver(gradingSchema),
    defaultValues: { vaha: 1 },
  });

  const onSubmit = async (data: GradingFormData) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const student = students.find(s => s.id === data.ziakId);
      if (!student) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraný žák nebyl nalezen.' });
        return;
      }
      
      const newGrading: Omit<Grading, 'id'> = {
        datum: Timestamp.now(),
        ziakId: data.ziakId,
        ziakJmeno: student.name,
        predmet: data.predmet,
        znamka: data.znamka,
        vaha: data.vaha,
        komentar: data.komentar || '',
        ucitelId,
      };
      
      await addDocumentNonBlocking(collection(firestore, 'gradings'), newGrading);
      toast({ title: 'Hodnocení uloženo', description: 'Nové hodnocení bylo úspěšně uloženo.' });
      reset({ vaha: 1, znamka: undefined, ziakId: '', predmet: '', komentar: '' });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se uložit hodnocení.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nové hodnocení</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label>Žák</label>
            <Controller name="ziakId" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Vyberte žáka" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.ziakId && <p className="text-sm text-destructive">{errors.ziakId.message}</p>}
          </div>
          <div className="space-y-1">
            <label>Předmět</label>
            <Controller name="predmet" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                <SelectContent>{subjects.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.predmet && <p className="text-sm text-destructive">{errors.predmet.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label>Známka (1-5)</label>
              <Controller name="znamka" control={control} render={({ field }) => <Input {...field} type="number" min="1" max="5" />} />
              {errors.znamka && <p className="text-sm text-destructive">{errors.znamka.message}</p>}
            </div>
            <div className="space-y-1">
              <label>Váha</label>
              <Controller name="vaha" control={control} render={({ field }) => <Input {...field} type="number" min="1" />} />
              {errors.vaha && <p className="text-sm text-destructive">{errors.vaha.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <label>Komentář</label>
            <Controller name="komentar" control={control} render={({ field }) => <Textarea {...field} />} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Zrušit</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Uložit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeacherView({ user, students, subjects, gradings, isLoading }: { user: User, students: User[], subjects: Predmet[], gradings: Grading[], isLoading: boolean }) {
  const [isNewGradingOpen, setIsNewGradingOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Přehled zadaného hodnocení</CardTitle>
            <CardDescription>Chronologický seznam všech známek, které jste zadali.</CardDescription>
          </div>
          <Button onClick={() => setIsNewGradingOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Zadat nové hodnocení
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Žák</TableHead>
                <TableHead>Předmět</TableHead>
                <TableHead className="text-center">Známka</TableHead>
                <TableHead className="text-center">Váha</TableHead>
                <TableHead>Komentář</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="h-24 text-center">Načítání hodnocení...</TableCell></TableRow>}
              {!isLoading && gradings.length > 0 ? (
                gradings.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>{format((grade.datum as Timestamp).toDate(), 'd. M. yyyy HH:mm')}</TableCell>
                    <TableCell className="font-medium">{grade.ziakJmeno}</TableCell>
                    <TableCell>{grade.predmet}</TableCell>
                    <TableCell className="text-center font-bold">{grade.znamka}</TableCell>
                    <TableCell className="text-center">{grade.vaha}</TableCell>
                    <TableCell className="text-muted-foreground">{grade.komentar || '-'}</TableCell>
                  </TableRow>
                ))
              ) : !isLoading && <TableRow><TableCell colSpan={6} className="h-24 text-center">Nezadali jste žádné hodnocení.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <NewGradingDialog open={isNewGradingOpen} onOpenChange={setIsNewGradingOpen} students={students} subjects={subjects} ucitelId={user.id} />
    </>
  );
}

// --- Student/Parent Components ---

type SubjectSummary = { name: string; grades: Grading[]; average: string; };

function calculateWeightedAverage(grades: Grading[]): string {
  if (grades.length === 0) return '–';
  const totalWeight = grades.reduce((acc, g) => acc + g.vaha, 0);
  if (totalWeight === 0) return '–';
  const weightedSum = grades.reduce((acc, g) => acc + (g.znamka * g.vaha), 0);
  return (weightedSum / totalWeight).toFixed(2);
}

function StudentParentView({ studentId, gradings, isLoading }: { studentId: string; gradings: Grading[], isLoading: boolean }) {

  const subjectSummaries = useMemo((): SubjectSummary[] => {
    if (!gradings) return [];
    const grouped = gradings.reduce((acc, grade) => {
      if (!acc[grade.predmet]) acc[grade.predmet] = [];
      acc[grade.predmet].push(grade);
      return acc;
    }, {} as { [subject: string]: Grading[] });

    return Object.entries(grouped).map(([name, grades]) => ({
      name,
      grades: grades.sort((a,b) => (b.datum as Timestamp).toMillis() - (a.datum as Timestamp).toMillis()),
      average: calculateWeightedAverage(grades),
    }));
  }, [gradings]);
  
  const chartData = useMemo(() => {
    if (!gradings || gradings.length === 0) return [];
    
    const monthlyAverages = gradings.reduce((acc, grade) => {
        const month = format((grade.datum as Timestamp).toDate(), 'yyyy-MM');
        if (!acc[month]) {
            acc[month] = { grades: [] };
        }
        acc[month].grades.push(grade);
        return acc;
    }, {} as { [key: string]: { grades: Grading[] } });

    return Object.entries(monthlyAverages)
        .map(([month, data]) => ({
            month: format(new Date(month), "MMM", { locale: cs }),
            prumer: parseFloat(calculateWeightedAverage(data.grades)),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
  }, [gradings]);
  
  const chartConfig = {
    prumer: {
      label: "Průměr",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;


  return (
    <Tabs defaultValue="prubezne" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="prubezne">Průběžné hodnocení</TabsTrigger>
        <TabsTrigger value="predmet">Hodnocení v předmětu</TabsTrigger>
      </TabsList>
      <TabsContent value="prubezne">
        <Card>
          <CardHeader>
            <CardTitle>Průběžné známky</CardTitle>
            <CardDescription>Chronologický přehled všech vašich známek.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Předmět</TableHead><TableHead className="text-center">Známka</TableHead><TableHead className="text-center">Váha</TableHead><TableHead>Datum</TableHead><TableHead>Komentář</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center">Načítání známek...</TableCell></TableRow>
                  : gradings.length > 0 ? gradings.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell className="font-medium">{grade.predmet}</TableCell>
                      <TableCell className="text-center font-bold text-lg">{grade.znamka}</TableCell>
                      <TableCell className="text-center">{grade.vaha}</TableCell>
                      <TableCell>{format((grade.datum as Timestamp).toDate(), 'd. M. yyyy')}</TableCell>
                      <TableCell className="text-muted-foreground">{grade.komentar || '-'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="h-24 text-center">Zatím nemáte žádné známky.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="predmet" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Průměry podle měsíců</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart accessibilityLayer data={chartData}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis domain={[1, 5]} reversed={true} tickFormatter={(value) => value.toFixed(1)} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="prumer" fill="var(--color-prumer)" radius={4} />
                </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        {subjectSummaries.map(subject => (
          <Card key={subject.name}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{subject.name}</CardTitle>
              <Badge>Průměr: {subject.average}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {subject.grades.map(g => (
                  <TooltipProvider key={g.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-base cursor-default">{g.znamka} <span className="text-xs ml-1 opacity-70">(x{g.vaha})</span></Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{format((g.datum as Timestamp).toDate(), 'd. M. yyyy')}</p>
                        {g.komentar && <p>{g.komentar}</p>}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}


// --- Main Page Component ---

export default function HodnoceniPage() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const firestore = useFirestore();

  // Data for teacher view
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Predmet>(useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]));
  const teacherGradingsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !hasRole('ucitel')) return null;
    return query(collection(firestore, 'gradings'), where('ucitelId', '==', user.id), orderBy('datum', 'desc'));
  }, [firestore, user, hasRole]);
  const { data: teacherGradings, isLoading: teacherGradingsLoading } = useCollection<Grading>(teacherGradingsQuery);

  // Data for student/parent view
  const studentId = useMemo(() => hasRole('ziak') ? user?.id : user?.studentId, [hasRole, user]);
  const studentGradingsQuery = useMemoFirebase(() => {
    if (!firestore || !studentId) return null;
    return query(collection(firestore, 'gradings'), where('ziakId', '==', studentId), orderBy('datum', 'desc'));
  }, [firestore, studentId]);
  const { data: studentGradings, isLoading: studentGradingsLoading } = useCollection<Grading>(studentGradingsQuery);
  
  const isLoading = authLoading || usersLoading || subjectsLoading || teacherGradingsLoading || studentGradingsLoading;
  
  if (isLoading) {
    return <div className="flex h-full items-center justify-center">Načítání...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Klasifikace</h1>
        <p className="text-muted-foreground">Přehled vašeho studijního prospěchu a správa hodnocení.</p>
      </div>

      {hasRole('ucitel') && user && (
        <TeacherView
          user={user}
          students={allUsers?.filter(u => u.roles.includes('ziak')) || []}
          subjects={allSubjects || []}
          gradings={teacherGradings || []}
          isLoading={teacherGradingsLoading || usersLoading || subjectsLoading}
        />
      )}

      {(hasRole('ziak') || hasRole('rodic')) && studentId && (
        <StudentParentView
          studentId={studentId}
          gradings={studentGradings || []}
          isLoading={studentGradingsLoading}
        />
      )}
    </div>
  );
}

    