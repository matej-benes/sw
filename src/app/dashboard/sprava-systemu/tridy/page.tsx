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

type Class = {
  id: string;
  name: string;
  studentCount: number;
  teacher: string;
};

const initialClasses: Class[] = [
  { id: 'trida-1', name: '1.A', studentCount: 25, teacher: 'Matěj Mikolášek' },
  { id: 'trida-4', name: '4.C', studentCount: 22, teacher: 'Robert Bartošek' },
  { id: 'trida-2', name: '2.B', studentCount: 28, teacher: 'Jana Nováková' },
  { id: 'trida-3', name: '3.D', studentCount: 21, teacher: 'Petr Svoboda' },
];

const classSchema = z.object({
    name: z.string().min(1, "Název je povinný"),
    teacher: z.string().min(1, "Jméno učitele je povinné"),
    studentCount: z.coerce.number().min(0, "Počet musí být nezáporný"),
});

type ClassFormData = z.infer<typeof classSchema>;

function ClassForm({ classData, onSave, closeDialog }: { classData?: Class | null, onSave: (data: Class) => void, closeDialog: () => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<ClassFormData>({
        resolver: zodResolver(classSchema),
        defaultValues: {
            name: classData?.name || "",
            teacher: classData?.teacher || "",
            studentCount: classData?.studentCount || 0,
        },
    });
    const { toast } = useToast();

    const onSubmit = (data: ClassFormData) => {
        const newClass: Class = {
            id: classData?.id || `trida-${Date.now()}`,
            ...data,
        };
        onSave(newClass);
        toast({ title: "Třída uložena", description: `Třída ${newClass.name} byla úspěšně uložena.` });
        closeDialog();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="space-y-1">
                <Label htmlFor="name">Název třídy</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
                <Label htmlFor="teacher">Třídní učitel</Label>
                <Input id="teacher" {...register("teacher")} />
                {errors.teacher && <p className="text-sm text-destructive">{errors.teacher.message}</p>}
            </div>
            <div className="space-y-1">
                <Label htmlFor="studentCount">Počet žáků</Label>
                <Input id="studentCount" type="number" {...register("studentCount")} />
                {errors.studentCount && <p className="text-sm text-destructive">{errors.studentCount.message}</p>}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
                <Button type="submit">Uložit</Button>
            </DialogFooter>
        </form>
    );
}

export default function SpravaTridyPage() {
    const [classes, setClasses] = useState<Class[]>(initialClasses);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const { toast } = useToast();

    const handleSaveClass = (classData: Class) => {
        if (classes.some(c => c.id === classData.id)) {
            setClasses(classes.map(c => c.id === classData.id ? classData : c));
        } else {
            setClasses([classData, ...classes]);
        }
    };

    const handleDeleteClass = (classId: string) => {
        setClasses(classes.filter(c => c.id !== classId));
        toast({ title: "Třída smazána", description: "Třída byla úspěšně odstraněna." });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Správa tříd</h1>
                <p className="text-muted-foreground">Správa všech tříd v systému.</p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Seznam tříd</CardTitle>
                            <CardDescription>Celkem {classes.length} tříd v databázi.</CardDescription>
                        </div>
                         <DialogTrigger asChild>
                            <Button onClick={() => setEditingClass(null)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Přidat třídu
                            </Button>
                        </DialogTrigger>
                    </CardHeader>
                    <CardContent>
                    <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Název třídy</TableHead>
                                    <TableHead>Třídní učitel</TableHead>
                                    <TableHead>Počet žáků</TableHead>
                                    <TableHead><span className="sr-only">Akce</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classes.map(cls => (
                                    <TableRow key={cls.id}>
                                        <TableCell className="font-medium">{cls.name}</TableCell>
                                        <TableCell>{cls.teacher}</TableCell>
                                        <TableCell>{cls.studentCount}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => { setEditingClass(cls); setIsDialogOpen(true); }}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Upravit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>Zobrazit žáky</DropdownMenuItem>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                          <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                                              <Trash2 className="mr-2 h-4 w-4" />
                                                              Smazat
                                                          </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Opravdu chcete smazat třídu?</AlertDialogTitle>
                                                                <AlertDialogDescription>Tato akce je nevratná a trvale smaže třídu "{cls.name}".</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteClass(cls.id)} className="bg-destructive hover:bg-destructive/90">Smazat</AlertDialogAction>
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
                        <DialogTitle>{editingClass ? 'Upravit třídu' : 'Přidat novou třídu'}</DialogTitle>
                    </DialogHeader>
                    <ClassForm classData={editingClass} onSave={handleSaveClass} closeDialog={() => setIsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
