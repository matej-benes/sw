import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NapovedaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <FileQuestion className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nápověda a příručka</h1>
          <p className="text-muted-foreground">
            Vše, co potřebujete vědět o používání aplikace ŠkolaWeb.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Často kladené dotazy a návody</CardTitle>
          <CardDescription>
            Procházejte jednotlivé sekce a seznamte se s klíčovými funkcemi aplikace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Kalendář a Rozvrh</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p>
                    Hlavní stránka (Nástěnka) zobrazuje váš osobní kalendář a denní rozvrh. Zde na první pohled uvidíte všechny naplánované hodiny, události a případné změny (suplování).
                  </p>
                  <h4 className="font-semibold">Zobrazení rozvrhu:</h4>
                  <ul className="list-disc pl-5">
                    <li><strong>Navigace:</strong> Pomocí šipek můžete listovat mezi jednotlivými týdny. Tlačítkem s ikonou kalendáře se vrátíte na aktuální týden.</li>
                    <li><strong>Detail hodiny:</strong> Kliknutím na konkrétní hodinu v rozvrhu zobrazíte její detail, včetně probíraného učiva (pokud bylo zadáno).</li>
                    <li><strong>Suplování:</strong> Změny v rozvrhu jsou barevně odlišeny. Růžová hodina značí suplování, šedá hodina pod ní je ta původní, která byla nahrazena. Zrušené hodiny jsou označeny ikonou a textem "Odpadá".</li>
                  </ul>
                  <h4 className="font-semibold">Pro učitele a administrátory:</h4>
                  <ul className="list-disc pl-5">
                    <li><strong>Zadání suplování:</strong> Klikněte pravým tlačítkem myši (nebo dlouze podržte na mobilu) na hodinu, kterou chcete změnit. Z menu vyberte "Zadat suplování". Můžete hodinu zrušit, nebo přiřadit jiného učitele/předmět.</li>
                    <li><strong>Úprava a zrušení:</strong> U již suplované hodiny se v menu objeví možnosti "Upravit suplování" a "Zrušit suplování".</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>Komunikace</AccordionTrigger>
              <AccordionContent>
                <p>
                  Modul Komunikace slouží k bezpečnému posílání a přijímání zpráv mezi uživateli systému (učiteli, žáky a rodiči). Notifikace na nepřečtené zprávy se zobrazí v postranním menu i v názvu stránky.
                </p>
                 <h4 className="font-semibold mt-2">Poslání zprávy:</h4>
                  <ul className="list-disc pl-5">
                    <li>V záložce "Nová zpráva" klikněte na "Vybrat příjemce".</li>
                    <li>Můžete vybrat jednotlivé uživatele nebo celé třídy (pokud jste učitel).</li>
                    <li>Napište text zprávy a odešlete.</li>
                  </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Klasifikace a Hodnocení</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <h4 className="font-semibold">Pro žáky a rodiče:</h4>
                  <p>V sekci "Klasifikace" naleznete přehled všech známek seřazených podle předmětů. U každého předmětu je zobrazen vážený průměr. Kliknutím na známku zobrazíte její detail, včetně váhy a případného komentáře učitele.</p>
                  <h4 className="font-semibold">Pro učitele:</h4>
                  <p>Zadávání známek je navrženo tak, aby bylo rychlé a efektivní. Známky se zadávají přímo z rozvrhu:</p>
                   <ul className="list-disc pl-5">
                    <li>V kalendáři klikněte pravým tlačítkem na hodinu, za kterou chcete udělit hodnocení.</li>
                    <li>Z menu vyberte "Nové hodnocení".</li>
                    <li>Otevře se dialog, kde vyberete žáka/y, zadáte známku, váhu a případný komentář. Předmět a třída jsou již předvyplněny.</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

             <AccordionItem value="item-4">
              <AccordionTrigger>Docházka, Absence a Omluvenky</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                   <h4 className="font-semibold">Zápis do třídní knihy (pro učitele):</h4>
                   <p>V rozvrhu klikněte pravým tlačítkem na hodinu a vyberte "Zapsat do třídní knihy". Zde můžete zapsat probrané učivo a evidovat docházku jednotlivých žáků.</p>
                   <h4 className="font-semibold">Omlouvání absence (pro rodiče a plnoleté žáky):</h4>
                   <p>V sekci "Omluvenky" můžete vytvořit novou žádost o omluvení absence. Vyberte rozsah dat a uveďte důvod. Žádost je poté odeslána třídnímu učiteli ke schválení.</p>
                   <h4 className="font-semibold">Správa omluvenek (pro třídní učitele):</h4>
                   <p>V sekci "Omluvenky" vidíte seznam žádostí od rodičů a žáků. Můžete je schválit nebo zamítnout. Při schvalování vidíte i rozvrh studenta na dané dny.</p>
                   <h4 className="font-semibold">Přehled absence (pro všechny):</h4>
                   <p>V sekci "Absence" naleznete kompletní přehled zameškaných hodin, včetně jejich statusu (omluvená, neomluvená atd.).</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>Správa systému (pro administrátory)</AccordionTrigger>
              <AccordionContent>
                <p>
                  Sekce "Správa systému" je centrálním místem pro konfiguraci celé aplikace. Administrátoři zde mohou spravovat:
                </p>
                <ul className="list-disc pl-5 mt-2">
                  <li><strong>Evidence osob:</strong> Vytváření, úprava a mazání uživatelských účtů (učitelů, žáků, rodičů) a přiřazování rolí.</li>
                  <li><strong>Třídy:</strong> Zakládání nových tříd, přiřazování třídních učitelů a jejich zástupců.</li>
                  <li><strong>Předměty a Učebny:</strong> Správa číselníků všech vyučovaných předmětů a dostupných učeben.</li>
                   <li><strong>Přijímací řízení:</strong> Správa podaných přihlášek a převod přijatých uchazečů do evidence žáků.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
