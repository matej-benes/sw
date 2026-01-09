import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Link as LinkIcon } from "lucide-react";

const materials = [
    { title: "Prezentace: Algebra", type: "file", link: "#" },
    { title: "Video: Shakespearovské drama", type: "link", link: "#" },
    { title: "Pracovní list: Fotosyntéza", type: "file", link: "#" },
    { title: "Online cvičení: Nepravidelná slovesa", type: "link", link: "#" },
];

export default function MaterialyPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Studijní materiály</h1>
                <p className="text-muted-foreground">Zde naleznete materiály k výuce.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dostupné materiály</CardTitle>
                    <CardDescription>Materiály nahrané vašimi učiteli.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {materials.map((material, index) => (
                            <li key={index} className="flex items-center justify-between rounded-lg border p-3">
                                <div className="flex items-center gap-3">
                                    {material.type === 'file' ? <FileText className="h-5 w-5 text-primary"/> : <LinkIcon className="h-5 w-5 text-accent"/>}
                                    <span className="font-medium">{material.title}</span>
                                </div>
                                <a href={material.link} className="text-sm text-primary hover:underline">Zobrazit</a>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
