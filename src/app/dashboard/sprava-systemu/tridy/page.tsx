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
import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { User, Trida as Class } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';


const classSchema = z.object({
  nazev: z.string().min(1, 'Název je povinný'),
  ucitelId: z.string().min(1, 'Je nutné vybrat třídního učitele'),
  zastupciIds: z.array(z.string()).optional(),
  asistentiIds: z.array(z.string()).optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

function ClassForm({
  classData,
  teachers,
  assistants,
  onSave,
  closeDialog,
}: {
  classData?: Class | null;
  teachers: User[];
  assistants: User[];
  onSave: (data: ClassFormData) => void;
  closeDialog: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      nazev: classData?.nazev || '',
      ucitelId: classData?.ucitelId || '',
      zastupciIds: classData?.zastupciIds || [],
      asistentiIds: classData?.asistentiIds || [],
    },
  });

  const onSubmit = (data: ClassFormData) => {
    onSave(data);
    closeDialog();
  };

  const teacherOptions = useMemo(() => 
    teachers.map(t => ({ value: t.id, label: t.name })),
  [teachers]);

  const assistantOptions = useMemo(() =>
    assistants.map(a => ({ value: a.id, label: a.name })),
  [assistants]);

  const selectedClassTeacherId = watch('ucitelId');

  const substituteTeacherOptions = useMemo(() =>
    teacherOptions.filter(option => option.value !== selectedClassTeacherId),
  [teacherOptions, selectedClassTeacherId]);


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
        <Label htmlFor="substitutes">Zástupci třídního učitele</Label>
        <Controller
            name="zastupciIds"
            control={control}
            render={({ field }) => (
                <MultiSelect
                    options={substituteTeacherOptions}
                    onValueChange={field.onChange}
                    defaultValue={field.value || []}
                    placeholder="Vyberte zástupce..."
                />
            )}
        />
         {errors.zastupciIds && (
          <p className="text-sm text-destructive">
            {errors.zastupciIds.message}
          </p>
        )}
      </div>
       <div className="space-y-1">
        <Label htmlFor="assistants">Asistenti pedagoga</Label>
        <Controller
            name="asistentiIds"
            control={control}
            render={({ field }) => (
                <MultiSelect
                    options={assistantOptions}
                    onValueChange={field.onChange}
                    defaultValue={field.value || []}
                    placeholder="Vyberte asistenty..."
                />
            )}
        />
         {errors.asistentiIds && (
          <p className="text-sm text-destructive">
            {errors.asistentiIds.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="studentCount">Počet žáků</Label>
        <Input
          id="studentCount"
          type="number"
          value={classData?.ziaciIds?.length || 0}
          disabled
        />
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

function ClassRow({ classData, allUsers, onEdit, onDelete }: { classData: Class, allUsers: User[], onEdit: (classData: Class) => void, onDelete: (classData: Class) => void }) {
    const teacher = allUsers?.find(t => t.id === classData.ucitelId);
    const substituteTeachers = classData.zastupciIds?.map(id => allUsers?.find(t => t.id === id)?.name).filter(Boolean) || [];
    const assistants = classData.asistentiIds?.map(id => allUsers?.find(t => t.id === id)?.name).filter(Boolean) || [];
    
    return (
        <TableRow>
            <TableCell className="font-medium">{classData.nazev}</TableCell>
            <TableCell>
                <div className="flex flex-col gap-1">
                    {teacher && <span className="font-semibold text-destructive">{teacher?.name} (Třídní)</span>}
                    {substituteTeachers.length > 0 && (
                        <span className="text-muted-foreground text-sm">
                           <span className="text-destructive font-semibold">Zástupci:</span> {substituteTeachers.join(', ')}
                        </span>
                    )}
                    {assistants.length > 0 && (
                        <span className="text-muted-foreground text-sm">
                           <span className="text-blue-600 font-semibold">Asistenti:</span> {assistants.join(', ')}
                        </span>
                    )}
                </div>
            </TableCell>
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
  const { hasRole, activeOrganizationId } = useAuth();
  
  const classesCollection = useMemoFirebase(() => (firestore) ? collection(firestore, 'tridy') : null, [firestore]);
  const { data: classes, isLoading: classesLoading, error: classesError } = useCollection<Class>(classesCollection);
  
  const teachersQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, "users"), where("roles", "array-contains", "ucitel")) : null, [firestore]);
  const { data: teachers, isLoading: teachersLoading, error: teachersError } = useCollection<User>(teachersQuery);

  const assistantsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, "users"), where("roles", "array-contains", "asistent pedagoga")) : null, [firestore]);
  const { data: assistants, isLoading: assistantsLoading, error: assistantsError } = useCollection<User>(assistantsQuery);

  const allStaffQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, "users"), where("roles", "array-contains-any", ["ucitel", "asistent pedagoga"]));
  }, [firestore]);
  const { data: allStaff, isLoading: allStaffLoading } = useCollection<User>(allStaffQuery);


  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);
  const { toast } = useToast();

  const handleSaveClass = (formData: ClassFormData) => {
    if (!firestore || !activeOrganizationId) {
       toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nelze uložit třídu, chybí ID organizace.",
      });
      return;
    };
    
    const dataToSave = {
        organizationId: activeOrganizationId,
        nazev: formData.nazev,
        ucitelId: formData.ucitelId,
        zastupciIds: formData.zastupciIds || [],
        asistentiIds: formData.asistentiIds || [],
    }

    if (editingClass) {
      const classRef = doc(firestore, 'tridy', editingClass.id);
      updateDocumentNonBlocking(classRef, dataToSave);
      toast({
        title: 'Třída uložena',
        description: `Třída ${formData.nazev} byla úspěšně uložena.`,
      });
    } else {
      addDocumentNonBlocking(collection(firestore, 'tridy'), {
          ...dataToSave,
          ziaciIds: [], // initialize with empty students array
      });
      toast({
        title: 'Třída přidána',
        description: `Třída ${formData.nazev} byla úspěšně přidána.`,
      });
    }
    setIsDialogOpen(false);
    setEditingClass(null);
  };

  const handleDeleteClass = async () => {
    if (!firestore || !deletingClass) return;

    try {
        const batch = writeBatch(firestore);

        // 1. Unassign tridaId from all students in the class
        if (deletingClass.ziaciIds && deletingClass.ziaciIds.length > 0) {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('__name__', 'in', deletingClass.ziaciIds));
            const studentsSnapshot = await getDocs(q);
            studentsSnapshot.forEach((studentDoc) => {
                const userRef = doc(firestore, 'users', studentDoc.id);
                batch.update(userRef, { tridaId: null });
            });
        }

        // 2. Delete the class document
        const classRef = doc(firestore, 'tridy', deletingClass.id);
        batch.delete(classRef);
        
        await batch.commit();

        toast({
            title: 'Třída smazána',
            description: `Třída "${deletingClass.nazev}" a její vazby na studenty byly odstraněny.`,
        });

    } catch (e) {
        console.error("Error deleting class and updating students: ", e);
        toast({
            variant: 'destructive',
            title: 'Chyba při mazání',
            description: 'Nepodařilo se smazat třídu a aktualizovat studenty.',
        });
    }

    setDeletingClass(null);
  };

  const openDialog = (classData: Class | null) => {
    setEditingClass(classData);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if(classesError) console.error("Error loading classes: ", classesError);
    if(teachersError) console.error("Error loading teachers: ", teachersError);
    if(assistantsError) console.error("Error loading assistants: ", assistantsError);
  }, [classesError, teachersError, assistantsError])
    
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
            <Button onClick={() => openDialog(null)} disabled={teachersLoading || assistantsLoading}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Přidat třídu
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Název třídy</TableHead>
                  <TableHead>Učitelé a Asistenti</TableHead>
                  <TableHead>Počet žáků</TableHead>
                  <TableHead>
                    <span className="sr-only">Akce</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(classesLoading || teachersLoading || assistantsLoading || allStaffLoading) && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Načítání dat...
                    </TableCell>
                  </TableRow>
                )}
                {!(classesLoading || teachersLoading || assistantsLoading || allStaffLoading) && classes?.map((cls) => (
                    <ClassRow key={cls.id} classData={cls} allUsers={allStaff || []} onEdit={openDialog} onDelete={setDeletingClass} />
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
                assistants={assistants || []}
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
                    Tato akce je nevratná. Trvale smaže třídu "{deletingClass?.nazev}" a odebere všechny žáky z této třídy.
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
  const { user, isUserLoading } = useUser();
  
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
  
  if (!user || !hasRole('administrator')) {
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
