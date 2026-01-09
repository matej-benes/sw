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
import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { User, Trida as Class } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


const classSchema = z.object({
  nazev: z.string().min(1, 'Název je povinný'),
  ucitelId: z.string().min(1, 'Je nutné vybrat třídního učitele'),
  studentCount: z.coerce.number().min(0, 'Počet musí být nezáporný').optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

function ClassForm({
  classData,
  teachers,
  onSave,
  closeDialog,
}: {
  classData?: Class | null;
  teachers: User[];
  onSave: (data: ClassFormData) => void;
  closeDialog: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      nazev: classData?.nazev || '',
      ucitelId: classData?.ucitelId || '',
      studentCount: classData?.ziaciIds?.length || 0,
    },
  });

  const onSubmit = (data: ClassFormData) => {
    onSave(data);
    closeDialog();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      <div className="space-y-1">
        <Label htmlFor="nazev">Název třídy</Label>
        <Input id="nazev" {...register('nazev')} />
        {errors.nazev && (
          <p className="text-sm text-destructive">{errors.nazev.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="teacher">Třídní učitel</Label>
        <Controller
          name="ucitelId"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte učitele" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.ucitelId && (
          <p className="text-sm text-destructive">
            {errors.ucitelId.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="studentCount">Počet žáků</Label>
        <Input
          id="studentCount"
          type="number"
          {...register('studentCount')}
          disabled
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

function ClassRow({ classData, teachers, onEdit, onDelete }: { classData: Class, teachers: User[], onEdit: (classData: Class) => void, onDelete: (classData: Class) => void }) {
    const teacher = teachers.find(t => t.id === classData.ucitelId);
    
    return (
        <TableRow>
            <TableCell className="font-medium">{classData.nazev}</TableCell>
            <TableCell>{teacher?.name || 'Neznámý'}</TableCell>
            <TableCell>{classData.ziaciIds?.length || 0}</TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => onEdit(classData)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Upravit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                    onSelect={() => onDelete(classData)}
                    className="text-destructive"
                    >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Smazat
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    )
}

function AdminClassManagement() {
  const firestore = useFirestore();
  const { hasRole } = useAuth();
  
  const classesCollection = useMemoFirebase(() => (firestore && hasRole('administrator')) ? collection(firestore, 'tridy') : null, [firestore, hasRole]);
  const { data: classes, isLoading: classesLoading } = useCollection<Class>(classesCollection);
  
  const teachersQuery = useMemoFirebase(() => (firestore && hasRole('administrator')) ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore, hasRole]);
  const { data: teachers, isLoading: teachersLoading } = useCollection<User>(teachersQuery);


  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);
  const { toast } = useToast();

  const handleSaveClass = async (formData: ClassFormData) => {
    if (!firestore) return;
    
    const dataToSave = {
        nazev: formData.nazev,
        ucitelId: formData.ucitelId,
    }

    try {
      if (editingClass) {
        const classRef = doc(firestore, 'tridy', editingClass.id);
        await updateDoc(classRef, dataToSave);
        toast({
          title: 'Třída uložena',
          description: `Třída ${formData.nazev} byla úspěšně uložena.`,
        });
      } else {
        const docRef = await addDoc(collection(firestore, 'tridy'), {
            ...dataToSave,
            ziaciIds: [], // initialize with empty students array
        });
        await updateDoc(docRef, { id: docRef.id });
        toast({
          title: 'Třída přidána',
          description: `Třída ${formData.nazev} byla úspěšně přidána.`,
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

  const handleDeleteClass = async () => {
    if (!firestore || !deletingClass) return;
    try {
      await deleteDoc(doc(firestore, 'tridy', deletingClass.id));
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
    } finally {
        setDeletingClass(null);
    }
  };

  const openDialog = (classData: Class | null) => {
    setEditingClass(classData);
    setIsDialogOpen(true);
  };
    
  return (
    <>
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
            <Button onClick={() => openDialog(null)} disabled={teachersLoading}>
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
                {(classesLoading || teachersLoading) && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Načítání dat...
                    </TableCell>
                  </TableRow>
                )}
                {!classesLoading && !teachersLoading && classes?.map((cls) => (
                    <ClassRow key={cls.id} classData={cls} teachers={teachers || []} onEdit={openDialog} onDelete={setDeletingClass} />
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
                teachers={teachers || []}
                onSave={handleSaveClass}
                closeDialog={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {deletingClass && (
        <AlertDialog open={!!deletingClass} onOpenChange={() => setDeletingClass(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Opravdu chcete smazat třídu?</AlertDialogTitle>
                <AlertDialogDescription>
                    Tato akce je nevratná a trvale smaže třídu "{deletingClass?.nazev}".
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteClass}
                    className="bg-destructive hover:bg-destructive/90"
                >
                    Smazat
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
      )}
    </>
  );
}

export default function SpravaTridyPage() {
  const { hasRole } = useAuth();
  const { isUserLoading } = useUser();
  
  if (isUserLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Správa tříd</h1>
          <p className="text-muted-foreground">Správa všech tříd v systému.</p>
        </div>
        <Card>
            <CardHeader>
              <CardTitle>Načítání...</CardTitle>
              <CardDescription>Ověřování oprávnění.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-24 text-center flex items-center justify-center">
                    Načítání dat...
                </div>
            </CardContent>
        </Card>
      </div>
    )
  }
  
  if (!hasRole('administrator')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Správa tříd</h1>
          <p className="text-muted-foreground">Správa všech tříd v systému.</p>
        </div>
         <Card>
            <CardHeader>
              <CardTitle>Přístup odepřen</CardTitle>
              <CardDescription>Pro přístup k této stránce nemáte oprávnění.</CardDescription>
            </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Správa tříd</h1>
        <p className="text-muted-foreground">Správa všech tříd v systému.</p>
      </div>
      <AdminClassManagement />
    </div>
  );
}
