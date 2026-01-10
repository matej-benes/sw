import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, PlusCircle, Search, Download, UserCheck, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const applications = [
    { id: "app1", childName: "Jiří Novotný", parentName: "Petr Novotný", date: "2024-04-15", status: "Podáno" },
    { id: "app2", childName: "Alena Procházková", parentName: "Jana Procházková", date: "2024-04-16", status: "Přijato" },
    { id: "app3", childName: "Tomáš Marek", parentName: "Martin Marek", date: "2024-04-18", status: "Odklad" },
    { id: "app4", childName: "Klára Jelínková", parentName: "Veronika Jelínková", date: "2024-04-20", status: "Podáno" },
];

export default function ZapisyPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Zápisy do 1. ročníku ZŠ</h1>
                <p className="text-muted-foreground">Komplexní agenda pro přijímání dětí do prvních tříd.</p>
            </div>

            <Tabs defaultValue="applications">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="applications">Seznam přihlášek</TabsTrigger>
                    <TabsTrigger value="details">Detail dítěte a rozhodnutí</TabsTrigger>
                </TabsList>
                <TabsContent value="applications">
                    <Card>
                        <CardHeader>
                            <CardTitle>Přehled podaných přihlášek</CardTitle>
                            <CardDescription>Spravujte přihlášky, komunikujte s rodiči a tiskněte potřebné dokumenty.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex flex-wrap items-center gap-4 mb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Hledat v přihláškách..." className="pl-8" />
                                </div>
                                <Button variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportovat data
                                </Button>
                            </div>
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Jméno dítěte</TableHead>
                                            <TableHead>Zákonný zástupce</TableHead>
                                            <TableHead>Datum podání</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {applications.map((app) => (
                                            <TableRow key={app.id} className="cursor-pointer hover:bg-muted/50">
                                                <TableCell className="font-medium">{app.childName}</TableCell>
                                                <TableCell>{app.parentName}</TableCell>
                                                <TableCell>{app.date}</TableCell>
                                                <TableCell>
                                                     <Badge variant={
                                                        app.status === "Přijato" ? "default" :
                                                        app.status === "Odklad" ? "secondary" : "outline"
                                                     } className={app.status === "Přijato" ? "bg-green-500" : ""}>
                                                        {app.status === 'Přijato' && <CheckCircle className="h-3 w-3 mr-1" />}
                                                        {app.status === 'Odklad' && <Clock className="h-3 w-3 mr-1" />}
                                                        {app.status === 'Podáno' && <FileText className="h-3 w-3 mr-1" />}
                                                        {app.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="details">
                     <Card>
                        <CardHeader>
                            <CardTitle>Detail žádosti: Jiří Novotný</CardTitle>
                            <CardDescription>Komplexní evidence údajů o dítěti a správa rozhodnutí.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="font-semibold">Údaje o dítěti</h4>
                                    <p className="text-sm"><strong className="text-muted-foreground">Jméno:</strong> Jiří Novotný</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Datum narození:</strong> 15. 6. 2018</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Bydliště:</strong> Uliční 123, Město</p>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="font-semibold">Údaje o zákonném zástupci</h4>
                                    <p className="text-sm"><strong className="text-muted-foreground">Jméno:</strong> Petr Novotný</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Email:</strong> petr.novotny@email.cz</p>
                                    <p className="text-sm"><strong className="text-muted-foreground">Telefon:</strong> +420 123 456 789</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="font-semibold mb-4">Správa rozhodnutí</h4>
                                <div className="flex flex-wrap gap-4">
                                     <Button>
                                        <CheckCircle className="mr-2 h-4 w-4"/>
                                        Vytvořit rozhodnutí o přijetí
                                    </Button>
                                     <Button variant="secondary">
                                        <Clock className="mr-2 h-4 w-4"/>
                                        Vytvořit rozhodnutí o odkladu
                                    </Button>
                                    <Button variant="destructive">
                                        <AlertCircle className="mr-2 h-4 w-4"/>
                                        Vytvořit rozhodnutí o nepřijetí
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter className="flex justify-end">
                            <Button>
                                <UserCheck className="mr-2 h-4 w-4"/>
                                Převést přijaté dítě do školní matriky
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
