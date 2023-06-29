"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.renameVscodeLangpacks = exports.refreshLangpacks = exports.modifyI18nPackFiles = exports.packageSingleExtensionStream = exports.packageLangpacksStream = void 0;
const es = require("event-stream");
const path = require("path");
const glob = require("glob");
const rename = require("gulp-rename");
const ext = require("./extensions");
const i18n = require("./i18n");
const fs = require("fs");
const File = require("vinyl");
const rimraf = require("rimraf");
const gulp = require("gulp");
const vfs = require("vinyl-fs");
/**
 * If you need to compile this file for any changes, please run: yarn tsc -p ./build/tsconfig.json
 */
//List of extensions that we changed from vscode, so we can exclude them from having "Microsoft." appended in front.
const alteredVSCodeExtensions = [
    'git'
];
const root = path.dirname(path.dirname(__dirname));
// Modified packageLocalExtensionsStream from extensions.ts, but for langpacks.
function packageLangpacksStream() {
    const langpackDescriptions = glob.sync('i18n/*/package.json')
        .map(manifestPath => {
        const langpackPath = path.dirname(path.join(root, manifestPath));
        const langpackName = path.basename(langpackPath);
        return { name: langpackName, path: langpackPath };
    });
    const builtLangpacks = langpackDescriptions.map(langpack => {
        return ext.fromLocalNormal(langpack.path)
            .pipe(rename(p => p.dirname = `langpacks/${langpack.name}/${p.dirname}`));
    });
    return es.merge(builtLangpacks);
}
exports.packageLangpacksStream = packageLangpacksStream;
// Modified packageLocalExtensionsStream but for any ADS extensions including excluded/external ones.
function packageSingleExtensionStream(name) {
    const extenalExtensionDescriptions = glob.sync(`extensions/${name}/package.json`)
        .map(manifestPath => {
        const extensionPath = path.dirname(path.join(root, manifestPath));
        const extensionName = path.basename(extensionPath);
        return { name: extensionName, path: extensionPath };
    });
    const builtExtension = extenalExtensionDescriptions.map(extension => {
        return ext.fromLocal(extension.path, false)
            .pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
    });
    return es.merge(builtExtension);
}
exports.packageSingleExtensionStream = packageSingleExtensionStream;
// Langpack creation functions go here.
/**
 * Function combines the contents of the SQL core XLF file into the current main i18n file contianing the vs core strings.
 * Based on createI18nFile in i18n.ts
*/
function updateMainI18nFile(existingTranslationFilePath, originalFilePath, messages) {
    let currFilePath = path.join(existingTranslationFilePath + '.i18n.json');
    let currentContent = fs.readFileSync(currFilePath);
    let currentContentObject = JSON.parse(currentContent.toString());
    let objectContents = currentContentObject.contents;
    let result = Object.create(null);
    // Delete any SQL strings that are no longer part of ADS in current langpack.
    for (let contentKey of Object.keys(objectContents)) {
        if (contentKey.startsWith('sql') && messages.contents[contentKey] === undefined) {
            delete objectContents[`${contentKey}`];
        }
    }
    messages.contents = { ...objectContents, ...messages.contents };
    result[''] = [
        '--------------------------------------------------------------------------------------------',
        'Copyright (c) Microsoft Corporation. All rights reserved.',
        'Licensed under the Source EULA. See License.txt in the project root for license information.',
        '--------------------------------------------------------------------------------------------',
        'Do not edit this file. It is machine generated.'
    ];
    for (let key of Object.keys(messages)) {
        result[key] = messages[key];
    }
    let content = JSON.stringify(result, null, '\t');
    if (process.platform === 'win32') {
        content = content.replace(/\n/g, '\r\n');
    }
    return new File({
        path: path.join(originalFilePath + '.i18n.json'),
        contents: Buffer.from(content, 'utf8'),
    });
}
/**
 * Function handles the processing of xlf resources and turning them into i18n.json files.
 * It adds the i18n files translation paths to be added back into package.main.
 * Based on prepareI18nPackFiles in i18n.ts
*/
function modifyI18nPackFiles(existingTranslationFolder, resultingTranslationPaths, pseudo = false) {
    let parsePromises = [];
    let mainPack = { version: i18n.i18nPackVersion, contents: {} };
    let extensionsPacks = {};
    let errors = [];
    return es.through(function (xlf) {
        let rawResource = path.basename(xlf.relative, '.xlf');
        let resource = rawResource.substring(0, rawResource.lastIndexOf('.'));
        let contents = xlf.contents.toString();
        let parsePromise = pseudo ? i18n.XLF.parsePseudo(contents) : i18n.XLF.org_parse(contents);
        parsePromises.push(parsePromise);
        parsePromise.then(resolvedFiles => {
            resolvedFiles.forEach(file => {
                const path = file.originalFilePath;
                const firstSlash = path.indexOf('/');
                //exclude core sql file from extension processing.
                if (resource !== 'sql') {
                    let extPack = extensionsPacks[resource];
                    if (!extPack) {
                        extPack = extensionsPacks[resource] = { version: i18n.i18nPackVersion, contents: {} };
                    }
                    //remove extensions/extensionId section as all extensions will be webpacked.
                    const secondSlash = path.indexOf('/', firstSlash + 1);
                    extPack.contents[path.substr(secondSlash + 1)] = file.messages;
                }
                else {
                    mainPack.contents[path.substr(firstSlash + 1)] = file.messages;
                }
            });
        }).catch(reason => {
            errors.push(reason);
        });
    }, function () {
        Promise.all(parsePromises)
            .then(() => {
            if (errors.length > 0) {
                throw errors;
            }
            const translatedMainFile = updateMainI18nFile(existingTranslationFolder + '\\main', './main', mainPack);
            this.queue(translatedMainFile);
            for (let extension in extensionsPacks) {
                const translatedExtFile = i18n.createI18nFile(`extensions/${extension}`, extensionsPacks[extension]);
                this.queue(translatedExtFile);
                // exclude altered vscode extensions from having a new path even if we provide a new I18n file.
                if (alteredVSCodeExtensions.indexOf(extension) === -1) {
                    let adsExtensionId = 'Microsoft.' + extension;
                    resultingTranslationPaths.push({ id: adsExtensionId, resourceName: `extensions/${extension}.i18n.json` });
                }
            }
            this.queue(null);
        })
            .catch((reason) => {
            this.emit('error', reason);
        });
    });
}
exports.modifyI18nPackFiles = modifyI18nPackFiles;
const textFields = {
    "nameText": 'ads',
    "displayNameText": 'Azure Data Studio',
    "publisherText": 'Microsoft',
    "licenseText": 'SEE SOURCE EULA LICENSE IN LICENSE.txt',
    "updateText": 'cd ../vscode && npm run update-localization-extension ',
    "vscodeVersion": '*',
    "azdataPlaceholder": '^0.0.0',
    "gitUrl": 'https://github.com/Microsoft/azuredatastudio'
};
//list of extensions from vscode that are to be included with ADS.
const VSCODEExtensions = [
    "bat",
    "configuration-editing",
    "csharp",
    "dart",
    "docker",
    "fsharp",
    "git",
    "git-base",
    "github",
    "github-authentication",
    "html",
    "image-preview",
    "ipynb",
    "javascript",
    "json",
    "json-language-features",
    "julia",
    "markdown-basics",
    "markdown-language-features",
    "markdown-math",
    "merge-conflict",
    "microsoft-authentication",
    "notebook-renderers",
    "powershell",
    "python",
    "r",
    "search-result",
    "simple-browser",
    "sql",
    "theme-abyss",
    "theme-defaults",
    "theme-kimbie-dark",
    "theme-monokai",
    "theme-monokai-dimmed",
    "theme-quietlight",
    "theme-red",
    "theme-seti",
    "theme-solarized-dark",
    "theme-solarized-light",
    "theme-tomorrow-night-blue",
    "xml",
    "yaml"
];
/**
 * A heavily modified version of update-localization-extension that runs using local xlf resources, no arguments required to pass in.
 * It converts a renamed vscode langpack to an ADS one or updates the existing langpack to use current XLF resources.
 * It runs this process on all langpacks currently in the ADS i18n folder.
 * (Replace an individual ADS langpack folder with a corresponding vscode langpack folder renamed to "ads" instead of "vscode"
 * in order to update vscode core strings and extensions for that langpack)
 *
 * It removes the resources of vscode that we do not support, and adds in new i18n json files created from the xlf files in the folder.
 * It also merges in the sql core XLF strings with the langpack's existing core strings into a combined main i18n json file.
 *
 * After running this gulp task, for each language pack:
 *
 * 1. Remember to change the version of the langpacks to continue from the previous version of the ADS langpack.
 *
 * 2. Also change the azdata version to match the current ADS version number.
 *
 * 3. Update the changelog with the new version of the language pack.
 *
 * IMPORTANT: If you have run this gulp task on langpacks that originated from vscode, for each affected vscode langpack, you must
 * replace the changelog and readme files with the ones from the previous ADS version of the langpack before doing the above steps.
 *
 * This is mainly for consistency with previous langpacks and to provide proper information to the user.
*/
function refreshLangpacks() {
    let supportedLocations = [...i18n.defaultLanguages, ...i18n.extraLanguages];
    for (let i = 0; i < supportedLocations.length; i++) {
        let langId = supportedLocations[i].id;
        if (langId === "zh-cn") {
            langId = "zh-hans";
        }
        if (langId === "zh-tw") {
            langId = "zh-hant";
        }
        let location = path.join('.', 'resources', 'xlf');
        let locExtFolder = path.join('.', 'i18n', `ads-language-pack-${langId}`);
        try {
            fs.statSync(locExtFolder);
        }
        catch {
            console.log('Language is not included in ADS yet: ' + langId);
            continue;
        }
        let packageJSON = JSON.parse(fs.readFileSync(path.join(locExtFolder, 'package.json')).toString());
        //processing extension fields, version and folder name must be changed manually.
        packageJSON['name'] = packageJSON['name'].replace('vscode', textFields.nameText).toLowerCase();
        packageJSON['displayName'] = packageJSON['displayName'].replace('Visual Studio Code', textFields.displayNameText);
        packageJSON['publisher'] = textFields.publisherText;
        packageJSON['license'] = textFields.licenseText;
        packageJSON['scripts']['update'] = textFields.updateText + langId;
        packageJSON['engines']['vscode'] = textFields.vscodeVersion;
        packageJSON['repository']['url'] = textFields.gitUrl;
        packageJSON['engines']['azdata'] = textFields.azdataPlaceholder; // Remember to change this to the appropriate version at the end.
        let contributes = packageJSON['contributes'];
        if (!contributes) {
            throw new Error('The extension must define a "localizations" contribution in the "package.json"');
        }
        let localizations = contributes['localizations'];
        if (!localizations) {
            throw new Error('The extension must define a "localizations" contribution of type array in the "package.json"');
        }
        localizations.forEach(function (localization) {
            if (!localization.languageId || !localization.languageName || !localization.localizedLanguageName) {
                throw new Error('Each localization contribution must define "languageId", "languageName" and "localizedLanguageName" properties.');
            }
            let languageId = localization.transifexId || localization.languageId;
            let translationDataFolder = path.join(locExtFolder, 'translations');
            if (languageId === "zh-cn") {
                languageId = "zh-hans";
            }
            if (languageId === "zh-tw") {
                languageId = "zh-hant";
            }
            console.log(`Importing translations for ${languageId} from '${location}' to '${translationDataFolder}' ...`);
            let translationPaths = [];
            gulp.src(path.join(location, languageId, '**', '*.xlf'))
                .pipe(modifyI18nPackFiles(translationDataFolder, translationPaths, languageId === 'ps'))
                .on('error', (error) => {
                console.log(`Error occurred while importing translations:`);
                translationPaths = undefined;
                if (Array.isArray(error)) {
                    error.forEach(console.log);
                }
                else if (error) {
                    console.log(error);
                }
                else {
                    console.log('Unknown error');
                }
            })
                .pipe(vfs.dest(translationDataFolder))
                .on('end', function () {
                if (translationPaths !== undefined) {
                    let nonExistantExtensions = [];
                    for (let curr of localization.translations) {
                        try {
                            if (curr.id === 'vscode.theme-seti') {
                                //handle edge case where 'theme-seti' has a different id.
                                curr.id = 'vscode.vscode-theme-seti';
                            }
                            fs.statSync(path.join(translationDataFolder, curr.path.replace('./translations', '')));
                        }
                        catch {
                            nonExistantExtensions.push(curr);
                        }
                    }
                    for (let nonExt of nonExistantExtensions) {
                        let index = localization.translations.indexOf(nonExt);
                        if (index > -1) {
                            localization.translations.splice(index, 1);
                        }
                    }
                    for (let tp of translationPaths) {
                        let finalPath = `./translations/${tp.resourceName}`;
                        let isFound = false;
                        for (let i = 0; i < localization.translations.length; i++) {
                            if (localization.translations[i].path === finalPath) {
                                localization.translations[i].id = tp.id;
                                isFound = true;
                                break;
                            }
                        }
                        if (!isFound) {
                            localization.translations.push({ id: tp.id, path: finalPath });
                        }
                    }
                    fs.writeFileSync(path.join(locExtFolder, 'package.json'), JSON.stringify(packageJSON, null, '\t'));
                }
            });
        });
    }
    console.log("Langpack Refresh Completed.");
    return Promise.resolve();
}
exports.refreshLangpacks = refreshLangpacks;
/**
 * Function for adding replacing ads language packs with vscode ones.
 * For new languages, remember to add to i18n.extraLanguages so that it will be recognized by ADS.
*/
function renameVscodeLangpacks() {
    let supportedLocations = [...i18n.defaultLanguages, ...i18n.extraLanguages];
    for (let i = 0; i < supportedLocations.length; i++) {
        let langId = supportedLocations[i].id;
        if (langId === "zh-cn") {
            langId = "zh-hans";
        }
        if (langId === "zh-tw") {
            langId = "zh-hant";
        }
        let locADSFolder = path.join('.', 'i18n', `ads-language-pack-${langId}`);
        let locVSCODEFolder = path.join('.', 'i18n', `vscode-language-pack-${langId}`);
        let translationDataFolder = path.join(locVSCODEFolder, 'translations');
        let xlfFolder = path.join('.', 'resources', 'xlf');
        try {
            fs.statSync(locVSCODEFolder);
        }
        catch {
            console.log('vscode pack is not in ADS yet: ' + langId);
            continue;
        }
        //Delete any erroneous zip files found in vscode folder.
        let globZipArray = glob.sync(path.join(locVSCODEFolder, '*.zip'));
        globZipArray.forEach(element => {
            fs.unlinkSync(element);
        });
        // Delete extension files in vscode language pack that are not in ADS.
        if (fs.existsSync(translationDataFolder)) {
            let totalExtensions = fs.readdirSync(path.join(translationDataFolder, 'extensions'));
            for (let extensionTag in totalExtensions) {
                let extensionFileName = totalExtensions[extensionTag];
                let xlfPath = path.join(xlfFolder, `${langId}`, extensionFileName.replace('.i18n.json', '.xlf'));
                if (!(fs.existsSync(xlfPath) || VSCODEExtensions.indexOf(extensionFileName.replace('.i18n.json', '')) !== -1)) {
                    let filePath = path.join(translationDataFolder, 'extensions', extensionFileName);
                    rimraf.sync(filePath);
                }
            }
        }
        //Get list of md files in ADS langpack, to copy to vscode langpack prior to renaming.
        let globMDArray = glob.sync(path.join(locADSFolder, '*.md'));
        //Copy files to vscode langpack, then remove the ADS langpack, and finally rename the vscode langpack to match the ADS one.
        globMDArray.forEach(element => {
            fs.copyFileSync(element, path.join(locVSCODEFolder, path.parse(element).base));
        });
        rimraf.sync(locADSFolder);
        fs.renameSync(locVSCODEFolder, locADSFolder);
    }
    console.log("Langpack Rename Completed.");
    return Promise.resolve();
}
exports.renameVscodeLangpacks = renameVscodeLangpacks;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jRnVuYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxvY0Z1bmMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHOzs7QUFFaEcsbUNBQW1DO0FBQ25DLDZCQUE2QjtBQUM3Qiw2QkFBNkI7QUFDN0Isc0NBQXVDO0FBQ3ZDLG9DQUFxQztBQUNyQywrQkFBZ0M7QUFDaEMseUJBQXlCO0FBQ3pCLDhCQUE4QjtBQUM5QixpQ0FBaUM7QUFDakMsNkJBQTZCO0FBQzdCLGdDQUFnQztBQUVoQzs7R0FFRztBQUVILG9IQUFvSDtBQUNwSCxNQUFNLHVCQUF1QixHQUFHO0lBQy9CLEtBQUs7Q0FDTCxDQUFDO0FBRUYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFFbkQsK0VBQStFO0FBQy9FLFNBQWdCLHNCQUFzQjtJQUNyQyxNQUFNLG9CQUFvQixHQUFjLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUU7U0FDdkUsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFO1FBQ25CLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUNqRSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2pELE9BQU8sRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsQ0FBQztJQUNuRCxDQUFDLENBQUMsQ0FBQztJQUVKLE1BQU0sY0FBYyxHQUFHLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUMxRCxPQUFPLEdBQUcsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQzthQUN2QyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFF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