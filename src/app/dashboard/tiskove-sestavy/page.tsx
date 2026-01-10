import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, PlusCircle, Search, Edit, BarChart, ImageIcon, Code, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const reportTemplates = [
    { name: "Seznam žáků třídy", category: "Žáci", type: "Předpřipravená" },
    { name: "Přehled docházky - měsíční", category: "Docházka", type: "Předpřipravená" },
    { name: "Katalogový list žáka", category: "Žáci", type: "Vlastní" },
    { name: "Přihláška na SŠ", category: "Přihlášky", type: "Předpřipravená" },
    { name: "Záznam o úrazu", category: "Dokumentace", type: "Předpřipravená" },
    { name: "Inventura majetku", category: "Majetek", type: "Vlastní" },
    { name: "Statistika známek (graf)", category: "Hodnocení", type: "Vlastní" },
];

export default function TiskoveSestavyPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Tiskové sestavy</h1>
                <p className="text-muted-foreground">Správa, úpravy a tisk všech školních dokumentů a sestav.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dostupné sestavy</CardTitle>
                    <CardDescription>Procházejte, filtrujte a spravujte všechny tiskové šablony.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Hledat v sestavách..." className="pl-8" />
                        </div>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Vytvořit novou šablonu
                        </Button>
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Název sestavy</TableHead>
                                    <TableHead>Kategorie</TableHead>
                                    <TableHead>Typ</TableHead>
                                    <TableHead className="text-right">Akce</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportTemplates.map((template, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{template.category}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={template.type === "Vlastní" ? "secondary" : "default"}>
                                                {template.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="mr-2">
                                                <FileText className="mr-2 h-4 w-4" /> Tisk
                                            </Button>
                                            <Button variant="outline" size="sm">
                                                <Edit className="mr-2 h-4 w-4" /> Upravit
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle>Editor šablon</CardTitle>
                    <CardDescription>
                        Vytvářejte vlastní sestavy s pokročilými prvky. Přidejte text, tabulky, grafy, obrázky nebo čárové kódy.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center bg-background min-h-[200px]">
                        <p className="text-muted-foreground mb-4">Zde bude vizuální editor šablon.</p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Button variant="outline" size="sm"><BarChart className="mr-2 h-4 w-4"/> Přidat graf</Button>
                            <Button variant="outline" size="sm"><ImageIcon className="mr-2 h-4 w-4"/> Přidat obrázek</Button>
                            <Button variant="outline" size="sm"><Code className="mr-2 h-4 w-4"/> Přidat čárový kód</Button>
                             <Button variant="outline" size="sm"><Settings className="mr-2 h-4 w-4"/> Pokročilá nastavení</Button>
                        </div>
                    </div>
                </CardContent>
                 <CardFooter>
                    <Button disabled>Uložit novou šablonu</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
