'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Check, Zap, Users, School, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

export default function AboutPage() {
    const router = useRouter();

    const features = [
        { icon: Zap, title: "Moderní rozhraní", description: "Intuitivní a rychlé ovládání pro všechny uživatele." },
        { icon: Users, title: "Správa uživatelů", description: "Snadná evidence a správa rolí žáků, učitelů i rodičů." },
        { icon: School, title: "Multi-organizační podpora", description: "Spravujte více škol nebo zájmových skupin pod jedním systémem." },
        { icon: BookOpen, title: "Kompletní agenda", description: "Rozvrhy, klasifikace, docházka a komunikace na jednom místě." },
    ];

    const pricingTiers = [
        {
            name: "Zkušební verze",
            price: "Zdarma",
            period: "/ 30 dní",
            description: "Vyzkoušejte si všechny funkce bez závazků.",
            features: ["Plná funkčnost", "Podpora pro 1 organizaci", "Limit 50 uživatelů"],
            buttonText: "Začít zdarma",
            variant: "outline"
        },
        {
            name: "Základní balíček",
            price: "Kontaktujte nás",
            period: "",
            description: "Ideální pro menší školy a zájmové skupiny.",
            features: ["Vše ze zkušební verze", "Neomezený počet uživatelů", "Prioritní podpora"],
            buttonText: "Kontaktovat",
            variant: "default"
        },
        {
            name: "Profi balíček",
            price: "Kontaktujte nás",
            period: "",
            description: "Pro velké organizace s potřebou individuálních úprav.",
            features: ["Vše ze základního balíčku", "Individuální úpravy na míru", "API přístup"],
            buttonText: "Kontaktovat",
             variant: "outline"
        },
    ];

    return (
        <div className="bg-background text-foreground">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between bg-background/80 px-6 backdrop-blur-sm">
                 <div className="flex items-center gap-2 font-semibold text-primary">
                    <Logo className="h-8 w-8" />
                    <span className="text-lg font-bold uppercase tracking-wider text-foreground">Škola Online</span>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.push('/login')}>Přihlásit se</Button>
                    <Button onClick={() => router.push('/login')}>Registrovat se</Button>
                </div>
            </header>

            <main className="pt-16">
                {/* Hero Section */}
                <section className="py-20 text-center">
                    <div className="container mx-auto px-6">
                        <h1 className="text-5xl font-bold tracking-tight text-primary">Vítejte ve Škole Online</h1>
                        <p className="mt-4 text-xl text-muted-foreground">Moderní, rychlý a intuitivní informační systém pro vaši školu nebo organizaci.</p>
                        <div className="mt-8 flex justify-center gap-4">
                            <Button size="lg" onClick={() => router.push('/login')}>Vyzkoušet zdarma</Button>
                            <Button size="lg" variant="outline">Více informací</Button>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="bg-muted/40 py-20">
                    <div className="container mx-auto px-6">
                        <div className="text-center mb-12">
                             <h2 className="text-4xl font-bold">Klíčové funkce systému</h2>
                             <p className="mt-2 text-lg text-muted-foreground">Vše, co potřebujete pro efektivní řízení.</p>
                        </div>
                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                            {features.map((feature, index) => (
                                <Card key={index} className="text-center">
                                    <CardHeader>
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                                            <feature.icon className="h-8 w-8 text-primary" />
                                        </div>
                                        <CardTitle>{feature.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground">{feature.description}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="py-20">
                    <div className="container mx-auto px-6">
                        <div className="text-center mb-12">
                             <h2 className="text-4xl font-bold">Jednoduchý a transparentní ceník</h2>
                             <p className="mt-2 text-lg text-muted-foreground">Vyberte si plán, který nejlépe vyhovuje vašim potřebám.</p>
                        </div>
                        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
                            {pricingTiers.map((tier) => (
                                <Card key={tier.name} className={tier.variant === 'default' ? 'border-primary ring-2 ring-primary' : ''}>
                                    <CardHeader>
                                        <CardTitle className="text-2xl">{tier.name}</CardTitle>
                                        <CardDescription>{tier.description}</CardDescription>
                                        <div className="pt-4">
                                            <span className="text-4xl font-bold">{tier.price}</span>
                                            <span className="text-muted-foreground">{tier.period}</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-3">
                                            {tier.features.map((feature, index) => (
                                                <li key={index} className="flex items-center gap-2">
                                                    <Check className="h-5 w-5 text-green-500" />
                                                    <span className="text-muted-foreground">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full" variant={tier.variant as any}>{tier.buttonText}</Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t bg-muted/40 py-8">
                <div className="container mx-auto px-6 text-center text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} Škola Online. Všechna práva vyhrazena.</p>
                </div>
            </footer>
        </div>
    );
}
