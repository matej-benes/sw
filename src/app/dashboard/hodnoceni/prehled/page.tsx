'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collectionGroup, query, where, doc, getDoc, collection } from 'firebase/firestore';
import type { Znamka, User, Predmet } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
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
  hodnota: z.coerce.number().min(1).max(5),
  tema: z.string().optional(),
  slovniHodnoceni: z.string().optional(),
});
type GradeEditFormData = z.infer<typeof gradeEditSchema>;


function EditGradeDialog({ grade, isOpen, onClose, onSave }: { grade: Znamka | null; isOpen: boolean; onClose: () => void; onSave: (data: GradeEditFormData) => void }) {
  const { handleSubmit, control, reset } = useForm<GradeEditFormData>({
    resolver: zodResolver(gradeEditSchema),
    defaultValues: {
      hodnota: grade?.hodnota || 1,
      tema: grade?.tema || '',
      slovniHodnoceni: grade?.slovniHodnoceni || '',
    }
  });

  useEffect(() => {
    if (grade) {
      reset({
        hodnota: grade.hodnota,
        tema: grade.tema || '',
        slovniHodnoceni: grade.slovniHodnoceni || ''
      });
    }
  }, [grade, reset]);
  
  if (!isOpen || !grade) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upravit známku</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4 py-4">
           <div className="space-y-1">
             <Label htmlFor="hodnota">Známka</Label>
             <Controller name="hodnota" control={control} render={({ field }) => <Input {...field} type="number" min="1" max="5" />} />
           </div>
           <div className="space-y-1">
             <Label htmlFor="tema">Téma</Label>
             <Controller name="tema" control={control} render={({ field }) => <Input {...field} />} />
           </div>
           <div className="space-y-1">
             <Label htmlFor="slovniHodnoceni">Slovní hodnocení</Label>
             <Controller name="slovniHodnoceni" control={control} render={({ field }) => <Textarea {...field} />} />
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
  const { user, loading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [editingGrade, setEditingGrade] = useState<Znamka | null>(null);
  const [deletingGrade, setDeletingGrade] = useState<Znamka | null>(null);

  const teacherGradesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collectionGroup(firestore, 'znamky'), where('ucitelId', '==', user.id));
  }, [firestore, user]);

  const { data: grades, isLoading: gradesLoading } = useCollection<Znamka>(teacherGradesQuery);
  const { data: students, isLoading: studentsLoading } = useCollection<User>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));

  const getStudentName = useCallback((studentId: string) => {
    return students?.find(s => s.id === studentId)?.name || 'Neznámý žák';
  }, [students]);

  const handleSave = async (data: GradeEditFormData) => {
    if (!firestore || !editingGrade) return;

    const gradeRef = doc(firestore, `users/${editingGrade.studentId}/znamky`, editingGrade.id);
    await updateDocumentNonBlocking(gradeRef, data);
    toast({ title: "Známka aktualizována." });
    setEditingGrade(null);
  };

  const handleDelete = async () => {
    if (!firestore || !deletingGrade) return;
    const gradeRef = doc(firestore, `users/${deletingGrade.studentId}/znamky`, deletingGrade.id);
    await deleteDocumentNonBlocking(gradeRef);
    toast({ title: "Známka smazána." });
    setDeletingGrade(null);
  };
  
  const isLoading = loading || gradesLoading || studentsLoading;

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
                grades.map(grade => (
                  <TableRow key={grade.id}>
                    <TableCell className="font-medium">{getStudentName(grade.studentId)}</TableCell>
                    <TableCell>{grade.predmet}</TableCell>
                    <TableCell className="text-center font-bold">{grade.hodnota}</TableCell>
                    <TableCell>{format(grade.datum.toDate(), 'd. M. yyyy', { locale: cs })}</TableCell>
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
