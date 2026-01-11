'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function TrialExpiredOverlay() {
    const { activeOrganization } = useAuth();
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl">Zkušební doba vypršela</CardTitle>
                    <CardDescription>
                        Vaše zkušební období pro organizaci "{activeOrganization?.name}" skončilo.
                        Pro další používání si prosím aktivujte plnou verzi.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button asChild className="w-full">
                        <a href="mailto:matej.romana@seznam.cz">
                            <Mail className="mr-2 h-4 w-4" />
                            Kontaktovat podporu pro aktivaci
                        </a>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
