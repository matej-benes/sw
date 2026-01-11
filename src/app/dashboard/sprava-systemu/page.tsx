'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, Book, Home } from "lucide-react";
import { useRouter } from "next/navigation";

const managementCards = [
    { title: "Evidence osob", icon: Users, href: "/dashboard/sprava-systemu/evidence-osob", description: "Správa uživatelských účtů a rolí." },
    { title: "Třídy", icon: School, href: "/dashboard/sprava-systemu/tridy", description: "Vytváření a správa školních tříd." },
    { title: "Předměty", icon: Book, href: "/dashboard/sprava-systemu/predmety", description: "Definice a správa vyučovaných předmětů." },
    { title: "Učebny", icon: Home, href: "/dashboard/sprava-systemu/ucebny", description: "Správa učeben a jejich vybavení." },
]

export default function SpravaSystemuPage() {
  const router = useRouter();

  return (
    <div className="flex-1 space-y-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Správa systému</h1>
            <p className="text-muted-foreground">Centrální místo pro konfiguraci a správu aplikace ŠkolaWeb.</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {managementCards.map(card => (
                <Card key={card.title} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(card.href)}>
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <card.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>{card.title}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{card.description}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
