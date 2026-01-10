'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function RozvrhySuplovaniPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Rozvrhy a suplování</h1>
                <p className="text-muted-foreground">Správa rozvrhů a plánování suplování.</p>
            </div>
            <Tabs defaultValue="rozvrhy">
                <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="rozvrhy">Správa rozvrhů</TabsTrigger>
                        <TabsTrigger value="suplovani">Plánování suplování</TabsTrigger>
                        <TabsTrigger value="nahled">Náhled</TabsTrigger>
                    </TabsList>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Přidat novou akci
                    </Button>
                </div>
                <TabsContent value="rozvrhy">
                    <Card>
                        <CardHeader>
                            <CardTitle>Správa rozvrhů</CardTitle>
                            <CardDescription>Zde můžete upravovat a vytvářet rozvrhy pro jednotlivé třídy.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Obsah pro správu rozvrhů...</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="suplovani">
                    <Card>
                        <CardHeader>
                            <CardTitle>Plánování suplování</CardTitle>
                            <CardDescription>Zde můžete zadávat a spravovat suplování za chybějící učitele.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Obsah pro plánování suplování...</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="nahled">
                    <Card>
                        <CardHeader>
                            <CardTitle>Náhled</CardTitle>
                            <CardDescription>Zobrazení aktuálního stavu rozvrhů a suplování.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Obsah pro náhled...</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
