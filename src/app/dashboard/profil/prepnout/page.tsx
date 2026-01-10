'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SwitchProfilePage() {
    const router = useRouter();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Přepnout účet</h1>
                    <p className="text-muted-foreground">Vyberte účet, na který se chcete přihlásit.</p>
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Funkce se připravuje</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Možnost přepínání mezi účty bude dostupná brzy.</p>
                </CardContent>
            </Card>
        </div>
    )
}
