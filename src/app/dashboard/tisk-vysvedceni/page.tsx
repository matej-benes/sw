import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, CheckCircle, AlertTriangle, Calculator, FileEdit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const students = [
    { id: "s1", name: "Adam Volný", avgGrade: "1.45", attendance: 98, status: "V pořádku" },
    { id: "s2", name: "Eva Svobodová", avgGrade: "1.15", attendance: 100, status: "V pořádku" },
    { id: "s3", name: "Pavel Černý", avgGrade: "2.80", attendance: 85, status: "Hranice docházky" },
    { id: "s4", name: "Lucie Dvořáková", avgGrade: "1.95", attendance: 95, status: "V pořádku" },
];

const printForms = ["SEVT", "OFTIS", "OPTYS", "Bianco blankety"];

export default function TiskVysvedceniPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Tisk vysvědčení</h1>
                <p className="text-muted-foreground">Kompletní agenda pro uzavírání hodnocení a tisk vysvědčení.</p>
            </div>

            <Card>
                <CardHeader className="flex-row items-start justify-between">
                    <div>
                        <CardTitle>Uzávěrky a tisk</CardTitle>
                        <CardDescription>Vyberte třídu a pololetí pro zahájení procesu uzávěrek.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                         <Select defaultValue="1a">
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Vyberte třídu" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1a">1.A</SelectItem>
                                <SelectItem value="2b">2.B</SelectItem>
                                <SelectItem value="4c">4.C</SelectItem>
                            </SelectContent>
                        </Select>
                         <Select defaultValue="2pololeti">
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Vyberte pololetí" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1pololeti">1. pololetí</SelectItem>
                                <SelectItem value="2pololeti">2. pololetí</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Stav uzávěrky třídy 4.C</label>
                        <div className="flex items-center gap-4">
                            <Progress value={75} className="w-full" />
                            <span className="text-sm font-semibold">75%</span>
                        </div>
                         <p className="text-xs text-muted-foreground">3 ze 4 žáků mají kompletní hodnocení.</p>
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"><Checkbox /></TableHead>
                                    <TableHead>Jméno žáka</TableHead>
                                    <TableHead><Calculator className="h-4 w-4 inline mr-1"/>Vážený průměr</TableHead>
                                    <TableHead>Docházka</TableHead>
                                    <TableHead>Stav</TableHead>
                                    <TableHead className="text-right">Akce</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.id}>
                                        <TableCell><Checkbox /></TableCell>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell className="font-semibold">{student.avgGrade}</TableCell>
                                        <TableCell>{student.attendance}%</TableCell>
                                        <TableCell>
                                            <Badge variant={student.status === "V pořádku" ? "default" : "destructive"} className={student.status === "V pořádku" ? "bg-green-500" : ""}>
                                                {student.status === "V pořádku" ? <CheckCircle className="mr-1 h-3 w-3"/> : <AlertTriangle className="mr-1 h-3 w-3"/>}
                                                {student.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm">
                                                <FileEdit className="mr-2 h-4 w-4" />
                                                Slovní hodnocení
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-4">
                    <div>
                        <h3 className="font-semibold mb-2">Nastavení tisku</h3>
                         <div className="flex items-center gap-4">
                            <Select defaultValue="SEVT">
                                <SelectTrigger className="w-[240px]">
                                    <SelectValue placeholder="Formulář pro tisk" />
                                </SelectTrigger>
                                <SelectContent>
                                    {printForms.map(form => <SelectItem key={form} value={form}>{form}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="bianco" />
                                <label htmlFor="bianco" className="text-sm font-medium">Tisknout na bianco blankety</label>
                            </div>
                        </div>
                    </div>
                     <Button>
                        <Printer className="mr-2 h-4 w-4" />
                        Tisknout vybraná vysvědčení ({students.length})
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
