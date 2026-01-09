'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mockClasses = [
  { id: 'trida-1', name: '1.A', studentCount: 25, teacher: 'Matěj Mikolášek' },
  { id: 'trida-4', name: '4.C', studentCount: 22, teacher: 'Robert Bartošek' },
  { id: 'trida-2', name: '2.B', studentCount: 28, teacher: 'Jana Nováková' },
  { id: 'trida-3', name: '3.D', studentCount: 21, teacher: 'Petr Svoboda' },
];

export default function SpravaTridyPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Správa tříd</h1>
                <p className="text-muted-foreground">Správa všech tříd v systému.</p>
            </div>

             <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Seznam tříd</CardTitle>
                        <CardDescription>Celkem {mockClasses.length} tříd v databázi.</CardDescription>
                    </div>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Přidat třídu
                    </Button>
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
                            {mockClasses.map(cls => (
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
                                                <DropdownMenuItem>Zobrazit žáky</DropdownMenuItem>
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
