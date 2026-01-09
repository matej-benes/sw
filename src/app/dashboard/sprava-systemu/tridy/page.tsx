'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';

type Class = {
  id: string;
  name: string;
  studentCount: number;
  teacher: string;
};

const classSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  teacher: z.string().min(1, 'Jméno učitele je povinné'),
  studentCount: z.coerce.number().min(0, 'Počet musí být nezáporný'),
});

type ClassFormData = z.infer<typeof classSchema>;

function ClassForm({
  classData,
  onSave,
  closeDialog,
}: {
  classData?: Class | null;
  onSave: (data: ClassFormData) => void;
  closeDialog: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: classData?.name || '',
      teacher: classData?.teacher || '',
      studentCount: classData?.studentCount || 0,
    },
  });

  const onSubmit = (data: ClassFormData) => {
    onSave(data);
    closeDialog();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      <div className="space-y-1">
        <Label htmlFor="name">Název třídy</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="teacher">Třídní učitel</Label>
        <Input id="teacher" {...register('teacher')} />
        {errors.teacher && (
          <p className="text-sm text-destructive">{errors.teacher.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="studentCount">Počet žáků</Label>
        <Input
          id="studentCount"
          type="number"
          {...register('studentCount')}
        />
        {errors.studentCount && (
          <p className="text-sm text-destructive">
            {errors.studentCount.message}
          </p>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Zrušit
          </Button>
        </DialogClose>
        <Button type="submit">Uložit</Button>
      </DialogFooter>
    </form>
  );
}

export default function SpravaTridyPage() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const firestore = useFirestore();
  
  const classesCollection = useMemoFirebase(
    () => (firestore && !authLoading && hasRole('administrator') ? collection(firestore, 'tridy') : null),
    [firestore, authLoading, hasRole]
  );
  const { data: classes, isLoading: classesLoading } = useCollection<Class>(classesCollection);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);
  const { toast } = useToast();
  
  const isLoading = authLoading || (hasRole('administrator') && classesLoading);

  const handleSaveClass = async (formData: ClassFormData) => {
    if (!firestore) return;
    try {
      if (editingClass) {
        const classRef = doc(firestore, 'tridy', editingClass.id);
        await updateDoc(classRef, formData as any);
        toast({
          title: 'Třída uložena',
          description: `Třída ${formData.name} byla úspěšně uložena.`,
        });
      } else {
        const docRef = await addDoc(collection(firestore, 'tridy'), formData);
        await updateDoc(docRef, { id: docRef.id });
        toast({
          title: 'Třída přidána',
          description: `Třída ${formData.name} byla úspěšně přidána.`,
        });
      }
      setIsDialogOpen(false);
      setEditingClass(null);
    } catch (error) {
      console.error('Error saving class:', error);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Při ukládání třídy došlo k chybě.',
      });
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'tridy', classId));
      toast({
        title: 'Třída smazána',
        description: 'Třída byla úspěšně odstraněna.',
      });
    } catch (error) {
      console.error('Error deleting class:', error);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Při mazání třídy došlo k chybě.',
      });
    }
    setDeletingClass(null);
  };

  const openDialog = (classData: Class | null) => {
    setEditingClass(classData);
    setIsDialogOpen(true);
  };

  if (authLoading) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Načítání...</h1>
            <p className="text-muted-foreground">Ověřování oprávnění.</p>
        </div>
    )
  }

  if (!hasRole('administrator')) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Přístup odepřen</h1>
            <p className="text-muted-foreground">Pro přístup k této stránce nemáte oprávnění.</p>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Správa tříd</h1>
        <p className="text-muted-foreground">Správa všech tříd v systému.</p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) setEditingClass(null);
      }}>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Seznam tříd</CardTitle>
              <CardDescription>
                Celkem {classes?.length ?? 0} tříd v databázi.
              </CardDescription>
            </div>
            <Button onClick={() => openDialog(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Přidat třídu
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Název třídy</TableHead>
                  <TableHead>Třídní učitel</TableHead>
                  <TableHead>Počet žáků</TableHead>
                  <TableHead>
                    <span className="sr-only">Akce</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Načítání dat...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && classes?.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.teacher}</TableCell>
                    <TableCell>{cls.studentCount}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => openDialog(cls)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Upravit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setDeletingClass(cls)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Smazat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingClass ? 'Upravit třídu' : 'Přidat novou třídu'}
            </DialogTitle>
          </DialogHeader>
          {isDialogOpen && (
             <ClassForm
                classData={editingClass}
                onSave={handleSaveClass}
                closeDialog={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingClass} onOpenChange={() => setDeletingClass(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu chcete smazat třídu?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce je nevratná a trvale smaže třídu "{deletingClass?.name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingClass(null)}>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingClass && handleDeleteClass(deletingClass.id)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
