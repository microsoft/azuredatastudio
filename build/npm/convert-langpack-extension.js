/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

let locFunc = require("../lib/locFunc");
let i18n = require("../lib/i18n");
let fs = require("fs");
let path = require("path");

let gulp = require('gulp');
let vfs = require("vinyl-fs");

const textFields = {
	"nameText": 'ads',
	"displayNameText": 'Azure Data Studio',
	"publisherText": 'Microsoft',
	"licenseText": 'SEE SOURCE EULA LICENSE IN LICENSE.txt',
	"updateText": 'cd ../vscode && npm run update-localization-extension '
}

//list of extensions from vscode that are to be included with ADS.
const VSCODEExtensions = [
	"bat",
	"configuration-editing",
	"docker",
	"extension-editing",
	"git-ui",
	"git",
	"github-authentication",
	"github",
	"image-preview",
	"json-language-features",
	"json",
	"markdown-basics",
	"markdown-language-features",
	"merge-conflict",
	"microsoft-authentication",
	"powershell",
	"python",
	"r",
	"search-result",
	"sql",
	"theme-abyss",
	"theme-defaults",
	"theme-kimbie-dark",
	"theme-monokai-dimmed",
	"theme-monokai",
	"theme-quietlight",
	"theme-red",
	"theme-seti",
	"theme-solarized-dark",
	"theme-solarized-light",
	"theme-tomorrow-night-blue",
	"typescript-basics",
	"xml",
	"yaml"
];

/**
 * A heavily modified version of update-localization-extension that runs using local xlf resources, no commands required to pass in.
 * It converts a vscode langpack to an ADS one,
 *
 * It removes the resources of vscode that we do not support, and adds in new i18n json files created from the xlf files in the folder.
 * It also merges in the sql core strings with the vscode core strings into a combined main i18n json file.
 *
 * Note: Not intended to be used on current ADS langpacks, only vscode ones.
 * Remember to change the version of the langpack and rename the folder to ads instead of vscode.
*/
export function updateLangpackResources() {

	let location = path.join('.', 'resources', 'xlf');
	if (fs.existsSync(location)) {
		throw new Error(`${location} doesn't exist.`);
	}
	let supportedLocations = [...i18n.defaultLanguages, ...i18n.extraLanguages];

	for (let i = 0; i < supportedLocations.length; i++){
		let langId = supportedLocations[i].id;

		locExtFolder = path.join('.', 'i18n', `vscode-language-pack-${langId}`);
		let locExtStat = fs.statSync(locExtFolder);
		if (!locExtStat || !locExtStat.isDirectory) {
			console.log('Language is not included in ADS yet: ' + langId);
			continue;
		}
		let packageJSON = JSON.parse(fs.readFileSync(path.join(locExtFolder, 'package.json')).toString());
		//processing extension fields, version and folder name must be changed manually.
		packageJSON['name'] = packageJSON['name'].replace('vscode', textFields.nameText);
		packageJSON['displayName'] = packageJSON['displayName'].replace('Visual Studio Code', textFields.displayNameText);
		packageJSON['publisher'] = textFields.publisherText;
		packageJSON['license'] = textFields.licenseText;
		packageJSON['scripts']['update'] = textFields.updateText + langId;

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

			//remove extensions not part of ADS.
			if (fs.existsSync(translationDataFolder)) {
				let totalExtensions = fs.readdirSync(path.join(translationDataFolder, 'extensions'));
				for (let extensionTag in totalExtensions) {
					let extensionFileName = totalExtensions[extensionTag];
					let xlfPath = path.join(location, `${languageId}`, extensionFileName.replace('.i18n.json', '.xlf'))
					if (!(fs.existsSync(xlfPath)|| VSCODEExtensions.indexOf(extensionFileName.replace('.i18n.json', '')) !== -1)) {
						let filePath = path.join(translationDataFolder, 'extensions', extensionName + '.i18n.json')
						rimraf.sync(filePath);
					}
				}
			}


			console.log(`Importing translations for ${languageId} from '${location}' to '${translationDataFolder}' ...`);
			let translationPaths = [];
			gulp.src(path.join(location, languageId, '**', '*.xlf'))
				.pipe(locFunc.modifyI18nPackFiles(translationDataFolder, translationPaths, languageId === 'ps'))
				.on('error', (error) => {
					console.log(`Error occurred while importing translations:`);
					translationPaths = undefined;
					if (Array.isArray(error)) {
						error.forEach(console.log);
					} else if (error) {
						console.log(error);
					} else {
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
}

