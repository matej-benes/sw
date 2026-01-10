'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, collectionGroup, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import type { Znamka, User, Trida } from '@/lib/types';
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
          <DialogTitle>Upravit známku</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4 py-4">
           <div className="space-y-1">
             <Label htmlFor="hodnota">Známka</Label>
             <Controller name="hodnota" control={control} defaultValue={grade?.hodnota || 1} render={({ field }) => <Input {...field} type="number" min="1" max="5" />} />
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

function StudentName({ studentId, users }: { studentId: string, users: Map<string, User> }) {
    const studentName = users.get(studentId)?.name || 'Neznámý žák';
    return <span>{studentName}</span>;
}


export default function HodnoceniPrehledPage() {
  const { user, loading: userLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [grades, setGrades] = useState<Znamka[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);

  const [editingGrade, setEditingGrade] = useState<Znamka | null>(null);
  const [deletingGrade, setDeletingGrade] = useState<Znamka | null>(null);
  
  const fetchTeacherData = useCallback(async () => {
    if (!firestore || !user?.id) return;

    setDataLoading(true);
    
    try {
      // 1. Fetch all grades created by this teacher
      const gradesQuery = query(
          collectionGroup(firestore, 'znamky'),
          where('ucitelId', '==', user.id)
      );
      const gradesSnap = await getDocs(gradesQuery);
      const allTeacherGrades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Znamka));

      setGrades(allTeacherGrades);
      
      // 2. Fetch the user data for the relevant students
      const studentIds = [...new Set(allTeacherGrades.map(g => g.studentId))];
      if (studentIds.length > 0) {
          const usersMap = new Map<string, User>();
          // Fetch users in chunks of 30 due to 'in' query limit
          const chunks = [];
          for (let i = 0; i < studentIds.length; i += 30) {
              chunks.push(studentIds.slice(i, i + 30));
          }
          
          for (const chunk of chunks) {
              const usersQuery = query(collection(firestore, 'users'), where('__name__', 'in', chunk));
              const usersSnap = await getDocs(usersQuery);
              usersSnap.forEach(doc => {
                  usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
              });
          }
          setUsers(usersMap);
      } else {
        setUsers(new Map());
      }
      
    } catch(error) {
      console.error("Error fetching teacher grades:", error);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se načíst data o známkách.'});
    } finally {
      setDataLoading(false);
    }
    
  }, [firestore, user?.id, toast]);

  useEffect(() => {
    if(!userLoading) {
      fetchTeacherData();
    }
  }, [userLoading, fetchTeacherData]);


  const handleSave = async (data: GradeEditFormData) => {
    if (!firestore || !editingGrade) return;

    const gradeRef = doc(firestore, `users/${editingGrade.studentId}/znamky`, editingGrade.id);
    await updateDocumentNonBlocking(gradeRef, data);
    toast({ title: "Známka aktualizována." });
    setEditingGrade(null);
    fetchTeacherData(); // Re-fetch data
  };

  const handleDelete = async () => {
    if (!firestore || !deletingGrade) return;
    const gradeRef = doc(firestore, `users/${deletingGrade.studentId}/znamky`, deletingGrade.id);
    await deleteDocumentNonBlocking(gradeRef);
    toast({ title: "Známka smazána." });
    setDeletingGrade(null);
    fetchTeacherData(); // Re-fetch data
  };
  
  const isLoading = userLoading || dataLoading;

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
                    <TableCell className="font-medium"><StudentName studentId={grade.studentId} users={users} /></TableCell>
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
