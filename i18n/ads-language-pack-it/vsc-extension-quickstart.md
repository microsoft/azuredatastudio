# Benvenuti al Language Pack italiano

## Contenuto della cartella
* `package.json` - il file manifest, che contiene il nome e la descrizione dell'estensione di localizzazione. Contiene anche `localizations` che definisce l'id della lingua:
```json
        "contributes": {
            "localizations": [{
                "languageId": "it",
                "languageName": "Italian",
                "localizedLanguageName": "Italiano"
            }]
        }
```
* `translations` - la cartella che contiene le stringhe tradotte.

Per aggiungere o aggiornare la cartella `translations` con le ultime stringhe derivanti da transifex:
- Controllare la branch `master` del [repository di VS Code](https://github.com/Microsoft/vscode).
   - Preferibilmente, porre il repository di VS Code con l'estensione del language pack (in questo modo la cartella padre sarà la stessa)
   - `cd vscode` ed eseguire `yarn` per inizializzare il repository di VS Code.
- Ottenere un token API da https://www.transifex.com/user/settings/api.
- Valorizzare la variabile di ambiente `TRANSIFEX_API_TOKEN` con il token API.
- `cd` sul repository di VS Code
   - Se l'estensione del language pack è posizionata correttamente (con il repository di VS Code) eseguire `npm run update-localization-extension it`
   - altrimenti, `npm run update-localization-extension {percorso_estensione_language_pack}`.
- Questo consentirà il download dei file di traduzione nella cartella `translations` ed, allo stesso tempo, modificherà la proprietà `translations` nella parte `localizations` del json.

# Welcome to the Italian language pack

## What's in the folder
* `package.json` - the manifest file, defining the name and description of the localization extension. It also contains the `localizations` contribution point that defines the language id:
```json
        "contributes": {
            "localizations": [{
                "languageId": "it",
                "languageName": "Italian",
                "localizedLanguageName": "Italiano"
            }]
        }
```
* `translations` - the folder containing the translation strings


To populate or update the `translations` folder as with the latest strings from transifex:
- Check out the `master` branch of the [VS Code repository](https://github.com/Microsoft/vscode).
   - Preferably, place the VSCode repo next to the language pack extension (so both have the same parent folder).
   - `cd vscode` and run `yarn` to initialize the VS Code repo.
- Get an API token from https://www.transifex.com/user/settings/api.
- Set the API token to the environment variable `TRANSIFEX_API_TOKEN`.
- `cd` to the VS Code repo
   - If the language pack extension is placed next to the VS Code repository: `npm run update-localization-extension it`
   - Otherwise: `npm run update-localization-extension {path_to_lang_pack_ext}`
- This will download translation files to the folder `translations`, as well as populate a `translations` property in the `localizations` contribution point.
