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
import type { Role, Trida, UserMembership } from '@/lib/types';
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
import { MultiSelect } from '@/components/ui/multi-select';


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
  onSave: (data: Partial<User>) => void;
  closeDialog: () => void;
}) {
  const { activeOrganization, activeOrganizationType } = useAuth();
  const firestore = useFirestore();
  
  const tridyQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganization) return null;
    return query(collection(firestore, 'tridy'), where('organizationId', '==', activeOrganization.id));
  }, [firestore, activeOrganization]);

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
      roles: user?.memberships?.find(m => m.organizationId === activeOrganization?.id)?.roles || [],
      pin: user?.pin || '',
      tridaId: (user as any)?.tridaId || null,
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
  
  const availableRoles = activeOrganizationType === 'skola' ? allSchoolRoles : allInterestGroupRoles;

  useEffect(() => {
    if (!isZiak) {
      setValue('tridaId', null);
    }
     if (!isRodic) {
        setValue('studentId', null);
    }
  }, [isZiak, isRodic, setValue]);
  
  const students = useMemo(() => allUsers.filter(u => u.memberships && u.memberships.some(m => m.roles.includes('ziak'))), [allUsers]);
  const parents = useMemo(() => allUsers.filter(u => u.memberships && u.memberships.some(m => m.roles.includes('rodic'))), [allUsers]);


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

function UserRow({ user, onEdit, onDelete, activeOrganizationId }: { user: User, onEdit: (user: User) => void, onDelete: (user: User) => void, activeOrganizationId: string | null }) {
    const membership = user.memberships?.find(m => m.organizationId === activeOrganizationId);
    
    return (
        <TableRow>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                {(membership?.roles || []).map((role) => (
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
    const { activeOrganizationId } = useAuth();
    
    const usersCollection = useMemoFirebase(
      () => (firestore) ? collection(firestore, 'users') : null,
      [firestore]
    );

    const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersCollection);

    const usersInOrg = useMemo(() => {
        if (!allUsers || !activeOrganizationId) return [];
        return allUsers.filter(u => u.memberships?.some(m => m.organizationId === activeOrganizationId));
    }, [allUsers, activeOrganizationId]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const { toast } = useToast();

    const handleSaveUser = async (formData: Partial<UserFormData>) => {
      if (!firestore || !activeOrganizationId) return;
      
      const newMembership: UserMembership = {
          organizationId: activeOrganizationId,
          roles: (formData.roles as Role[]) || []
      };

      try {
        if (editingUser) { // --- UPDATE EXISTING USER ---
            const userRef = doc(firestore, 'users', editingUser.id);
            const existingMemberships = editingUser.memberships || [];
            const otherMemberships = existingMemberships.filter(m => m.organizationId !== activeOrganizationId);
            
            const dataToUpdate: Partial<User> = {
                name: formData.name,
                email: formData.email,
                studentId: formData.studentId || undefined,
                tridaId: formData.tridaId || undefined, // This is not a standard User property, handle with care.
                memberships: [...otherMemberships, newMembership]
            };
            
            await updateDocumentNonBlocking(userRef, dataToUpdate);

        } else { // --- CREATE NEW USER ---
            // Creating a placeholder user. The real user is created during PIN registration.
            const newUserDocRef = doc(collection(firestore, 'users'));
            const newUserForDb: Partial<User> = {
                id: newUserDocRef.id,
                name: formData.name,
                email: formData.email,
                pin: formData.pin,
                studentId: formData.studentId || undefined,
                tridaId: formData.tridaId || undefined, // This is not a standard User property, handle with care.
                memberships: [newMembership],
                avatarUrl: `https://picsum.photos/seed/${newUserDocRef.id}/100/100`,
            };
            await setDoc(newUserDocRef, newUserForDb);
        }
        
        toast({
            title: editingUser ? 'Uživatel aktualizován' : 'Uživatel přidán',
            description: `Uživatel ${formData.name} byl úspěšně zpracován.`,
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
                Celkem {usersInOrg?.length ?? 0} uživatelů v této organizaci.
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
                {!usersLoading && usersInOrg?.map((user) => (
                    <UserRow key={user.id} user={user} onEdit={openDialog} onDelete={setDeletingUser} activeOrganizationId={activeOrganizationId} />
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
