
# Master Prompt pro Vytvoření Aplikace ŠkolaWeb

## 1. Základní Koncept

Cílem je vytvořit komplexní školní informační systém (SIS) s názvem "ŠkolaWeb". Aplikace bude modulární, postavená na moderních webových technologiích a bude sloužit různým rolím v rámci vzdělávací instituce / školy 

---

## 2. Technologický Stack

- **Framework:** Next.js s App Routerem
- **Jazyk:** TypeScript
- **UI Komponenty:** shadcn/ui
- **Stylování:** Tailwind CSS
- **Backend a Databáze:** Firebase (Firestore pro databázi, Firebase Authentication pro správu uživatelů)
- **Generativní AI:** Genkit pro integraci s AI modely (např. pro generování textů)

---

## 3. Datové Modely a Struktura (backend.json)

Aplikace bude pracovat s následujícími datovými entitami, které budou uloženy ve Firestore. Jejich struktura bude definována v `docs/backend.json`.

- **Organization:** Organizace (škola, kroužek).
- **User:** Uživatel (administrátor, učitel, rodič, žák, superadmin). Definuje role a základní údaje.
- **Grading (nově `grades`):** Známka, hodnocení.
- **Trida:** Školní třída.
- **Predmet:** Vyučovací předmět.
- **Ucebna:** Místnost/učebna.
- **Rozvrh:** Denní rozvrh pro danou třídu.
- **ScheduleTemplate:** Šablona týdenního rozvrhu pro třídu.
- **PoznamkaZaka:** Poznámka k chování žáka (pochvala, napomenutí).
- **Udalost:** Školní událost, porada, exkurze.
- **Message:** Zpráva v rámci interní komunikace.
- **ZapisHodiny:** Zápis z vyučovací hodiny do třídní knihy.
- **Omluvenka:** Žádost o omluvení absence.
- **DomaciUkol:** Domácí úkol.
- **PrijimaciRizeni:** Přihláška ke studiu.
- **ZaznamSchuzky:** Záznam ze schůzky (pro zájmové skupiny).
- **Absence:** Záznam o absenci v konkrétní hodině.

---

## 4. Uživatelské Role a Oprávnění

Systém bude rozlišovat následující role s jasně definovanými oprávněními, která budou vynucena pomocí Bezpečnostních pravidel Firestore (`firestore.rules`):

- **Žák (zak):** Vidí svůj rozvrh, známky, absence, domácí úkoly, může komunikovat s učiteli.
- **Rodič (rodic):** Vidí totéž co jeho dítě (žák), může omlouvat absenci.
- **Učitel (ucitel):** Zadává známky, absence, poznámky, domácí úkoly pro třídy/předměty, které vyučuje. Komunikuje s žáky a rodiči.
- **Administrátor (administrator):** Spravuje uživatele, třídy, předměty, učebny a další systémové číselníky. Má přístup k většině dat.


---

## 5. Klíčové Moduly a Funkce

Aplikace bude obsahovat následující moduly dostupné z levého navigačního panelu:

1.  **Nástěnka / Kalendář (`/dashboard`):**
    - Hlavní stránka po přihlášení.
    - Zobrazuje denní/týdenní přehled rozvrhu, událostí a suplování.
    - Přizpůsobený pohled pro každou roli.

2.  **Komunikace (`/dashboard/zpravy`):**
    - Interní systém pro posílání a přijímání zpráv mezi uživateli.
    - Inbox, odeslané zprávy, psaní nové zprávy.
    - Notifikace na nepřečtené zprávy.

3.  **Klasifikace (`/dashboard/hodnoceni`):**
    - **Učitel:** Zadávání, úprava a mazání známek pro jednotlivé studenty nebo hromadně pro celou třídu. Přehled zadaných známek.
    - **Žák/Rodič:** Zobrazení přehledu známek podle předmětů, včetně průměrů a detailu každé známky.

4.  **Docházka:**
    - **Třídní kniha (`/dashboard/tridni-kniha`):** Učitel zde zadává probrané učivo a docházku pro každou hodinu.
    - **Absence (`/dashboard/absence`):** Žák/rodič vidí přehled svých absencí. Učitel/admin vidí absence pro své třídy.
    - **Omluvenky (`/dashboard/omluvenky`):** Rodič/plnoletý žák zadává žádost o omluvení. Třídní učitel žádosti schvaluje nebo zamítá.

5.  **Domácí úkoly (`/dashboard/ukoly`):**
    - Učitel zadává úkoly pro třídu/předmět.
    - Žák/rodič vidí přehled aktuálních úkolů.

6.  **Chování (`/dashboard/chovani`):**
    - Učitel zadává poznámky a pochvaly.
    - Žák/rodič vidí přehled udělených poznámek/pochval.

7.  **Vysvědčení:**
    - **Náhled (`/dashboard/vysvedceni`):** Žák/rodič vidí náhled konečných známek na vysvědčení.
    - **Tisk (`/dashboard/tisk-vysvedceni`):** Učitel provádí uzávěrku známek a tiskne vysvědčení pro svou třídu.

8.  **Správa Systému (`/dashboard/sprava-systemu`):** (Pouze pro administrátory)
    - **Evidence osob:** Správa všech uživatelů a jejich rolí.
    - **Třídy:** Zakládání a úprava tříd, přiřazování třídních učitelů.
    - **Předměty:** Správa seznamu vyučovaných předmětů.
    - **Učebny:** Správa seznamu učeben.

9.  **Rozvrhy a Suplování (`/dashboard/rozvrhy-suplovani`):** (Pouze pro administrátory/učitele)
    - Tvorba a úprava šablon rozvrhů.
    - Generování denních rozvrhů z šablon.
    - Evidence absencí učitelů a plánování suplování.

10. **Přijímací řízení (`/dashboard/prijimaci-rizeni`):**
    - Veřejný formulář pro podání přihlášky (`/zapis`).
    - Administrátorský pohled pro správu přihlášek, rozhodování o přijetí a převod přijatých dětí do matriky (vytvoření uživatelských účtů).

11. **Uživatelský Profil (`/dashboard/profil`):**
    - Zobrazení informací o přihlášeném uživateli.
    - Možnost odhlásit se.

12. **Přihlášení a Registrace:**
    - **Přihlášení (`/`):** Standardní přihlášení e-mailem a heslem.
    - **Registrace (`/registrace`):** První přihlášení pomocí unikátního 6místného PINu, po kterém si uživatel nastaví své heslo.
