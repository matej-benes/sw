'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Role, Trida } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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
import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  writeBatch,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { User } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const roleTranslations: { [key in Role]: string } = {
  ucitel: 'Učitel',
  rodic: 'Rodič',
  ziak: 'Žák',
  administrator: 'Administrátor',
  'vedouci pracovnik': 'Vedoucí pracovník',
  'asistent pedagoga': 'Asistent pedagoga',
};
const allRoles = Object.keys(roleTranslations) as Role[];

const userSchema = z.object({
  name: z.string().min(1, 'Jméno je povinné'),
  email: z.string().email('Neplatný formát emailu'),
  roles: z.array(z.string()).min(1, 'Uživatel musí mít alespoň jednu roli'),
  pin: z.string().optional(),
  tridaId: z.string().optional().nullable(),
  studentId: z.string().optional().nullable(),
});

type UserFormData = z.infer<typeof userSchema>;

function UserForm({
  user,
  allUsers,
  onSave,
  closeDialog,
}: {
  user?: User | null;
  allUsers: User[],
  onSave: (data: Partial<User>) => void;
  closeDialog: () => void;
}) {
  const firestore = useFirestore();
  const tridyCollection = useMemoFirebase(() => firestore ? collection(firestore, 'tridy') : null, [firestore]);
  const { data: classes } = useCollection<Trida>(tridyCollection);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      roles: user?.roles || [],
      pin: user?.pin || '',
      tridaId: user?.tridaId || null,
      studentId: user?.studentId || null,
    },
  });

  const onSubmit = (data: UserFormData) => {
    onSave(data);
    closeDialog();
  };

  const generatePin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setValue('pin', newPin, { shouldValidate: true });
  };
  
  const currentPin = watch('pin');
  const roles = watch('roles');
  const isZiak = roles.includes('ziak');
  const isRodic = roles.includes('rodic');

  useEffect(() => {
    if (!isZiak) {
      setValue('tridaId', null);
    }
     if (!isRodic) {
      // If user is not a parent, studentId might be a parent for a student, so don't clear it.
      // This logic is tricky. Let's handle it based on context.
      if (!isZiak) {
         setValue('studentId', null);
      }
    }
  }, [isZiak, isRodic, setValue]);
  
  const students = useMemo(() => allUsers.filter(u => u.roles.includes('ziak')), [allUsers]);
  const parents = useMemo(() => allUsers.filter(u => u.roles.includes('rodic')), [allUsers]);


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      <div className="space-y-1">
        <Label htmlFor="name">Jméno</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" {...register('email')} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <Controller
          name="roles"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {allRoles.map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <Checkbox
                    id={role}
                    checked={field.value.includes(role)}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...field.value, role]
                        : field.value.filter((r) => r !== role);
                      field.onChange(newValue);
                    }}
                  />
                  <Label htmlFor={role} className="font-normal">
                    {roleTranslations[role]}
                  </Label>
                </div>
              ))}
            </div>
          )}
        />
        {errors.roles && (
          <p className="text-sm text-destructive">{errors.roles.message}</p>
        )}
      </div>

       {isZiak && (
        <>
            <div className="space-y-1">
                <Label htmlFor="tridaId">Třída</Label>
                <Controller
                    name="tridaId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                            <SelectContent>
                                {classes?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="studentId">Rodič</Label>
                <Controller
                    name="studentId" 
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger><SelectValue placeholder="Vyberte rodiče" /></SelectTrigger>
                            <SelectContent>
                                {parents.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
        </>
       )}

       {isRodic && (
        <div className="space-y-1">
            <Label htmlFor="studentId">Dítě (Žák)</Label>
             <Controller
                name="studentId"
                control={control}
                render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                        <SelectTrigger><SelectValue placeholder="Vyberte dítě" /></SelectTrigger>
                        <SelectContent>
                            {students.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                )}
            />
        </div>
       )}


       <div className="space-y-2">
        <Label htmlFor="pin">Registrační PIN</Label>
        <div className="flex items-center gap-2">
          <Input id="pin" {...register('pin')} readOnly placeholder="PIN není vygenerován" />
          <Button type="button" variant="outline" onClick={generatePin}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Generovat
          </Button>
        </div>
        {currentPin && <p className="text-xs text-muted-foreground">Tento PIN slouží pro první registraci uživatele.</p>}
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

function UserRow({ user, onEdit, onDelete }: { user: User, onEdit: (user: User) => void, onDelete: (user: User) => void }) {
    return (
        <TableRow>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                {(user.roles || []).map((role) => (
                    <Badge key={role} variant="secondary">
                    {roleTranslations[role as Role] || role}
                    </Badge>
                ))}
                </div>
            </TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => onEdit(user)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Upravit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                    onSelect={() => onDelete(user)}
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

function AdminUserManagement() {
    const firestore = useFirestore();
    const { hasRole } = useAuth();
    
    const usersCollection = useMemoFirebase(
      () => (firestore) ? collection(firestore, 'users') : null,
      [firestore]
    );

    const { data: users, isLoading: usersLoading } = useCollection<User>(usersCollection);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const { toast } = useToast();

    const handleSaveUser = async (formData: Partial<User>) => {
      if (!firestore) return;
      
      const dataToSave = {
          ...formData,
          tridaId: formData.tridaId || null,
          studentId: formData.studentId || null,
      };

      try {
        const batch = writeBatch(firestore);

        if (editingUser) { // --- UPDATE EXISTING USER ---
            const userRef = doc(firestore, 'users', editingUser.id);
            const originalUserDoc = await getDoc(userRef);
            const originalUserData = originalUserDoc.data() as User | undefined;

            batch.update(userRef, dataToSave);
            
            // --- LOGIC FOR RELATIONSHIPS ---
            const newIsZiak = dataToSave.roles?.includes('ziak');
            const newIsRodic = dataToSave.roles?.includes('rodic');
            const newStudentId = dataToSave.studentId; // This can be student ID (for parent) or parent ID (for student)
            
            // If user is a student, and we are assigning a parent to them
            if (newIsZiak && newStudentId) {
                const parentRef = doc(firestore, 'users', newStudentId);
                batch.update(parentRef, { studentId: editingUser.id }); // Parent's studentId is the student's ID
            }
            
            // If user is a parent, and we are assigning a student to them
            if (newIsRodic && newStudentId) {
                const studentRef = doc(firestore, 'users', newStudentId);
                batch.update(studentRef, { studentId: editingUser.id }); // Student's studentId is the parent's ID
            }
            // --- END LOGIC FOR RELATIONSHIPS ---


            // If class changed for a student
            if (dataToSave.roles?.includes('ziak')) {
                const originalTridaId = originalUserData?.tridaId;
                const newTridaId = dataToSave.tridaId;
                if (originalTridaId !== newTridaId) {
                    if (originalTridaId) batch.update(doc(firestore, 'tridy', originalTridaId), { ziaciIds: arrayRemove(editingUser.id) });
                    if (newTridaId) batch.update(doc(firestore, 'tridy', newTridaId), { ziaciIds: arrayUnion(editingUser.id) });
                }
            }
        } else { // --- CREATE NEW USER ---
            const newUserDocRef = doc(collection(firestore, 'users'));
            const newUserForDb = {
                ...dataToSave,
                id: newUserDocRef.id,
                avatarUrl: `https://picsum.photos/seed/${newUserDocRef.id}/100/100`,
            };
            batch.set(newUserDocRef, newUserForDb);

            if (newUserForDb.roles?.includes('ziak') && newUserForDb.tridaId) {
                batch.update(doc(firestore, 'tridy', newUserForDb.tridaId), { ziaciIds: arrayUnion(newUserForDb.id) });
            }
            
            // --- LOGIC FOR RELATIONSHIPS ---
            const newIsZiak = newUserForDb.roles?.includes('ziak');
            const newIsRodic = newUserForDb.roles?.includes('rodic');
            const newStudentId = newUserForDb.studentId; // This can be student ID (for parent) or parent ID (for student)
            
            // If user is a student, and we are assigning a parent to them
            if (newIsZiak && newStudentId) {
                const parentRef = doc(firestore, 'users', newStudentId);
                batch.update(parentRef, { studentId: newUserForDb.id });
            }
            
            // If user is a parent, and we are assigning a student to them
            if (newIsRodic && newStudentId) {
                const studentRef = doc(firestore, 'users', newStudentId);
                batch.update(studentRef, { studentId: newUserForDb.id });
            }
            // --- END LOGIC FOR RELATIONSHIPS ---
        }
        
        await batch.commit();

        toast({
            title: editingUser ? 'Uživatel aktualizován' : 'Uživatel přidán',
            description: `Uživatel ${dataToSave.name} byl úspěšně zpracován.`,
        });

      } catch(e) {
          console.error("Error saving user:", e);
          toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se uložit uživatele.' });
      }

      setIsDialogOpen(false);
      setEditingUser(null);
    };

    const handleDeleteUser = async () => {
        if (!deletingUser || !firestore) return;

        try {
            const batch = writeBatch(firestore);

            // If deleting a student, remove them from their class
            if (deletingUser.roles.includes('ziak') && deletingUser.tridaId) {
                const tridaRef = doc(firestore, 'tridy', deletingUser.tridaId);
                batch.update(tridaRef, { ziaciIds: arrayRemove(deletingUser.id) });
            }
            
            const userRef = doc(firestore, 'users', deletingUser.id);
            batch.delete(userRef);

            await batch.commit();
            
            toast({
              title: 'Uživatel smazán',
              description: 'Uživatel byl úspěšně odstraněn ze systému.',
            });
        } catch(e) {
            console.error("Error deleting user:", e);
            toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se smazat uživatele.' });
        }
        
        setDeletingUser(null);
      };

    const openDialog = (user: User | null) => {
      setEditingUser(user);
      setIsDialogOpen(true);
    };
    
    return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) setEditingUser(null);
      }}>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Seznam uživatelů</CardTitle>
              <CardDescription>
                Celkem {users?.length ?? 0} uživatelů v databázi.
              </CardDescription>
            </div>
            <Button onClick={() => openDialog(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Přidat uživatele
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jméno</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>
                    <span className="sr-only">Akce</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Načítání dat...
                    </TableCell>
                  </TableRow>
                )}
                {!usersLoading && users?.map((user) => (
                    <UserRow key={user.id} user={user} onEdit={openDialog} onDelete={setDeletingUser} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Upravit uživatele' : 'Přidat nového uživatele'}
            </DialogTitle>
          </DialogHeader>
          {isDialogOpen && (
             <UserForm
                user={editingUser}
                allUsers={users || []}
                onSave={handleSaveUser}
                closeDialog={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {deletingUser && (
        <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Opravdu chcete smazat uživatele?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce je nevratná a trvale smaže uživatele "{deletingUser?.name}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteUser}
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


export default function EvidenceOsobPage() {
  const { hasRole } = useAuth();
  const { user, isUserLoading } = useUser();
  
  if (isUserLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidence osob</h1>
          <p className="text-muted-foreground">Správa všech uživatelů v systému.</p>
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
            <h1 className="text-3xl font-bold tracking-tight">Evidence osob</h1>
            <p className="text-muted-foreground">Správa všech uživatelů v systému.</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Evidence osob</h1>
        <p className="text-muted-foreground">Správa všech uživatelů v systému.</p>
      </div>
      <AdminUserManagement />
    </div>
  );
}
