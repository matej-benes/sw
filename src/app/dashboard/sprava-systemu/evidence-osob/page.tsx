'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockUsers } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const roleTranslations: { [key: string]: string } = {
    ucitel: 'Učitel',
    rodic: 'Rodič',
    ziak: 'Žák',
    administrator: 'Administrátor',
    'vedouci pracovnik': 'Vedoucí pracovník',
};

export default function EvidenceOsobPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Evidence osob</h1>
                <p className="text-muted-foreground">Správa všech uživatelů v systému.</p>
            </div>

             <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Seznam uživatelů</CardTitle>
                        <CardDescription>Celkem {mockUsers.length} uživatelů v databázi.</CardDescription>
                    </div>
                    <Button>
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
                            {mockUsers.map(user => (
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
                                                <DropdownMenuItem>Upravit</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Smazat</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                   </Table>
                </CardContent>
            </Card>
        </div>
    );
}