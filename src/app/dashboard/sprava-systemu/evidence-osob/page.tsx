'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockUsers as initialUsers } from "@/lib/mock-data";
import type { User, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";


const roleTranslations: { [key in Role]: string } = {
    ucitel: 'Učitel',
    rodic: 'Rodič',
    ziak: 'Žák',
    administrator: 'Administrátor',
    'vedouci pracovnik': 'Vedoucí pracovník',
};
const allRoles = Object.keys(roleTranslations) as Role[];

const userSchema = z.object({
    name: z.string().min(1, "Jméno je povinné"),
    email: z.string().email("Neplatný formát emailu"),
    roles: z.array(z.string()).min(1, "Uživatel musí mít alespoň jednu roli"),
});

type UserFormData = z.infer<typeof userSchema>;

function UserForm({ user, onSave, closeDialog }: { user?: User | null, onSave: (data: User) => void, closeDialog: () => void }) {
    const { register, handleSubmit, control, formState: { errors } } = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: user?.name || "",
            email: user?.email || "",
            roles: user?.roles || [],
        },
    });
    const { toast } = useToast();

    const onSubmit = (data: UserFormData) => {
        const newUser: User = {
            ...(user || { id: `user-${Date.now()}`, avatarUrl: 'https://picsum.photos/seed/new-user/100/100' }),
            ...data,
            roles: data.roles as Role[],
        };
        onSave(newUser);
        toast({ title: "Uživatel uložen", description: `Uživatel ${newUser.name} byl úspěšně uložen.` });
        closeDialog();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
             <div className="space-y-1">
                <Label htmlFor="name">Jméno</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
             <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" {...register("email")} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
             <div className="space-y-2">
                <Label>Role</Label>
                <Controller
                    name="roles"
                    control={control}
                    render={({ field }) => (
                        <div className="grid grid-cols-2 gap-2">
                            {allRoles.map(role => (
                                <div key={role} className="flex items-center gap-2">
                                     <Checkbox 
                                        id={role}
                                        checked={field.value.includes(role)}
                                        onCheckedChange={(checked) => {
                                            const newValue = checked
                                                ? [...field.value, role]
                                                : field.value.filter(r => r !== role);
                                            field.onChange(newValue);
                                        }}
                                    />
                                    <Label htmlFor={role} className="font-normal">{roleTranslations[role]}</Label>
                                </div>
                            ))}
                        </div>
                    )}
                />
                 {errors.roles && <p className="text-sm text-destructive">{errors.roles.message}</p>}
            </div>

            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
                <Button type="submit">Uložit</Button>
            </DialogFooter>
        </form>
    );
}

export default function EvidenceOsobPage() {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { toast } = useToast();

    const handleSaveUser = (user: User) => {
        setUsers(prevUsers => {
            if (prevUsers.some(u => u.id === user.id)) {
                return prevUsers.map(u => u.id === user.id ? user : u);
            } else {
                return [user, ...prevUsers];
            }
        });
    };

    const handleDeleteUser = (userId: string) => {
        setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
        toast({ title: "Uživatel smazán", description: "Uživatel byl úspěšně odstraněn ze systému." });
    };
    
    const openDialog = (user: User | null) => {
        setEditingUser(user);
        setIsDialogOpen(true);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Evidence osob</h1>
                <p className="text-muted-foreground">Správa všech uživatelů v systému.</p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Seznam uživatelů</CardTitle>
                            <CardDescription>Celkem {users.length} uživatelů v databázi.</CardDescription>
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
                                    <TableHead><span className="sr-only">Akce</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles.map(role => (
                                                    <Badge key={role} variant="secondary">
                                                        {roleTranslations[role] || role}
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
                                                    <DropdownMenuItem onSelect={() => openDialog(user)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Upravit
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Smazat
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Opravdu chcete smazat uživatele?</AlertDialogTitle>
                                                                <AlertDialogDescription>Tato akce je nevratná a trvale smaže uživatele "{user.name}".</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">Smazat</AlertDialogAction>
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
                        <DialogTitle>{editingUser ? "Upravit uživatele" : "Přidat nového uživatele"}</DialogTitle>
                    </DialogHeader>
                    <UserForm user={editingUser} onSave={handleSaveUser} closeDialog={() => setIsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}