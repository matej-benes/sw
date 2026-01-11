'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, Timestamp } from 'firebase/firestore';
import type { Grading, User, Predmet } from '@/lib/types';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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
} from '@/components/ui/alert-dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const gradingSchema = z.object({
  ziakId: z.string().min(1, 'Musíte vybrat žáka.'),
  predmet: z.string().min(1, 'Předmět je povinný.'),
  znamka: z.coerce.number().min(1).max(5),
  vaha: z.coerce.number().min(0.1),
  komentar: z.string().optional(),
});

type GradingFormData = z.infer<typeof gradingSchema>;

function GradingForm({
  grading,
  students,
  subjects,
  onSave,
  onClose,
}: {
  grading?: Grading | null;
  students: User[];
  subjects: Predmet[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<GradingFormData>({
    resolver: zodResolver(gradingSchema),
    defaultValues: {
      ziakId: grading?.ziakId || '',
      predmet: grading?.predmet || '',
      znamka: grading?.znamka || 1,
      vaha: grading?.vaha || 1.0,
      komentar: grading?.komentar || '',
    },
  });

  const onSubmit = (data: GradingFormData) => {
    onSave(data);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      <div className="space-y-1">
        <Label>Žák</Label>
        <Controller
          name="ziakId"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue placeholder="Vyberte žáka" /></SelectTrigger>
              <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        />
        {errors.ziakId && <p className="text-sm text-destructive">{errors.ziakId.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Předmět</Label>
         <Controller
          name="predmet"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        />
        {errors.predmet && <p className="text-sm text-destructive">{errors.predmet.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Známka</Label>
          <Controller
            name="znamka"
            control={control}
            render={({ field }) => (
              <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(g => <SelectItem key={g} value={String(g)}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label>Váha</Label>
          <Input type="number" step="0.1" {...register('vaha')} />
        </div>
      </div>
       {errors.znamka && <p className="text-sm text-destructive">{errors.znamka.message}</p>}
       {errors.vaha && <p className="text-sm text-destructive">{errors.vaha.message}</p>}

      <div className="space-y-1">
        <Label>Komentář</Label>
        <Textarea {...register('komentar')} />
      </div>

      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
        <Button type="submit">Uložit</Button>
      </DialogFooter>
    </form>
  );
}

function TeacherView() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGrading, setEditingGrading] = useState<Grading | null>(null);
  const [deletingGrading, setDeletingGrading] = useState<Grading | null>(null);

  const teacherGradingsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'gradings'), where('ucitelId', '==', user.id), orderBy('datum', 'desc'));
  }, [firestore, user]);
  const { data: teacherGradings, isLoading: gradingsLoading } = useCollection<Grading>(teacherGradingsQuery);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('roles', 'array-contains', 'ziak'));
  }, [firestore]);
  const { data: students, isLoading: studentsLoading } = useCollection<User>(studentsQuery);
  
  const subjectsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'predmety');
  }, [firestore]);
  const { data: subjects, isLoading: subjectsLoading } = useCollection<Predmet>(subjectsQuery);

  const handleSave = async (formData: GradingFormData) => {
    if (!user || !firestore || !students) return;

    const student = students.find(s => s.id === formData.ziakId);
    if (!student) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraný student nebyl nalezen.'});
        return;
    }

    const dataToSave = {
        ...formData,
        ziakJmeno: student.name,
        ucitelId: user.id,
    };
    
    if (editingGrading) {
        await updateDocumentNonBlocking(doc(firestore, 'gradings', editingGrading.id), dataToSave);
        toast({ title: 'Hodnocení upraveno'});
    } else {
        await addDocumentNonBlocking(collection(firestore, 'gradings'), {
            ...dataToSave,
            datum: Timestamp.now(),
        });
        toast({ title: 'Hodnocení uloženo'});
    }
    
    setIsDialogOpen(false);
    setEditingGrading(null);
  };
  
  const handleDelete = async () => {
    if (!deletingGrading || !firestore) return;
    await deleteDocumentNonBlocking(doc(firestore, 'gradings', deletingGrading.id));
    toast({ title: 'Hodnocení smazáno' });
    setDeletingGrading(null);
  }

  const openDialog = (grading: Grading | null = null) => {
      setEditingGrading(grading);
      setIsDialogOpen(true);
  }

  const isLoading = gradingsLoading || studentsLoading || subjectsLoading;

  return (
     <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
            <div>
                <CardTitle>Klasifikace</CardTitle>
                <CardDescription>Zadávání a přehled hodnocení</CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nové hodnocení
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
                        <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={7} className="text-center">Načítání...</TableCell></TableRow>}
                    {!isLoading && teacherGradings?.map(g => (
                        <TableRow key={g.id}>
                            <TableCell>{format(g.datum.toDate(), 'd. M. yyyy HH:mm')}</TableCell>
                            <TableCell>{g.ziakJmeno}</TableCell>
                            <TableCell>{g.predmet}</TableCell>
                            <TableCell className="text-center font-bold">{g.znamka}</TableCell>
                            <TableCell className="text-center">{g.vaha.toFixed(1)}</TableCell>
                            <TableCell className="max-w-xs truncate">{g.komentar}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => openDialog(g)}><Pencil className="mr-2 h-4 w-4" />Upravit</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setDeletingGrading(g)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Smazat</DropdownMenuItem>
                                </DropdownMenuContent>
                               </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingGrading ? 'Upravit' : 'Nové'} hodnocení</DialogTitle>
            </DialogHeader>
            <GradingForm 
                grading={editingGrading}
                students={students || []}
                subjects={subjects || []}
                onSave={handleSave}
                onClose={() => setIsDialogOpen(false)}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deletingGrading} onOpenChange={() => setDeletingGrading(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Opravdu smazat hodnocení?</AlertDialogTitle>
                <AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Smazat</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
     </>
  );
}

function StudentParentView() {
  const { user, hasRole } = useAuth();
  const firestore = useFirestore();

  const studentId = useMemo(() => hasRole('ziak') ? user?.id : user?.studentId, [hasRole, user]);

  const studentGradingsQuery = useMemoFirebase(() => {
    if (!firestore || !studentId) return null;
    return query(collection(firestore, 'gradings'), where('ziakId', '==', studentId), orderBy('datum', 'desc'));
  }, [firestore, studentId]);

  const { data: studentGradings, isLoading: studentGradingsLoading } = useCollection<Grading>(studentGradingsQuery);
  
  const subjects = useMemo(() => {
    if (!studentGradings) return {};
    return studentGradings.reduce((acc, g) => {
        if(!acc[g.predmet]) acc[g.predmet] = [];
        acc[g.predmet].push(g);
        return acc;
    }, {} as {[key: string]: Grading[]});
  }, [studentGradings]);

  const calculateWeightedAverage = (grades: Grading[]) => {
      if(grades.length === 0) return 'N/A';
      const totalWeight = grades.reduce((sum, g) => sum + g.vaha, 0);
      const weightedSum = grades.reduce((sum, g) => sum + (g.znamka * g.vaha), 0);
      if (totalWeight === 0) return 'N/A';
      return (weightedSum / totalWeight).toFixed(2);
  }

  if (studentGradingsLoading) {
    return <div>Načítání dat...</div>;
  }
  
  return (
    <div className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>Průběžné hodnocení</CardTitle>
                <CardDescription>Chronologický přehled všech vašich známek.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Předmět</TableHead>
                        <TableHead className="text-center">Známka</TableHead>
                        <TableHead className="text-center">Váha</TableHead>
                        <TableHead>Komentář</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {studentGradings?.map(grading => (
                        <TableRow key={grading.id}>
                            <TableCell>{format(grading.datum.toDate(), 'd. M. yyyy')}</TableCell>
                            <TableCell>{grading.predmet}</TableCell>
                            <TableCell className="text-center font-bold">{grading.znamka}</TableCell>
                            <TableCell className="text-center">{grading.vaha.toFixed(1)}</TableCell>
                            <TableCell>{grading.komentar}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                 <CardTitle>Hodnocení podle předmětu</CardTitle>
                 <CardDescription>Souhrn známek a průměrů pro jednotlivé předměty.</CardDescription>
            </CardHeader>
             <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(subjects).map(([subjectName, grades]) => (
                    <Card key={subjectName}>
                        <CardHeader>
                             <CardTitle className="text-lg">{subjectName}</CardTitle>
                             <CardDescription>Vážený průměr: <span className="font-bold text-foreground">{calculateWeightedAverage(grades)}</span></CardDescription>
                        </CardHeader>
                        <CardContent>
                           <div className="flex flex-wrap gap-2">
                             {grades.map(g => (
                                <div key={g.id} className="group relative">
                                    <span className="font-bold text-lg">{g.znamka}</span>
                                    <span className="absolute -bottom-1 -right-1.5 text-xs text-muted-foreground bg-background/50 px-0.5 rounded-sm">{g.vaha.toFixed(1)}</span>
                                </div>
                            ))}
                           </div>
                        </CardContent>
                    </Card>
                ))}
            </CardContent>
        </Card>
    </div>
  );
}


export default function HodnoceniPage() {
  const { hasRole, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div>Načítání...</div>;
  }

  if (hasRole('ucitel')) {
    return <TeacherView />;
  }

  if (hasRole('ziak') || hasRole('rodic')) {
     return <StudentParentView />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Přístup odepřen</CardTitle>
        <CardDescription>Pro zobrazení hodnocení je nutné mít roli učitele, žáka nebo rodiče.</CardDescription>
      </CardHeader>
    </Card>
  );
}
