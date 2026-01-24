'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  doc
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Organization, OrganizationType } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { cs } from 'date-fns/locale';

const orgSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  type: z.enum(['skola', 'zajmova_skupina']),
  registrationPin: z.string().optional().nullable(),
});

type OrgFormData = z.infer<typeof orgSchema>;

function OrgForm({
  org,
  onSave,
  closeDialog,
}: {
  org?: Organization | null;
  onSave: (data: Partial<Organization>) => void;
  closeDialog: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: org?.name || '',
      type: org?.type || 'skola',
      registrationPin: org?.registrationPin || null,
    },
  });

  const onSubmit = (data: OrgFormData) => {
    onSave(data);
    closeDialog();
  };
  
  const generatePin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setValue('registrationPin', pin, { shouldValidate: true });
  };

  const currentPin = watch('registrationPin');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      <div className="space-y-1">
        <Label htmlFor="name">Název organizace</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="type">Typ organizace</Label>
        <Controller
            name="type"
            control={control}
            render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="skola">Škola</SelectItem>
                        <SelectItem value="zajmova_skupina">Zájmová skupina</SelectItem>
                    </SelectContent>
                </Select>
            )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">Registrační PIN ředitele</Label>
        <div className="flex items-center gap-2">
          <Input id="pin" {...register('registrationPin')} readOnly placeholder="PIN není vygenerován" />
          <Button type="button" variant="outline" onClick={generatePin}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Generovat
          </Button>
        </div>
        {currentPin && <p className="text-xs text-muted-foreground">Tento PIN slouží pro první registraci ředitele organizace.</p>}
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

function AdminOrgManagement() {
  const firestore = useFirestore();
  const { user } = useAuth();
  
  const orgsCollection = useMemoFirebase(() => (firestore) ? collection(firestore, 'organizations') : null, [firestore]);
  const { data: organizations, isLoading: orgsLoading } = useCollection<Organization>(orgsCollection);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const { toast } = useToast();

  const handleSaveOrg = (formData: Partial<Organization>) => {
    if (!firestore || !user) return;
    
    if (editingOrg) {
      const orgRef = doc(firestore, 'organizations', editingOrg.id);
       const dataToSave = { ...formData };
      updateDocumentNonBlocking(orgRef, dataToSave);
      toast({
        title: 'Organizace uložena',
      });
    } else {
        const dataToSave: Partial<Organization> = {
          ...formData,
          ownerId: user.id
        };
      addDocumentNonBlocking(collection(firestore, 'organizations'), dataToSave);
      toast({
        title: 'Organizace přidána',
      });
    }
    setIsDialogOpen(false);
    setEditingOrg(null);
  };

  const handleDeleteOrg = () => {
    if (!firestore || !deletingOrg) return;
    deleteDocumentNonBlocking(doc(firestore, 'organizations', deletingOrg.id));
    toast({
      title: 'Organizace smazána',
    });
    setDeletingOrg(null);
  };

  const openDialog = (org: Organization | null) => {
    setEditingOrg(org);
    setIsDialogOpen(true);
  };

  const orgTypeTranslations: Record<OrganizationType, string> = {
    'skola': 'Škola',
    'zajmova_skupina': 'Zájmová skupina'
  }

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) setEditingOrg(null);
      }}>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Seznam organizací</CardTitle>
              <CardDescription>
                Celkem {organizations?.length ?? 0} organizací v systému.
              </CardDescription>
            </div>
            <Button onClick={() => openDialog(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Přidat organizaci
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Název</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Registrační PIN</TableHead>
                   <TableHead>
                    <span className="sr-only">Akce</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgsLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Načítání dat...
                    </TableCell>
                  </TableRow>
                )}
                {!orgsLoading && organizations?.map((org) => (
                    <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{orgTypeTranslations[org.type] || org.type}</TableCell>
                        <TableCell className="font-mono">{org.registrationPin || '-'}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="icon" onClick={() => openDialog(org)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingOrg(org)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
              {editingOrg ? 'Upravit organizaci' : 'Přidat novou organizaci'}
            </DialogTitle>
          </DialogHeader>
           {isDialogOpen && (
            <OrgForm
                org={editingOrg}
                onSave={handleSaveOrg}
                closeDialog={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

        {deletingOrg && (
            <AlertDialog open={!!deletingOrg} onOpenChange={() => setDeletingOrg(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                    Opravdu chcete smazat organizaci?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                    Tato akce je nevratná a trvale smaže organizaci "{deletingOrg?.name}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                    <AlertDialogAction
                    onClick={handleDeleteOrg}
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

export default function SpravaOrganizaciPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const firestore = useFirestore();

  const orgsCollection = useMemoFirebase(() => (firestore ? collection(firestore, 'organizations') : null), [firestore]);
  const { data: organizations, isLoading: orgsLoading } = useCollection<Organization>(orgsCollection);

  const isLoading = authLoading || orgsLoading;
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Správa organizací</h1>
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
  
  // Allow access if user is super admin OR if no organizations exist yet
  if (!isSuperAdmin() && organizations && organizations.length > 0) {
     return (
      <div className="space-y-6">
         <Card>
            <CardHeader>
              <CardTitle>Přístup odepřen</CardTitle>
              <CardDescription>Pro přístup k této stránce musíte být Super Administrátor.</CardDescription>
            </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Správa organizací</h1>
        <p className="text-muted-foreground">Správa všech organizací v systému.</p>
      </div>
      <AdminOrgManagement />
    </div>
  );
}
    
