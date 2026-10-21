# Įpročių apskaita

Asmeninės veiklos stebėjimo sistema: įpročių žymėjimas, serijos, savaitės ataskaita, 14 dienų progresas, priminimai, eksportas ir atsarginės kopijos.

## Funkcijos

- Įpročių kūrimas, redagavimas ir šalinimas (pavadinimas, spalva, priminimo laikas).
- Šiandienos suvestinė ir dabartinės serijos skaičiavimas.
- Savaitės ataskaitos lentelė ir 14 dienų progreso diagrama.
- Priminimai, kai programa atidaryta naršyklėje.
- Šviesi ir tamsi tema.
- CSV eksportas ir atsarginės kopijos (JSON) kūrimas bei atkūrimas.
- Veikia be interneto po pirmo įkrovimo (servisinis darbuotojas `sw.js`).
- Prieinamumas: klaviatūros navigacija, ekrano skaitytuvų žymos, mažesnio judesio režimas.

## Paleidimas

Programa yra statinė. Nereikia serverio ar diegimo:

1. Atsisiųskite arba klonuokite repozitoriją.
2. Atidarykite `index.html` naršyklėje.

Arba paskelbkite per GitHub Pages: *Settings → Pages → Deploy from a branch → main / (root)*.

## Struktūra

```
index.html        Puslapio struktūra
css/styles.css    Stiliai (šviesi ir tamsi tema)
js/app.js         Logika ir duomenų saugojimas
sw.js             Veikimas be interneto
manifest.json     Programėlės metaduomenys (įdiegimui į pagrindinį ekraną)
icons/icon.svg    Piktograma
```

## Duomenys ir privatumas

Visi duomenys saugomi naršyklės `localStorage` tik šiame įrenginyje. Programa nesiunčia jokių duomenų į serverį ir nenaudoja analitikos. Pašalinus naršyklės duomenis, įrašai prarandami, todėl rekomenduojama periodiškai kurti atsarginę kopiją.

## Apribojimai

- Priminimai veikia tik tada, kai programos puslapis atidarytas. Fono pranešimams reikalingas serveris.
- Duomenys nesinchronizuojami tarp įrenginių; tam naudokite atsarginės kopijos eksportą ir atkūrimą.

## Licencija

MIT
