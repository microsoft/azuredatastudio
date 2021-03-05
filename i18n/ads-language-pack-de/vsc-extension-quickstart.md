# Welcome to the German language pack

## What's in the folder
* `package.json` - the manifest file, defining the name and description of the localization extension. It also contains the `localizations` contribution point that defines the language id:
```json
        "contributes": {
            "localization": [{
                "languageId": "de",
                "languageName": "German",
                "localizedLanguageName": "Deutsch"
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
   - If the language pack extension is placed next to the VS Code repository: `npm run update-localization-extension de`
   - Otherwise: `npm run update-localization-extension {path_to_lang_pack_ext}`
- This will download translation files to the folder `translations`, as well as populate a `translations` property in the `localizations` contribution point.
