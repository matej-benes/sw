'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mockSubjects = [
  { id: 'subj-1', name: 'Matematika', shortcut: 'MAT', teacherCount: 3 },
  { id: 'subj-2', name: 'Český jazyk', shortcut: 'ČJ', teacherCount: 4 },
  { id: 'subj-3', name: 'Anglický jazyk', shortcut: 'AJ', teacherCount: 5 },
  { id: 'subj-4', name: 'Dějepis', shortcut: 'D', teacherCount: 2 },
  { id: 'subj-5', name: 'Fyzika', shortcut: 'FYZ', teacherCount: 2 },
  { id: 'subj-6', name: 'Chemie', shortcut: 'CHE', teacherCount: 1 },
];


export default function PredmetyPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Správa předmětů</h1>
                <p className="text-muted-foreground">Správa všech vyučovaných předmětů v systému.</p>
            </div>

             <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Seznam předmětů</CardTitle>
                        <CardDescription>Celkem {mockSubjects.length} předmětů v databázi.</CardDescription>
                    </div>
                    <Button>
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
                                <TableHead><span className="sr-only">Akce</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockSubjects.map(subject => (
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
