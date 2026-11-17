# 🍫 La Fabbrica del Cioccolato

Gioco per la scuola primaria per imparare le **frazioni** con una barretta di cioccolato.
Pensato per LIM, tablet e computer: si gioca con il dito, con il mouse o con la tastiera.

## I giochi

| Gioco | Cosa fa il bambino | Cosa impara |
|---|---|---|
| 🍫 **Prendi** | Mette nel piatto i quadretti indicati dal numeratore | Il significato del numeratore |
| 🔪 **Dividi e prendi** | Taglia la barretta in parti uguali, poi prende i quadretti | Il significato del denominatore |
| 🔍 **Che frazione è?** | Guarda il cioccolato e scrive la frazione (anche "quanto è rimasto?") | Leggere una frazione, frazione complementare |
| ⚖️ **Equivalenti** | Prepara la stessa quantità con quadretti più piccoli (es. 1/2 = 4/8) | Frazioni equivalenti |
| 🆚 **Confronta** | Sceglie tra minore, uguale o maggiore guardando due barrette | Confronto tra frazioni |

Le stelle guadagnate e l'ultimo gioco scelto vengono ricordati dal browser.

## Usarlo

Apri `index.html` con il browser: basta un doppio clic.
**Non serve internet**, perché font, stili e coriandoli sono tutti nel progetto.
Puoi copiare la cartella su una chiavetta e aprirla dalla LIM.

Puoi anche pubblicarlo online con GitHub Pages (Settings → Pages → branch `main`, cartella `/`).

## Struttura

```
index.html          pagina del gioco
js/app.js           logica del gioco
css/input.css       stili sorgente (Tailwind + stili personalizzati)
css/styles.css      stili compilati (generati, non modificare a mano)
fonts/              font Fredoka (licenza SIL OFL, vedi fonts/OFL.txt)
vendor/             canvas-confetti (licenza ISC)
```

## Modificare gli stili

Se cambi le classi in `index.html` o `js/app.js`, oppure modifichi `css/input.css`, rigenera il CSS:

```bash
npm install
npm run build:css
```
