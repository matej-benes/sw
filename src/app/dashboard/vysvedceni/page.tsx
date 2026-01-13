'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookCopy, Printer } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function VysvedceniPage() {
    const { user, hasRole } = useAuth();
    
    const studentName = hasRole('ziak') ? user?.name : 'vašeho dítěte';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <BookCopy className="h-8 w-8" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vysvědčení</h1>
                    <p className="text-muted-foreground">Přehled a tisk vysvědčení.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Vysvědčení pro {studentName}</CardTitle>
                    <CardDescription>Školní rok 2023/2024</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 border rounded-lg">
                            <div>
                                <p className="font-semibold">Vysvědčení za 2. pololetí</p>
                                <p className="text-sm text-muted-foreground">Datum vydání: 28. 6. 2024</p>
                            </div>
                            <Button variant="outline" onClick={() => window.print()}>
                                <Printer className="mr-2 h-4 w-4" />
                                Zobrazit a tisknout
                            </Button>
                        </div>
                        <div className="flex justify-between items-center p-4 border rounded-lg">
                             <div>
                                <p className="font-semibold">Vysvědčení za 1. pololetí</p>
                                <p className="text-sm text-muted-foreground">Datum vydání: 31. 1. 2024</p>
                            </div>
                            <Button variant="outline" onClick={() => window.print()}>
                                <Printer className="mr-2 h-4 w-4" />
                                Zobrazit a tisknout
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
