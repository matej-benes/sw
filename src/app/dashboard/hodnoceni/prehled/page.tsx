'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, collectionGroup, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import type { Znamka, User, Trida, Grading } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { format, toDate } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const gradeEditSchema = z.object({
  hodnota: z.string().min(1, 'Známka je povinná'),
  tema: z.string().optional(),
  slovniHodnoceni: z.string().optional(),
});
type GradeEditFormData = z.infer<typeof gradeEditSchema>;

type EditableGrade = {
    gradingId: string;
    studentId: string;
    studentName: string;
    predmet: string;
    hodnota: string;
    datum: any; // Timestamp
    tema?: string;
    slovniHodnoceni?: string;
}


function EditGradeDialog({ grade, isOpen, onClose, onSave }: { grade: EditableGrade | null; isOpen: boolean; onClose: () => void; onSave: (data: GradeEditFormData) => void }) {
  const { handleSubmit, control, reset } = useForm<GradeEditFormData>();

   useEffect(() => {
    if (grade && isOpen) {
      reset({
        hodnota: grade.hodnota,
        tema: grade.tema || '',
        slovniHodnoceni: grade.slovniHodnoceni || ''
      });
    }
  }, [grade, isOpen, reset]);
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upravit známku pro {grade?.studentName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4 py-4">
           <div className="space-y-1">
             <Label htmlFor="hodnota">Známka</Label>
             <Controller name="hodnota" control={control} defaultValue={grade?.hodnota || ''} render={({ field }) => <Input {...field} type="text" />} />
           </div>
           <div className="space-y-1">
             <Label htmlFor="tema">Téma</Label>
             <Controller name="tema" control={control} defaultValue={grade?.tema || ''} render={({ field }) => <Input {...field} />} />
           </div>
           <div className="space-y-1">
             <Label htmlFor="slovniHodnoceni">Slovní hodnocení</Label>
             <Controller name="slovniHodnoceni" control={control} defaultValue={grade?.slovniHodnoceni || ''} render={({ field }) => <Textarea {...field} />} />
           </div>
           <DialogFooter>
             <DialogClose asChild><Button variant="outline">Zrušit</Button></DialogClose>
             <Button type="submit">Uložit změny</Button>
           </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


export default function HodnoceniPrehledPage() {
  const { user, loading: userLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [grades, setGrades] = useState<EditableGrade[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);

  const [editingGrade, setEditingGrade] = useState<EditableGrade | null>(null);
  const [deletingGrade, setDeletingGrade] = useState<EditableGrade | null>(null);
  
  const teacherGradingsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'gradings'), where('ucitelId', '==', user.id));
  }, [firestore, user]);

  const { data: gradings, isLoading: gradingsLoading } = useCollection<Grading>(teacherGradingsQuery);

  const allStudentIds = useMemo(() => {
      if (!gradings) return [];
      const ids = new Set<string>();
      gradings.forEach(g => {
          g.znamky.forEach(z => ids.add(z.studentId));
      });
      return Array.from(ids);
  }, [gradings]);

  const { data: studentUsers, isLoading: usersLoading } = useCollection<User>(useMemoFirebase(() => {
      if (!firestore || allStudentIds.length === 0) return null;
      // Note: 'in' query has a limit of 30. For more students, batching is needed.
      return query(collection(firestore, 'users'), where('__name__', 'in', allStudentIds));
  }, [firestore, allStudentIds]));


  useEffect(() => {
    if (gradings && studentUsers) {
        const studentMap = new Map(studentUsers.map(u => [u.id, u.name]));
        const flatGrades: EditableGrade[] = [];
        gradings.forEach(grading => {
            grading.znamky.forEach(znamka => {
                flatGrades.push({
                    gradingId: grading.id,
                    studentId: znamka.studentId,
                    studentName: studentMap.get(znamka.studentId) || 'Neznámý žák',
                    predmet: grading.predmetNazev,
                    hodnota: znamka.znamka,
                    datum: grading.datum,
                    tema: grading.tema,
                    slovniHodnoceni: znamka.slovniHodnoceni
                });
            });
        });
        setGrades(flatGrades.sort((a,b) => b.datum.toMillis() - a.datum.toMillis()));
    }
  }, [gradings, studentUsers]);


  const handleSave = async (data: GradeEditFormData) => {
    if (!firestore || !editingGrade) return;

    const gradingRef = doc(firestore, `gradings`, editingGrade.gradingId);
    
    try {
        const gradingDoc = await getDoc(gradingRef);
        if (!gradingDoc.exists()) {
            toast({ variant: 'destructive', title: "Chyba", description: "Původní záznam o hodnocení nebyl nalezen." });
            return;
        }

        const currentGradingData = gradingDoc.data() as Grading;
        const newZnamky = currentGradingData.znamky.map(z => {
            if (z.studentId === editingGrade.studentId) {
                return {
                    ...z,
                    znamka: data.hodnota,
                    slovniHodnoceni: data.slovniHodnoceni,
                };
            }
            return z;
        });

        await updateDocumentNonBlocking(gradingRef, { znamky: newZnamky, tema: data.tema });
        toast({ title: "Známka aktualizována." });
        setEditingGrade(null);
        // Data will re-fetch automatically due to useCollection hook
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Chyba", description: "Nepodařilo se uložit změny." });
    }
  };

  const handleDelete = async () => {
    if (!firestore || !deletingGrade) return;

    const gradingRef = doc(firestore, 'gradings', deletingGrade.gradingId);
     try {
        const gradingDoc = await getDoc(gradingRef);
        if (!gradingDoc.exists()) {
            toast({ variant: 'destructive', title: "Chyba", description: "Původní záznam o hodnocení nebyl nalezen." });
            return;
        }
        const currentGradingData = gradingDoc.data() as Grading;

        if (currentGradingData.znamky.length === 1) {
            // If it's the last grade, delete the whole document
            await deleteDocumentNonBlocking(gradingRef);
        } else {
            // Otherwise, just remove the grade from the array
            const newZnamky = currentGradingData.znamky.filter(z => z.studentId !== deletingGrade.studentId);
            await updateDocumentNonBlocking(gradingRef, { znamky: newZnamky });
        }
        toast({ title: "Známka smazána." });
        setDeletingGrade(null);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Chyba", description: "Nepodařilo se smazat známku." });
    }
  };
  
  const isLoading = userLoading || gradingsLoading || usersLoading;

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Přehled zadaného hodnocení</h1>
        <p className="text-muted-foreground">Správa všech známek, které jste zadali.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Žák</TableHead>
                <TableHead>Předmět</TableHead>
                <TableHead className="text-center">Známka</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Téma</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="h-24 text-center">Načítání hodnocení...</TableCell></TableRow>}
              {!isLoading && grades && grades.length > 0 ? (
                grades.map((grade, index) => (
                  <TableRow key={`${grade.gradingId}-${grade.studentId}-${index}`}>
                    <TableCell className="font-medium">{grade.studentName}</TableCell>
                    <TableCell>{grade.predmet}</TableCell>
                    <TableCell className="text-center font-bold">{grade.hodnota}</TableCell>
                    <TableCell>{grade.datum.toDate ? format(grade.datum.toDate(), 'd. M. yyyy', { locale: cs }) : 'N/A'}</TableCell>
                    <TableCell>{grade.tema || '-'}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditingGrade(grade)}>
                              <Pencil className="mr-2 h-4 w-4" /> Upravit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDeletingGrade(grade)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Smazat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && <TableRow><TableCell colSpan={6} className="h-24 text-center">Nezadali jste žádné hodnocení.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <EditGradeDialog 
      grade={editingGrade}
      isOpen={!!editingGrade}
      onClose={() => setEditingGrade(null)}
      onSave={handleSave}
    />

    <AlertDialog open={!!deletingGrade} onOpenChange={() => setDeletingGrade(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Opravdu smazat známku?</AlertDialogTitle>
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

    