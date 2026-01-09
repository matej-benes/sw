'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

type Subject = {
    id: string;
    name: string;
    shortcut: string;
    teacherCount: number;
};

const initialSubjects: Subject[] = [
  { id: 'subj-1', name: 'Matematika', shortcut: 'MAT', teacherCount: 3 },
  { id: 'subj-2', name: 'Český jazyk', shortcut: 'ČJ', teacherCount: 4 },
  { id: 'subj-3', name: 'Anglický jazyk', shortcut: 'AJ', teacherCount: 5 },
  { id: 'subj-4', name: 'Dějepis', shortcut: 'D', teacherCount: 2 },
  { id: 'subj-5', name: 'Fyzika', shortcut: 'FYZ', teacherCount: 2 },
  { id: 'subj-6', name: 'Chemie', shortcut: 'CHE', teacherCount: 1 },
];

const subjectSchema = z.object({
    name: z.string().min(1, "Název je povinný"),
    shortcut: z.string().min(1, "Zkratka je povinná"),
    teacherCount: z.coerce.number().min(0, "Počet musí být nezáporný"),
});

type SubjectFormData = z.infer<typeof subjectSchema>;

function SubjectForm({ subject, onSave, closeDialog }: { subject?: Subject | null, onSave: (data: Subject) => void, closeDialog: () => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<SubjectFormData>({
        resolver: zodResolver(subjectSchema),
        defaultValues: {
            name: subject?.name || "",
            shortcut: subject?.shortcut || "",
            teacherCount: subject?.teacherCount || 0,
        },
    });
    const { toast } = useToast();

    const onSubmit = (data: SubjectFormData) => {
        const newSubject: Subject = {
            id: subject?.id || `subj-${Date.now()}`,
            ...data,
        };
        onSave(newSubject);
        toast({ title: "Předmět uložen", description: `Předmět ${newSubject.name} byl úspěšně uložen.` });
        closeDialog();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
             <div className="space-y-1">
                <Label htmlFor="name">Název předmětu</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
             <div className="space-y-1">
                <Label htmlFor="shortcut">Zkratka</Label>
                <Input id="shortcut" {...register("shortcut")} />
                {errors.shortcut && <p className="text-sm text-destructive">{errors.shortcut.message}</p>}
            </div>
             <div className="space-y-1">
                <Label htmlFor="teacherCount">Počet vyučujících</Label>
                <Input id="teacherCount" type="number" {...register("teacherCount")} />
                {errors.teacherCount && <p className="text-sm text-destructive">{errors.teacherCount.message}</p>}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
                <Button type="submit">Uložit</Button>
            </DialogFooter>
        </form>
    );
}

export default function PredmetyPage() {
    const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    const { toast } = useToast();

    const handleSaveSubject = (subject: Subject) => {
        if (subjects.some(s => s.id === subject.id)) {
            setSubjects(subjects.map(s => s.id === subject.id ? subject : s));
        } else {
            setSubjects([subject, ...subjects]);
        }
    };

    const handleDeleteSubject = (subjectId: string) => {
        setSubjects(subjects.filter(s => s.id !== subjectId));
        toast({ title: "Předmět smazán", description: "Předmět byl úspěšně odstraněn." });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Správa předmětů</h1>
                <p className="text-muted-foreground">Správa všech vyučovaných předmětů v systému.</p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Seznam předmětů</CardTitle>
                            <CardDescription>Celkem {subjects.length} předmětů v databázi.</CardDescription>
                        </div>
                        <DialogTrigger asChild>
                            <Button onClick={() => setEditingSubject(null)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Přidat předmět
                            </Button>
                        </DialogTrigger>
                    </CardHeader>
                    <CardContent>
                    <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Název předmětu</TableHead>
                                    <TableHead>Zkratka</TableHead>
                                    <TableHead>Počet vyučujících</TableHead>
                                    <TableHead><span className="sr-only">Akce</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subjects.map(subject => (
                                    <TableRow key={subject.id}>
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
                                                    <DropdownMenuItem onSelect={() => { setEditingSubject(subject); setIsDialogOpen(true); }}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Upravit
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Smazat
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Opravdu chcete smazat předmět?</AlertDialogTitle>
                                                                <AlertDialogDescription>Tato akce je nevratná a trvale smaže předmět "{subject.name}".</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteSubject(subject.id)} className="bg-destructive hover:bg-destructive/90">Smazat</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
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
                        <DialogTitle>{editingSubject ? "Upravit předmět" : "Přidat nový předmět"}</DialogTitle>
                    </DialogHeader>
                    <SubjectForm subject={editingSubject} onSave={handleSaveSubject} closeDialog={() => setIsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
