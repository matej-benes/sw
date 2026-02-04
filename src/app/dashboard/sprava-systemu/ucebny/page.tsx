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
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  doc
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Ucebna } from '@/lib/types';


const ucebnaSchema = z.object({
  nazev: z.string().min(1, 'Název je povinný'),
  kapacita: z.coerce.number().min(0, 'Kapacita musí být nezáporná').optional(),
});

type UcebnaFormData = z.infer<typeof ucebnaSchema>;

function UcebnaForm({
  ucebna,
  onSave,
  closeDialog,
}: {
  ucebna?: Ucebna | null;
  onSave: (data: UcebnaFormData) => void;
  closeDialog: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UcebnaFormData>({
    resolver: zodResolver(ucebnaSchema),
    defaultValues: {
      nazev: ucebna?.nazev || '',
      kapacita: ucebna?.kapacita || 0,
    },
  });

  const onSubmit = (data: UcebnaFormData) => {
    onSave(data);
    closeDialog();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      <div className="space-y-1">
        <Label htmlFor="nazev">Název učebny</Label>
        <Input id="nazev" {...register('nazev')} />
        {errors.nazev && (
          <p className="text-sm text-destructive">{errors.nazev.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="kapacita">Kapacita</Label>
        <Input
          id="kapacita"
          type="number"
          {...register('kapacita')}
        />
        {errors.kapacita && (
          <p className="text-sm text-destructive">
            {errors.kapacita.message}
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

function UcebnaRow({ ucebna, onEdit, onDelete }: { ucebna: Ucebna; onEdit: (ucebna: Ucebna) => void; onDelete: (ucebna: Ucebna) => void; }) {
    return (
        <TableRow>
            <TableCell className="font-medium">{ucebna.nazev}</TableCell>
            <TableCell>{ucebna.kapacita || '-'}</TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(ucebna)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Upravit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                    onClick={() => onDelete(ucebna)}
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

function AdminUcebnaManagement() {
  const firestore = useFirestore();
  const ucebnyCollection = useMemoFirebase(() => (firestore) ? collection(firestore, 'ucebny') : null, [firestore]);
  const { data: ucebny, isLoading: ucebnyLoading } = useCollection<Ucebna>(ucebnyCollection);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUcebna, setEditingUcebna] = useState<Ucebna | null>(null);
  const [deletingUcebna, setDeletingUcebna] = useState<Ucebna | null>(null);
  const { toast } = useToast();

  const handleSaveUcebna = (formData: UcebnaFormData) => {
    if (!firestore) return;
    
    if (editingUcebna) {
      const ucebnaRef = doc(firestore, 'ucebny', editingUcebna.id);
      updateDocumentNonBlocking(ucebnaRef, formData);
      toast({
        title: 'Učebna uložena',
        description: `Učebna ${formData.nazev} byla úspěšně uložena.`,
      });
    } else {
      addDocumentNonBlocking(collection(firestore, 'ucebny'), formData);
      toast({
        title: 'Učebna přidána',
        description: `Učebna ${formData.nazev} byla úspěšně přidána.`,
      });
    }
    setIsDialogOpen(false);
    setEditingUcebna(null);
  };

  const handleDeleteUcebna = () => {
    if (!firestore || !deletingUcebna) return;
    deleteDocumentNonBlocking(doc(firestore, 'ucebny', deletingUcebna.id));
    toast({
      title: 'Učebna smazána',
      description: 'Učebna byla úspěšně odstraněna.',
    });
    setDeletingUcebna(null);
  };

  const openDialog = (ucebna: Ucebna | null) => {
    setEditingUcebna(ucebna);
    setIsDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Seznam učeben</CardTitle>
            <CardDescription>
              Celkem {ucebny?.length ?? 0} učeben v databázi.
            </CardDescription>
          </div>
          <Button onClick={() => openDialog(null)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Přidat učebnu
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název učebny</TableHead>
                <TableHead>Kapacita</TableHead>
                <TableHead>
                  <span className="sr-only">Akce</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ucebnyLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Načítání dat...
                  </TableCell>
                </TableRow>
              )}
              {!ucebnyLoading && ucebny?.map((uc) => (
                  <UcebnaRow key={uc.id} ucebna={uc} onEdit={openDialog} onDelete={setDeletingUcebna} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) setEditingUcebna(null);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingUcebna ? 'Upravit učebnu' : 'Přidat novou učebnu'}
            </DialogTitle>
          </DialogHeader>
           {isDialogOpen && (
            <UcebnaForm
                ucebna={editingUcebna}
                onSave={handleSaveUcebna}
                closeDialog={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

        {deletingUcebna && (
            <AlertDialog open={!!deletingUcebna} onOpenChange={() => setDeletingUcebna(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                    Opravdu chcete smazat učebnu?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                    Tato akce je nevratná a trvale smaže učebnu "{deletingUcebna?.nazev}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                    <AlertDialogAction
                    onClick={handleDeleteUcebna}
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

export default function UcebnyPage() {
  const { hasRole } = useAuth();
  const { user, isUserLoading } = useUser();
  
  const showLoading = isUserLoading;
  const showAccessDenied = !isUserLoading && (!user || !hasRole('administrator'));
  const showContent = !isUserLoading && user && hasRole('administrator');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Správa učeben</h1>
        <p className="text-muted-foreground">
          Správa všech učeben v systému.
        </p>
      </div>

       {showLoading && (
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
      )}
      
      {showAccessDenied && (
        <Card>
            <CardHeader>
              <CardTitle>Přístup odepřen</CardTitle>
              <CardDescription>Pro přístup k této stránce nemáte oprávnění.</CardDescription>
            </CardHeader>
        </Card>
      )}

      {showContent && (
        <AdminUcebnaManagement />
      )}
    </div>
  );
}
