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
import { MultiSelect } from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';


const roleTranslations: { [key in Role]: string } = {
  ucitel: 'Učitel',
  rodic: 'Rodič',
  ziak: 'Žák',
  administrator: 'Administrátor',
  'vedouci pracovnik': 'Vedoucí pracovník',
  'asistent pedagoga': 'Asistent pedagoga',
  'vedouci skupiny': 'Vedoucí skupiny',
  'hlavni vedouci skupiny': 'Hlavní vedoucí skupiny',
  'clen': 'Člen',
};
const allSchoolRoles: Role[] = ['ucitel', 'rodic', 'ziak', 'administrator', 'vedouci pracovnik', 'asistent pedagoga'];
const allInterestGroupRoles: Role[] = ['hlavni vedouci skupiny', 'vedouci skupiny', 'clen', 'administrator'];


const userSchema = z.object({
  name: z.string().min(1, 'Jméno je povinné'),
  email: z.string().email('Neplatný formát emailu'),
  roles: z.array(z.string()).min(1, 'Uživatel musí mít alespoň jednu roli'),
  pin: z.string().optional().nullable(),
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
  onSave: (data: Partial<User>, pin: string | null) => void;
  closeDialog: () => void;
}) {
  const { hasRole } = useAuth();
  const firestore = useFirestore();
  
  const tridyQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'tridy'));
  }, [firestore]);

  const { data: classes } = useCollection<Trida>(tridyQuery);

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
      tridaId: (user as any)?.tridaId || null,
      studentId: user?.studentId || null,
    },
  });
  
  const currentPin = watch('pin');
  
  const onSubmit = (data: UserFormData) => {
    const pin = data.pin || null;
    const userData = { ...data };
    delete (userData as any).pin;
    onSave(userData, pin);
    closeDialog();
  };


  const generatePin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setValue('pin', newPin, { shouldValidate: true });
  };
  
  const roles = watch('roles');
  const isZiak = roles.includes('ziak');
  const isRodic = roles.includes('rodic');
  
  const availableRoles = allSchoolRoles;

  useEffect(() => {
    if (!isZiak) {
      setValue('tridaId', null);
    }
     if (!isRodic) {
        setValue('studentId', null);
    }
  }, [isZiak, isRodic, setValue]);
  
  const students = useMemo(() => allUsers.filter(u => u.roles?.includes('ziak')), [allUsers]);

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
            <MultiSelect
              options={availableRoles.map(r => ({ value: r, label: roleTranslations[r] }))}
              onValueChange={field.onChange}
              defaultValue={field.value}
              placeholder="Vyberte role..."
            />
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
        <Label htmlFor="pin">Registrační PIN (Heslo)</Label>
        <div className="flex items-center gap-2">
          <Input id="pin" {...register('pin')} placeholder="PIN není vygenerován" />
          <Button type="button" variant="outline" onClick={generatePin}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Generovat
          </Button>
        </div>
        {currentPin && <p className="text-xs text-muted-foreground">Tento PIN slouží pro první registraci uživatele a jako jeho heslo.</p>}
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
    const { user: adminUser, signIn } = useAuth();
    
    const usersCollection = useMemoFirebase(
      () => (firestore) ? collection(firestore, 'users') : null,
      [firestore]
    );

    const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersCollection);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const { toast } = useToast();

    const removeUndefinedFields = (obj: any) => {
        return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
    };

    const handleSaveUser = async (formData: Partial<User>, pin: string | null) => {
      if (!firestore || !adminUser?.email) return;

      try {
        if (editingUser) {
          const userRef = doc(firestore, 'users', editingUser.id);
          const dataToUpdate: Partial<User> = {
            name: formData.name,
            email: formData.email,
            roles: formData.roles || [],
            tridaId: formData.tridaId,
            studentId: formData.studentId,
            datumNarozeni: formData.datumNarozeni,
            rodnePrijmeni: formData.rodnePrijmeni,
            mistoNarozeni: formData.mistoNarozeni,
            statNarozeni: formData.statNarozeni,
            pohlavi: formData.pohlavi,
            rodinnyStav: formData.rodinnyStav,
            stav: formData.stav,
            plnolety: formData.plnolety,
            cisloOP: formData.cisloOP,
            cisloPasu: formData.cisloPasu,
            osobniEmail: formData.osobniEmail,
            skolniEmail: formData.skolniEmail,
          };
          const cleanedData = removeUndefinedFields(dataToUpdate);
          await updateDoc(userRef, cleanedData);
          toast({ title: 'Uživatel aktualizován' });

        } else {
          if (!formData.email || !pin || !formData.name) {
            throw new Error("Email, PIN a jméno jsou povinné pro vytvoření nového uživatele.");
          }
          
          const adminEmail = adminUser.email;
          
          const userCredential = await createUserWithEmailAndPassword(getAuth(), formData.email, pin);
          const newUser = userCredential.user;
          
          // Re-authenticate as admin
          const adminPassword = prompt("Pro potvrzení zadejte prosím znovu své administrátorské heslo:");
          if (!adminPassword) {
              toast({ variant: 'destructive', title: 'Operace přerušena', description: 'Novému uživateli byl vytvořen účet, ale vy jste byli odhlášeni. Přihlaste se prosím znovu.' });
              await getAuth().signOut();
              return;
          }
          await signIn(adminEmail, adminPassword);


          const newUserForDb: Partial<User> = {
            id: newUser.uid,
            name: formData.name,
            email: formData.email,
            roles: formData.roles || [],
            avatarUrl: `https://picsum.photos/seed/${newUser.uid}/100/100`,
            ...(formData.studentId && { studentId: formData.studentId }),
            ...(formData.tridaId && { tridaId: formData.tridaId }),
          };
          
          const cleanedData = removeUndefinedFields(newUserForDb);
          await setDoc(doc(firestore, 'users', newUser.uid), cleanedData);
          
          toast({ title: 'Uživatel vytvořen' });
        }
      } catch (e: any) {
        console.error("Error saving user:", e);
        let description = 'Nepodařilo se uložit uživatele.';
        if (e.code === 'auth/email-already-in-use') {
          description = 'Tento e-mail je již používán jiným účtem.';
        } else if (e.code === 'auth/wrong-password') {
            description = 'Bylo zadáno nesprávné administrátorské heslo. Uživatel byl vytvořen, ale vy jste byli odhlášeni.';
        }
        toast({ variant: 'destructive', title: 'Chyba', description });
      }

      setIsDialogOpen(false);
      setEditingUser(null);
    };

    const handleDeleteUser = async () => {
        if (!deletingUser || !firestore) return;

        try {
            const batch = writeBatch(firestore);
            
            const userRef = doc(firestore, 'users', deletingUser.id);
            batch.delete(userRef);

            await batch.commit();
            
            toast({
              title: 'Uživatel smazán',
              description: 'Uživatel byl úspěšně odstraněn ze systému. Pro úplné smazání (včetně autentizace) je nutné provést akci ve Firebase konzoli.',
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
                Celkem {allUsers?.length ?? 0} uživatelů.
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
                {!usersLoading && allUsers?.map((user) => (
                    <UserRow key={user.id} user={user} onEdit={openDialog} onDelete={setDeletingUser} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <DialogContent className={cn("sm:max-w-[425px]")}>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Upravit uživatele' : 'Přidat nového uživatele'}
            </DialogTitle>
          </DialogHeader>
          {isDialogOpen && allUsers && (
             <UserForm
                user={editingUser}
                allUsers={allUsers}
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
                  Tato akce trvale smaže uživatelský záznam "{deletingUser?.name}" z databáze. Pro kompletní odstranění z autentizace je třeba zásah ve Firebase konzoli.
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