'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function RozvrhySuplovaniPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Rozvrhy a suplování</h1>
                <p className="text-muted-foreground">Správa rozvrhů a zadávání suplování pro jednotlivé třídy.</p>
            </div>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Správa rozvrhů</CardTitle>
                        <CardDescription>Vytvářejte a upravujte týdenní rozvrhy pro třídy.</CardDescription>
                    </div>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Vytvořit nový rozvrh
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                        <p>Zatím nebyly vytvořeny žádné rozvrhy.</p>
                        <p className="text-sm">Klikněte na tlačítko pro vytvoření nového rozvrhu.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}