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
import type { Role } from '@/lib/types';
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
import { useState, useEffect } from 'react';
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
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { User } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';


const roleTranslations: { [key in Role]: string } = {
  ucitel: 'Učitel',
  rodic: 'Rodič',
  ziak: 'Žák',
  administrator: 'Administrátor',
  'vedouci pracovnik': 'Vedoucí pracovník',
};
const allRoles = Object.keys(roleTranslations) as Role[];

const userSchema = z.object({
  name: z.string().min(1, 'Jméno je povinné'),
  email: z.string().email('Neplatný formát emailu'),
  roles: z.array(z.string()).min(1, 'Uživatel musí mít alespoň jednu roli'),
  pin: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

function UserForm({
  user,
  onSave,
  closeDialog,
}: {
  user?: User | null;
  onSave: (data: Partial<User>) => void;
  closeDialog: () => void;
}) {
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
      () => (firestore && hasRole('administrator')) ? collection(firestore, 'users') : null,
      [firestore, hasRole]
    );

    const { data: users, isLoading: usersLoading } = useCollection<User>(usersCollection);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const { toast } = useToast();

    const handleSaveUser = async (formData: Partial<User>) => {
      if (!firestore) return;
      try {
        if (editingUser) {
          const userRef = doc(firestore, 'users', editingUser.id);
          await updateDoc(userRef, formData);
          toast({
            title: 'Uživatel aktualizován',
            description: `Uživatel ${formData.name} byl úspěšně aktualizován.`,
          });
        } else {
          const newUser = {
            ...formData,
            avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
          };
          const docRef = await addDoc(collection(firestore, 'users'), newUser);
          await updateDoc(docRef, { id: docRef.id }); 
          toast({
            title: 'Uživatel přidán',
            description: `Uživatel ${formData.name} byl úspěšně přidán.`,
          });
        }
        setIsDialogOpen(false);
        setEditingUser(null);
      } catch (error) {
        console.error('Error saving user:', error);
        toast({
          variant: 'destructive',
          title: 'Chyba',
          description: 'Při ukládání uživatele došlo k chybě.',
        });
      }
    };

    const handleDeleteUser = async () => {
        if (!deletingUser || !firestore) return;
        try {
          await deleteDoc(doc(firestore, 'users', deletingUser.id));
          toast({
            title: 'Uživatel smazán',
            description: 'Uživatel byl úspěšně odstraněn ze systému.',
          });
          setDeletingUser(null);
        } catch (error) {
          console.error('Error deleting user:', error);
          toast({
            variant: 'destructive',
            title: 'Chyba',
            description: 'Při mazání uživatele došlo k chybě.',
          });
        } finally {
            setDeletingUser(null);
        }
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
  const { isUserLoading } = useUser();
  
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

  if (!hasRole('administrator')) {
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
