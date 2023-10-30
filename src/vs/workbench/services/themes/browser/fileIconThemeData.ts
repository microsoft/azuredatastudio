/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import * as nls from 'vs/nls';
import * as paths from 'vs/base/common/path';
import * as resources from 'vs/base/common/resources';
import * as Json from 'vs/base/common/json';
import { ExtensionData, IThemeExtensionPoint, IWorkbenchFileIconTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { getParseErrorMessage } from 'vs/base/common/jsonErrorMessages';
import { asCSSUrl } from 'vs/base/browser/dom';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IExtensionResourceLoaderService } from 'vs/platform/extensionResourceLoader/common/extensionResourceLoader';
import { ILanguageService } from 'vs/editor/common/languages/language';

export class FileIconThemeData implements IWorkbenchFileIconTheme {

	static readonly STORAGE_KEY = 'iconThemeData';

	id: string;
	label: string;
	settingsId: string | null;
	description?: string;
	hasFileIcons: boolean;
	hasFolderIcons: boolean;
	hidesExplorerArrows: boolean;
	isLoaded: boolean;
	location?: URI;
	extensionData?: ExtensionData;
	watch?: boolean;

	styleSheetContent?: string;

	private constructor(id: string, label: string, settingsId: string | null) {
		this.id = id;
		this.label = label;
		this.settingsId = settingsId;
		this.isLoaded = false;
		this.hasFileIcons = false;
		this.hasFolderIcons = false;
		this.hidesExplorerArrows = false;
	}

	public ensureLoaded(themeLoader: FileIconThemeLoader): Promise<string | undefined> {
		return !this.isLoaded ? this.load(themeLoader) : Promise.resolve(this.styleSheetContent);
	}

	public reload(themeLoader: FileIconThemeLoader): Promise<string | undefined> {
		return this.load(themeLoader);
	}

	private load(themeLoader: FileIconThemeLoader): Promise<string | undefined> {
		return themeLoader.load(this);
	}

	static fromExtensionTheme(iconTheme: IThemeExtensionPoint, iconThemeLocation: URI, extensionData: ExtensionData): FileIconThemeData {
		const id = extensionData.extensionId + '-' + iconTheme.id;
		const label = iconTheme.label || paths.basename(iconTheme.path);
		const settingsId = iconTheme.id;

		const themeData = new FileIconThemeData(id, label, settingsId);

		themeData.description = iconTheme.description;
		themeData.location = iconThemeLocation;
		themeData.extensionData = extensionData;
		themeData.watch = iconTheme._watch;
		themeData.isLoaded = false;
		return themeData;
	}

	private static _noIconTheme: FileIconThemeData | null = null;

	static get noIconTheme(): FileIconThemeData {
		let themeData = FileIconThemeData._noIconTheme;
		if (!themeData) {
			themeData = FileIconThemeData._noIconTheme = new FileIconThemeData('', '', null);
			themeData.hasFileIcons = false;
			themeData.hasFolderIcons = false;
			themeData.hidesExplorerArrows = false;
			themeData.isLoaded = true;
			themeData.extensionData = undefined;
			themeData.watch = false;
		}
		return themeData;
	}

	static createUnloadedTheme(id: string): FileIconThemeData {
		const themeData = new FileIconThemeData(id, '', '__' + id);
		themeData.isLoaded = false;
		themeData.hasFileIcons = false;
		themeData.hasFolderIcons = false;
		themeData.hidesExplorerArrows = false;
		themeData.extensionData = undefined;
		themeData.watch = false;
		return themeData;
	}


	static fromStorageData(storageService: IStorageService): FileIconThemeData | undefined {
		const input = storageService.get(FileIconThemeData.STORAGE_KEY, StorageScope.PROFILE);
		if (!input) {
			return undefined;
		}
		try {
			const data = JSON.parse(input);
			const theme = new FileIconThemeData('', '', null);
			for (const key in data) {
				switch (key) {
					case 'id':
					case 'label':
					case 'description':
					case 'settingsId':
					case 'styleSheetContent':
					case 'hasFileIcons':
					case 'hidesExplorerArrows':
					case 'hasFolderIcons':
					case 'watch':
						(theme as any)[key] = data[key];
						break;
					case 'location':
						// ignore, no longer restore
						break;
					case 'extensionData':
						theme.extensionData = ExtensionData.fromJSONObject(data.extensionData);
						break;
				}
			}
			return theme;
		} catch (e) {
			return undefined;
		}
	}

	toStorage(storageService: IStorageService) {
		const data = JSON.stringify({
			id: this.id,
			label: this.label,
			description: this.description,
			settingsId: this.settingsId,
			styleSheetContent: this.styleSheetContent,
			hasFileIcons: this.hasFileIcons,
			hasFolderIcons: this.hasFolderIcons,
			hidesExplorerArrows: this.hidesExplorerArrows,
			extensionData: ExtensionData.toJSONObject(this.extensionData),
			watch: this.watch
		});
		storageService.store(FileIconThemeData.STORAGE_KEY, data, StorageScope.PROFILE, StorageTarget.MACHINE);
	}
}

interface IconDefinition {
	iconPath: string;
	fontColor: string;
	fontCharacter: string;
	fontSize: string;
	fontId: string;
}

interface FontDefinition {
	id: string;
	weight: string;
	style: string;
	size: string;
	src: { path: string; format: string }[];
}

interface IconsAssociation {
	folder?: string;
	file?: string;
	folderExpanded?: string;
	rootFolder?: string;
	rootFolderExpanded?: string;
	folderNames?: { [folderName: string]: string };
	folderNamesExpanded?: { [folderName: string]: string };
	fileExtensions?: { [extension: string]: string };
	fileNames?: { [fileName: string]: string };
	languageIds?: { [languageId: string]: string };
}

interface IconThemeDocument extends IconsAssociation {
	iconDefinitions: { [key: string]: IconDefinition };
	fonts: FontDefinition[];
	light?: IconsAssociation;
	highContrast?: IconsAssociation;
	hidesExplorerArrows?: boolean;
	showLanguageModeIcons?: boolean;
}

export class FileIconThemeLoader {

	constructor(
		private readonly fileService: IExtensionResourceLoaderService,
		private readonly languageService: ILanguageService
	) {
	}

	public load(data: FileIconThemeData): Promise<string | undefined> {
		if (!data.location) {
			return Promise.resolve(data.styleSheetContent);
		}
		return this.loadIconThemeDocument(data.location).then(iconThemeDocument => {
			const result = this.processIconThemeDocument(data.id, data.location!, iconThemeDocument);
			data.styleSheetContent = result.content;
			data.hasFileIcons = result.hasFileIcons;
			data.hasFolderIcons = result.hasFolderIcons;
			data.hidesExplorerArrows = result.hidesExplorerArrows;
			data.isLoaded = true;
			return data.styleSheetContent;
		});
	}

	private loadIconThemeDocument(location: URI): Promise<IconThemeDocument> {
		return this.fileService.readExtensionResource(location).then((content) => {
			const errors: Json.ParseError[] = [];
			const contentValue = Json.parse(content, errors);
			if (errors.length > 0) {
				return Promise.reject(new Error(nls.localize('error.cannotparseicontheme', "Problems parsing file icons file: {0}", errors.map(e => getParseErrorMessage(e.error)).join(', '))));
			} else if (Json.getNodeType(contentValue) !== 'object') {
				return Promise.reject(new Error(nls.localize('error.invalidformat', "Invalid format for file icons theme file: Object expected.")));
			}
			return Promise.resolve(contentValue);
		});
	}

	private processIconThemeDocument(id: string, iconThemeDocumentLocation: URI, iconThemeDocument: IconThemeDocument): { content: string; hasFileIcons: boolean; hasFolderIcons: boolean; hidesExplorerArrows: boolean } {

		const result = { content: '', hasFileIcons: false, hasFolderIcons: false, hidesExplorerArrows: !!iconThemeDocument.hidesExplorerArrows };

		let hasSpecificFileIcons = false;

		if (!iconThemeDocument.iconDefinitions) {
			return result;
		}
		const selectorByDefinitionId: { [def: string]: string[] } = {};
		const coveredLanguages: { [languageId: string]: boolean } = {};

		const iconThemeDocumentLocationDirname = resources.dirname(iconThemeDocumentLocation);
		function resolvePath(path: string) {
			return resources.joinPath(iconThemeDocumentLocationDirname, path);
		}

		function collectSelectors(associations: IconsAssociation | undefined, baseThemeClassName?: string) {
			function addSelector(selector: string, defId: string) {
				if (defId) {
					let list = selectorByDefinitionId[defId];
					if (!list) {
						list = selectorByDefinitionId[defId] = [];
					}
					list.push(selector);
				}
			}

			if (associations) {
				let qualifier = '.show-file-icons';
				if (baseThemeClassName) {
					qualifier = baseThemeClassName + ' ' + qualifier;
				}

				const expanded = '.monaco-tl-twistie.collapsible:not(.collapsed) + .monaco-tl-contents';

				if (associations.folder) {
					addSelector(`${qualifier} .folder-icon::before`, associations.folder);
					result.hasFolderIcons = true;
				}

				if (associations.folderExpanded) {
					addSelector(`${qualifier} ${expanded} .folder-icon::before`, associations.folderExpanded);
					result.hasFolderIcons = true;
				}

				const rootFolder = associations.rootFolder || associations.folder;
				const rootFolderExpanded = associations.rootFolderExpanded || associations.folderExpanded;

				if (rootFolder) {
					addSelector(`${qualifier} .rootfolder-icon::before`, rootFolder);
					result.hasFolderIcons = true;
				}

				if (rootFolderExpanded) {
					addSelector(`${qualifier} ${expanded} .rootfolder-icon::before`, rootFolderExpanded);
					result.hasFolderIcons = true;
				}

				if (associations.file) {
					addSelector(`${qualifier} .file-icon::before`, associations.file);
					result.hasFileIcons = true;
				}

				const folderNames = associations.folderNames;
				if (folderNames) {
					for (const key in folderNames) {
						const selectors: string[] = [];
						const name = handleParentFolder(key.toLowerCase(), selectors);
						selectors.push(`.${escapeCSS(name)}-name-folder-icon`);
						addSelector(`${qualifier} ${selectors.join('')}.folder-icon::before`, folderNames[key]);
						result.hasFolderIcons = true;
					}
				}
				const folderNamesExpanded = associations.folderNamesExpanded;
				if (folderNamesExpanded) {
					for (const key in folderNamesExpanded) {
						const selectors: string[] = [];
						const name = handleParentFolder(key.toLowerCase(), selectors);
						selectors.push(`.${escapeCSS(name)}-name-folder-icon`);
						addSelector(`${qualifier} ${expanded} ${selectors.join('')}.folder-icon::before`, folderNamesExpanded[key]);
						result.hasFolderIcons = true;
					}
				}

				const languageIds = associations.languageIds;
				if (languageIds) {
					if (!languageIds.jsonc && languageIds.json) {
						languageIds.jsonc = languageIds.json;
					}
					for (const languageId in languageIds) {
						addSelector(`${qualifier} .${escapeCSS(languageId)}-lang-file-icon.file-icon::before`, languageIds[languageId]);
						result.hasFileIcons = true;
						hasSpecificFileIcons = true;
						coveredLanguages[languageId] = true;
					}
				}
				const fileExtensions = associations.fileExtensions;
				if (fileExtensions) {
					for (const key in fileExtensions) {
						const selectors: string[] = [];
						const name = handleParentFolder(key.toLowerCase(), selectors);
						const segments = name.split('.');
						if (segments.length) {
							for (let i = 0; i < segments.length; i++) {
								selectors.push(`.${escapeCSS(segments.slice(i).join('.'))}-ext-file-icon`);
							}
							selectors.push('.ext-file-icon'); // extra segment to increase file-ext score
						}
						addSelector(`${qualifier} ${selectors.join('')}.file-icon::before`, fileExtensions[key]);
						result.hasFileIcons = true;
						hasSpecificFileIcons = true;
					}
				}
				const fileNames = associations.fileNames;
				if (fileNames) {
					for (const key in fileNames) {
						const selectors: string[] = [];
						const fileName = handleParentFolder(key.toLowerCase(), selectors);
						selectors.push(`.${escapeCSS(fileName)}-name-file-icon`);
						selectors.push('.name-file-icon'); // extra segment to increase file-name score
						const segments = fileName.split('.');
						if (segments.length) {
							for (let i = 1; i < segments.length; i++) {
								selectors.push(`.${escapeCSS(segments.slice(i).join('.'))}-ext-file-icon`);
							}
							selectors.push('.ext-file-icon'); // extra segment to increase file-ext score
						}
						addSelector(`${qualifier} ${selectors.join('')}.file-icon::before`, fileNames[key]);
						result.hasFileIcons = true;
						hasSpecificFileIcons = true;
					}
				}
			}
		}
		collectSelectors(iconThemeDocument);
		collectSelectors(iconThemeDocument.light, '.vs');
		collectSelectors(iconThemeDocument.highContrast, '.hc-black');
		collectSelectors(iconThemeDocument.highContrast, '.hc-light');

		if (!result.hasFileIcons && !result.hasFolderIcons) {
			return result;
		}

		const showLanguageModeIcons = iconThemeDocument.showLanguageModeIcons === true || (hasSpecificFileIcons && iconThemeDocument.showLanguageModeIcons !== false);

		const cssRules: string[] = [];

		const fonts = iconThemeDocument.fonts;
		const fontSizes = new Map<string, string>();
		if (Array.isArray(fonts)) {
			const defaultFontSize = fonts[0].size || '150%';
			fonts.forEach(font => {
				const src = font.src.map(l => `${asCSSUrl(resolvePath(l.path))} format('${l.format}')`).join(', ');
				cssRules.push(`@font-face { src: ${src}; font-family: '${font.id}'; font-weight: ${font.weight}; font-style: ${font.style}; font-display: block; }`);
				if (font.size !== undefined && font.size !== defaultFontSize) {
					fontSizes.set(font.id, font.size);
				}
			});
			cssRules.push(`.show-file-icons .file-icon::before, .show-file-icons .folder-icon::before, .show-file-icons .rootfolder-icon::before { font-family: '${fonts[0].id}'; font-size: ${defaultFontSize}; }`);
		}

		for (const defId in selectorByDefinitionId) {
			const selectors = selectorByDefinitionId[defId];
			const definition = iconThemeDocument.iconDefinitions[defId];
			if (definition) {
				if (definition.iconPath) {
					cssRules.push(`${selectors.join(', ')} { content: ' '; background-image: ${asCSSUrl(resolvePath(definition.iconPath))}; }`);
				} else if (definition.fontCharacter || definition.fontColor) {
					const body = [];
					if (definition.fontColor) {
						body.push(`color: ${definition.fontColor};`);
					}
					if (definition.fontCharacter) {
						body.push(`content: '${definition.fontCharacter}';`);
					}
					const fontSize = definition.fontSize ?? (definition.fontId ? fontSizes.get(definition.fontId) : undefined);
					if (fontSize) {
						body.push(`font-size: ${fontSize};`);
					}
					if (definition.fontId) {
						body.push(`font-family: ${definition.fontId};`);
					}
					if (showLanguageModeIcons) {
						body.push(`background-image: unset;`); // potentially set by the language default
					}
					cssRules.push(`${selectors.join(', ')} { ${body.join(' ')} }`);
				}
			}
		}

		if (showLanguageModeIcons) {
			for (const languageId of this.languageService.getRegisteredLanguageIds()) {
				if (!coveredLanguages[languageId]) {
					const icon = this.languageService.getIcon(languageId);
					if (icon) {
						const selector = `.show-file-icons .${escapeCSS(languageId)}-lang-file-icon.file-icon::before`;
						cssRules.push(`${selector} { content: ' '; background-image: ${asCSSUrl(icon.dark)}; }`);
						cssRules.push(`.vs ${selector} { content: ' '; background-image: ${asCSSUrl(icon.light)}; }`);
					}
				}
			}
		}

		result.content = cssRules.join('\n');
		return result;
	}

}

function handleParentFolder(key: string, selectors: string[]): string {
	const lastIndexOfSlash = key.lastIndexOf('/');
	if (lastIndexOfSlash >= 0) {
		const parentFolder = key.substring(0, lastIndexOfSlash);
		selectors.push(`.${escapeCSS(parentFolder)}-name-dir-icon`);
		return key.substring(lastIndexOfSlash + 1);
	}
	return key;
}

function escapeCSS(str: string) {
	str = str.replace(/[\11\12\14\15\40]/g, '/'); // HTML class names can not contain certain whitespace characters, use / instead, which doesn't exist in file names.
	return window.CSS.escape(str);
}
