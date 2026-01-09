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

type Subject = {
  id: string;
  name: string;
  shortcut: string;
  teacherCount: number;
};

const subjectSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  shortcut: z.string().min(1, 'Zkratka je povinná'),
  teacherCount: z.coerce.number().min(0, 'Počet musí být nezáporný'),
});

type SubjectFormData = z.infer<typeof subjectSchema>;

function SubjectForm({
  subject,
  onSave,
  closeDialog,
}: {
  subject?: Subject | null;
  onSave: (data: SubjectFormData) => void;
  closeDialog: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: subject?.name || '',
      shortcut: subject?.shortcut || '',
      teacherCount: subject?.teacherCount || 0,
    },
  });

  const onSubmit = (data: SubjectFormData) => {
    onSave(data);
    closeDialog();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      <div className="space-y-1">
        <Label htmlFor="name">Název předmětu</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="shortcut">Zkratka</Label>
        <Input id="shortcut" {...register('shortcut')} />
        {errors.shortcut && (
          <p className="text-sm text-destructive">{errors.shortcut.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="teacherCount">Počet vyučujících</Label>
        <Input
          id="teacherCount"
          type="number"
          {...register('teacherCount')}
        />
        {errors.teacherCount && (
          <p className="text-sm text-destructive">
            {errors.teacherCount.message}
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

function SubjectRow({ subject, onEdit, onDelete }: { subject: Subject; onEdit: (subject: Subject) => void; onDelete: (subject: Subject) => void; }) {
    return (
        <TableRow>
            <TableCell className="font-medium">{subject.name}</TableCell>
            <TableCell>{subject.shortcut}</TableCell>
            <TableCell>{subject.teacherCount}</TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => onEdit(subject)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Upravit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                    onSelect={() => onDelete(subject)}
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

function AdminSubjectManagement() {
  const firestore = useFirestore();
  const { hasRole } = useAuth();
  const subjectsCollection = useMemoFirebase(() => (firestore) ? collection(firestore, 'predmety') : null, [firestore]);
  const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsCollection);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const { toast } = useToast();

  const handleSaveSubject = (formData: SubjectFormData) => {
    if (!firestore) return;
    
    if (editingSubject) {
      const subjectRef = doc(firestore, 'predmety', editingSubject.id);
      updateDocumentNonBlocking(subjectRef, formData);
      toast({
        title: 'Předmět uložen',
        description: `Předmět ${formData.name} byl úspěšně uložen.`,
      });
    } else {
      addDocumentNonBlocking(collection(firestore, 'predmety'), formData);
      toast({
        title: 'Předmět přidán',
        description: `Předmět ${formData.name} byl úspěšně přidán.`,
      });
    }
    setIsDialogOpen(false);
    setEditingSubject(null);
  };

  const handleDeleteSubject = () => {
    if (!firestore || !deletingSubject) return;
    deleteDocumentNonBlocking(doc(firestore, 'predmety', deletingSubject.id));
    toast({
      title: 'Předmět smazán',
      description: 'Předmět byl úspěšně odstraněn.',
    });
    setDeletingSubject(null);
  };

  const openDialog = (subject: Subject | null) => {
    setEditingSubject(subject);
    setIsDialogOpen(true);
  };

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) setEditingSubject(null);
      }}>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Seznam předmětů</CardTitle>
              <CardDescription>
                Celkem {subjects?.length ?? 0} předmětů v databázi.
              </CardDescription>
            </div>
            <Button onClick={() => openDialog(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Přidat předmět
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Název předmětu</TableHead>
                  <TableHead>Zkratka</TableHead>
                  <TableHead>Počet vyučujících</TableHead>
                  <TableHead>
                    <span className="sr-only">Akce</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectsLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Načítání dat...
                    </TableCell>
                  </TableRow>
                )}
                {!subjectsLoading && subjects?.map((subject) => (
                    <SubjectRow key={subject.id} subject={subject} onEdit={openDialog} onDelete={setDeletingSubject} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingSubject ? 'Upravit předmět' : 'Přidat nový předmět'}
            </DialogTitle>
          </DialogHeader>
           {isDialogOpen && (
            <SubjectForm
                subject={editingSubject}
                onSave={handleSaveSubject}
                closeDialog={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

        {deletingSubject && (
            <AlertDialog open={!!deletingSubject} onOpenChange={() => setDeletingSubject(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                    Opravdu chcete smazat předmět?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                    Tato akce je nevratná a trvale smaže předmět "{deletingSubject?.name}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                    <AlertDialogAction
                    onClick={handleDeleteSubject}
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

export default function PredmetyPage() {
  const { hasRole } = useAuth();
  const { user, isUserLoading } = useUser();
  
  const showLoading = isUserLoading;
  const showAccessDenied = !isUserLoading && (!user || !hasRole('administrator'));
  const showContent = !isUserLoading && user && hasRole('administrator');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Správa předmětů</h1>
        <p className="text-muted-foreground">
          Správa všech vyučovaných předmětů v systému.
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
        <AdminSubjectManagement />
      )}
    </div>
  );
}
