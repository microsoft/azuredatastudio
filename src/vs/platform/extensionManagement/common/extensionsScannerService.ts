/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { coalesce } from 'vs/base/common/arrays';
import { ThrottledDelayer } from 'vs/base/common/async';
import * as objects from 'vs/base/common/objects';
import { VSBuffer } from 'vs/base/common/buffer';
import { IStringDictionary } from 'vs/base/common/collections';
import { getErrorMessage } from 'vs/base/common/errors';
import { getNodeType, parse, ParseError } from 'vs/base/common/json';
import { getParseErrorMessage } from 'vs/base/common/jsonErrorMessages';
import { Disposable } from 'vs/base/common/lifecycle';
import { FileAccess, Schemas } from 'vs/base/common/network';
import * as path from 'vs/base/common/path';
import * as platform from 'vs/base/common/platform';
import { basename, isEqual, joinPath } from 'vs/base/common/resources';
import * as semver from 'vs/base/common/semver/semver';
import Severity from 'vs/base/common/severity';
import { isArray, isObject, isString } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { Metadata } from 'vs/platform/extensionManagement/common/extensionManagement';
import { areSameExtensions, computeTargetPlatform, ExtensionKey, getExtensionId, getGalleryExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { ExtensionType, ExtensionIdentifier, IExtensionManifest, TargetPlatform, IExtensionIdentifier, IRelaxedExtensionManifest, UNDEFINED_PUBLISHER, IExtensionDescription, BUILTIN_MANIFEST_CACHE_FILE, USER_MANIFEST_CACHE_FILE, MANIFEST_CACHE_FOLDER } from 'vs/platform/extensions/common/extensions';
import { validateExtensionManifest } from 'vs/platform/extensions/common/extensionValidator';
import { FileOperationResult, IFileService, toFileOperationResult } from 'vs/platform/files/common/files';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { Emitter, Event } from 'vs/base/common/event';
import { revive } from 'vs/base/common/marshalling';

export type IScannedExtensionManifest = IRelaxedExtensionManifest & { __metadata?: Metadata };

interface IRelaxedScannedExtension {
	type: ExtensionType;
	isBuiltin: boolean;
	identifier: IExtensionIdentifier;
	manifest: IRelaxedExtensionManifest;
	location: URI;
	targetPlatform: TargetPlatform;
	metadata: Metadata | undefined;
	isValid: boolean;
	validations: readonly [Severity, string][];
}

export type IScannedExtension = Readonly<IRelaxedScannedExtension> & { manifest: IExtensionManifest };

export interface Translations {
	[id: string]: string;
}

export namespace Translations {
	export function equals(a: Translations, b: Translations): boolean {
		if (a === b) {
			return true;
		}
		let aKeys = Object.keys(a);
		let bKeys: Set<string> = new Set<string>();
		for (let key of Object.keys(b)) {
			bKeys.add(key);
		}
		if (aKeys.length !== bKeys.size) {
			return false;
		}

		for (let key of aKeys) {
			if (a[key] !== b[key]) {
				return false;
			}
			bKeys.delete(key);
		}
		return bKeys.size === 0;
	}
}

interface MessageBag {
	[key: string]: string | { message: string; comment: string[] };
}

interface TranslationBundle {
	contents: {
		package: MessageBag;
	};
}

interface LocalizedMessages {
	values: MessageBag | undefined;
	default: URI | null;
}

interface IBuiltInExtensionControl {
	[name: string]: 'marketplace' | 'disabled' | string;
}

export type ScanOptions = {
	readonly includeInvalid?: boolean;
	readonly includeAllVersions?: boolean;
	readonly includeUninstalled?: boolean;
	readonly checkControlFile?: boolean;
	readonly language?: string;
	readonly useCache?: boolean;
};

export const IExtensionsScannerService = createDecorator<IExtensionsScannerService>('IExtensionsScannerService');
export interface IExtensionsScannerService {
	readonly _serviceBrand: undefined;

	readonly systemExtensionsLocation: URI;
	readonly userExtensionsLocation: URI;
	readonly onDidChangeCache: Event<ExtensionType>;

	getTargetPlatform(): Promise<TargetPlatform>;

	scanAllExtensions(scanOptions: ScanOptions): Promise<IScannedExtension[]>;
	scanSystemExtensions(scanOptions: ScanOptions): Promise<IScannedExtension[]>;
	scanUserExtensions(scanOptions: ScanOptions): Promise<IScannedExtension[]>;
	scanExtensionsUnderDevelopment(scanOptions: ScanOptions, existingExtensions: IScannedExtension[]): Promise<IScannedExtension[]>;
	scanExistingExtension(extensionLocation: URI, extensionType: ExtensionType, scanOptions: ScanOptions): Promise<IScannedExtension | null>;
	scanOneOrMultipleExtensions(extensionLocation: URI, extensionType: ExtensionType, scanOptions: ScanOptions): Promise<IScannedExtension[]>;

	updateMetadata(extensionLocation: URI, metadata: Partial<Metadata>): Promise<void>;
}

export abstract class AbstractExtensionsScannerService extends Disposable implements IExtensionsScannerService {

	readonly _serviceBrand: undefined;

	protected abstract getTranslations(language: string): Promise<Translations>;

	private readonly _onDidChangeCache = this._register(new Emitter<ExtensionType>());
	readonly onDidChangeCache = this._onDidChangeCache.event;

	private readonly systemExtensionsCachedScanner = this._register(new CachedExtensionsScanner(joinPath(this.cacheLocation, BUILTIN_MANIFEST_CACHE_FILE), this.fileService, this.logService));
	private readonly userExtensionsCachedScanner = this._register(new CachedExtensionsScanner(joinPath(this.cacheLocation, USER_MANIFEST_CACHE_FILE), this.fileService, this.logService));
	private readonly extensionsScanner = this._register(new ExtensionsScanner(this.fileService, this.logService));

	constructor(
		readonly systemExtensionsLocation: URI,
		readonly userExtensionsLocation: URI,
		private readonly extensionsControlLocation: URI,
		private readonly cacheLocation: URI,
		@IFileService protected readonly fileService: IFileService,
		@ILogService protected readonly logService: ILogService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IProductService private readonly productService: IProductService,
	) {
		super();

		this._register(this.systemExtensionsCachedScanner.onDidChangeCache(() => this._onDidChangeCache.fire(ExtensionType.System)));
		this._register(this.userExtensionsCachedScanner.onDidChangeCache(() => this._onDidChangeCache.fire(ExtensionType.User)));
	}

	private _targetPlatformPromise: Promise<TargetPlatform> | undefined;
	getTargetPlatform(): Promise<TargetPlatform> {
		if (!this._targetPlatformPromise) {
			this._targetPlatformPromise = computeTargetPlatform(this.fileService, this.logService);
		}
		return this._targetPlatformPromise;
	}

	async scanAllExtensions(scanOptions: ScanOptions): Promise<IScannedExtension[]> {
		const [system, user] = await Promise.all([
			this.scanSystemExtensions(scanOptions),
			this.scanUserExtensions(scanOptions),
		]);
		const development = await this.scanExtensionsUnderDevelopment(scanOptions, [...system, ...user]);
		return this.dedupExtensions([...system, ...user, ...development], await this.getTargetPlatform(), true);
	}

	async scanSystemExtensions(scanOptions: ScanOptions): Promise<IScannedExtension[]> {
		const promises: Promise<IRelaxedScannedExtension[]>[] = [];
		promises.push(this.scanDefaultSystemExtensions(!!scanOptions.useCache, scanOptions.language));
		promises.push(this.scanDevSystemExtensions(scanOptions.language, !!scanOptions.checkControlFile));
		const [defaultSystemExtensions, devSystemExtensions] = await Promise.all(promises);
		return this.applyScanOptions([...defaultSystemExtensions, ...devSystemExtensions], scanOptions, false);
	}

	async scanUserExtensions(scanOptions: ScanOptions): Promise<IScannedExtension[]> {
		this.logService.trace('Started scanning user extensions');
		const extensionsScannerInput = await this.createExtensionScannerInput(this.userExtensionsLocation, ExtensionType.User, !scanOptions.includeUninstalled, scanOptions.language);
		const extensionsScanner = scanOptions.useCache && !extensionsScannerInput.devMode && extensionsScannerInput.excludeObsolete ? this.userExtensionsCachedScanner : this.extensionsScanner;
		let extensions = await extensionsScanner.scanExtensions(extensionsScannerInput);
		extensions = await this.applyScanOptions(extensions, scanOptions, true);
		this.logService.trace('Scanned user extensions:', extensions.length);
		return extensions;
	}

	async scanExtensionsUnderDevelopment(scanOptions: ScanOptions, existingExtensions: IScannedExtension[]): Promise<IScannedExtension[]> {
		if (this.environmentService.isExtensionDevelopment && this.environmentService.extensionDevelopmentLocationURI) {
			const extensions = (await Promise.all(this.environmentService.extensionDevelopmentLocationURI.filter(extLoc => extLoc.scheme === Schemas.file)
				.map(async extensionDevelopmentLocationURI => {
					const input = await this.createExtensionScannerInput(extensionDevelopmentLocationURI, ExtensionType.User, true, scanOptions.language, false /* do not validate */);
					const extensions = await this.extensionsScanner.scanOneOrMultipleExtensions(input);
					return extensions.map(extension => {
						// Override the extension type from the existing extensions
						extension.type = existingExtensions.find(e => areSameExtensions(e.identifier, extension.identifier))?.type ?? extension.type;
						// Validate the extension
						return this.extensionsScanner.validate(extension, input);
					});
				})))
				.flat();
			return this.applyScanOptions(extensions, scanOptions, true);
		}
		return [];
	}

	async scanExistingExtension(extensionLocation: URI, extensionType: ExtensionType, scanOptions: ScanOptions): Promise<IScannedExtension | null> {
		const extensionsScannerInput = await this.createExtensionScannerInput(extensionLocation, extensionType, true, scanOptions.language);
		const extension = await this.extensionsScanner.scanExtension(extensionsScannerInput);
		if (!extension) {
			return null;
		}
		if (!scanOptions.includeInvalid && !extension.isValid) {
			return null;
		}
		return extension;
	}

	async scanOneOrMultipleExtensions(extensionLocation: URI, extensionType: ExtensionType, scanOptions: ScanOptions): Promise<IScannedExtension[]> {
		const extensionsScannerInput = await this.createExtensionScannerInput(extensionLocation, extensionType, true, scanOptions.language);
		const extensions = await this.extensionsScanner.scanOneOrMultipleExtensions(extensionsScannerInput);
		return this.applyScanOptions(extensions, scanOptions, true);
	}

	async updateMetadata(extensionLocation: URI, metaData: Partial<Metadata>): Promise<void> {
		const manifestLocation = joinPath(extensionLocation, 'package.json');
		const content = (await this.fileService.readFile(manifestLocation)).value.toString();
		const manifest: IScannedExtensionManifest = JSON.parse(content);

		// unset if false
		metaData.isMachineScoped = metaData.isMachineScoped || undefined;
		metaData.isBuiltin = metaData.isBuiltin || undefined;
		metaData.installedTimestamp = metaData.installedTimestamp || undefined;
		manifest.__metadata = { ...manifest.__metadata, ...metaData };

		await this.fileService.writeFile(joinPath(extensionLocation, 'package.json'), VSBuffer.fromString(JSON.stringify(manifest, null, '\t')));
	}

	private async applyScanOptions(extensions: IRelaxedScannedExtension[], scanOptions: ScanOptions, pickLatest: boolean): Promise<IRelaxedScannedExtension[]> {
		if (!scanOptions.includeAllVersions) {
			extensions = this.dedupExtensions(extensions, await this.getTargetPlatform(), pickLatest);
		}
		if (!scanOptions.includeInvalid) {
			extensions = extensions.filter(extension => extension.isValid);
		}
		return extensions.sort((a, b) => {
			const aLastSegment = path.basename(a.location.fsPath);
			const bLastSegment = path.basename(b.location.fsPath);
			if (aLastSegment < bLastSegment) {
				return -1;
			}
			if (aLastSegment > bLastSegment) {
				return 1;
			}
			return 0;
		});
	}

	private dedupExtensions(extensions: IRelaxedScannedExtension[], targetPlatform: TargetPlatform, pickLatest: boolean): IRelaxedScannedExtension[] {
		const result = new Map<string, IRelaxedScannedExtension>();
		for (const extension of extensions) {
			const extensionKey = ExtensionIdentifier.toKey(extension.identifier.id);
			const existing = result.get(extensionKey);
			if (existing) {
				if (existing.isValid && !extension.isValid) {
					continue;
				}
				if (existing.isValid === extension.isValid) {
					if (pickLatest && semver.gt(existing.manifest.version, extension.manifest.version)) {
						this.logService.debug(`Skipping extension ${extension.location.path} with lower version ${extension.manifest.version}.`);
						continue;
					}
					if (semver.eq(existing.manifest.version, extension.manifest.version) && existing.targetPlatform === targetPlatform) {
						this.logService.debug(`Skipping extension ${extension.location.path} from different target platform ${extension.targetPlatform}`);
						continue;
					}
				}
				if (existing.type === ExtensionType.System) {
					this.logService.debug(`Overwriting system extension ${existing.location.path} with ${extension.location.path}.`);
				} else {
					this.logService.warn(`Overwriting user extension ${existing.location.path} with ${extension.location.path}.`);
				}
			}
			result.set(extensionKey, extension);
		}
		return [...result.values()];
	}

	private async scanDefaultSystemExtensions(useCache: boolean, language: string | undefined): Promise<IRelaxedScannedExtension[]> {
		this.logService.trace('Started scanning system extensions');
		const extensionsScannerInput = await this.createExtensionScannerInput(this.systemExtensionsLocation, ExtensionType.System, true, language);
		const extensionsScanner = useCache && !extensionsScannerInput.devMode ? this.systemExtensionsCachedScanner : this.extensionsScanner;
		const result = await extensionsScanner.scanExtensions(extensionsScannerInput);
		this.logService.trace('Scanned system extensions:', result.length);
		return result;
	}

	private async scanDevSystemExtensions(language: string | undefined, checkControlFile: boolean): Promise<IRelaxedScannedExtension[]> {
		const devSystemExtensionsList = this.environmentService.isBuilt ? [] : this.productService.builtInExtensions;
		if (!devSystemExtensionsList?.length) {
			return [];
		}

		this.logService.trace('Started scanning dev system extensions');
		const builtinExtensionControl = checkControlFile ? await this.getBuiltInExtensionControl() : {};
		const devSystemExtensionsLocations: URI[] = [];
		const devSystemExtensionsLocation = URI.file(path.normalize(path.join(FileAccess.asFileUri('', require).fsPath, '..', '.build', 'builtInExtensions')));
		for (const extension of devSystemExtensionsList) {
			const controlState = builtinExtensionControl[extension.name] || 'marketplace';
			switch (controlState) {
				case 'disabled':
					break;
				case 'marketplace':
					devSystemExtensionsLocations.push(joinPath(devSystemExtensionsLocation, extension.name));
					break;
				default:
					devSystemExtensionsLocations.push(URI.file(controlState));
					break;
			}
		}
		const result = await Promise.all(devSystemExtensionsLocations.map(async location => this.extensionsScanner.scanExtension((await this.createExtensionScannerInput(location, ExtensionType.System, true, language)))));
		this.logService.trace('Scanned dev system extensions:', result.length);
		return coalesce(result);
	}

	private async getBuiltInExtensionControl(): Promise<IBuiltInExtensionControl> {
		try {
			const content = await this.fileService.readFile(this.extensionsControlLocation);
			return JSON.parse(content.value.toString());
		} catch (error) {
			return {};
		}
	}

	private async createExtensionScannerInput(location: URI, type: ExtensionType, excludeObsolete: boolean, language: string | undefined, validate: boolean = true): Promise<ExtensionScannerInput> {
		const translations = await this.getTranslations(language ?? platform.language);
		let mtime: number | undefined;
		try {
			const folderStat = await this.fileService.stat(location);
			if (typeof folderStat.mtime === 'number') {
				mtime = folderStat.mtime;
			}
		} catch (err) {
			// That's ok...
		}
		return new ExtensionScannerInput(
			location,
			mtime,
			type,
			excludeObsolete,
			validate,
			this.productService.version,
			this.productService.date,
			this.productService.commit,
			!this.environmentService.isBuilt,
			language,
			translations,
		);
	}

}

class ExtensionScannerInput {

	constructor(
		public readonly location: URI,
		public readonly mtime: number | undefined,
		public readonly type: ExtensionType,
		public readonly excludeObsolete: boolean,
		public readonly validate: boolean,
		public readonly productVersion: string,
		public readonly productDate: string | undefined,
		public readonly productCommit: string | undefined,
		public readonly devMode: boolean,
		public readonly language: string | undefined,
		public readonly translations: Translations
	) {
		// Keep empty!! (JSON.parse)
	}

	public static createNlsConfiguration(input: ExtensionScannerInput): NlsConfiguration {
		return {
			language: input.language,
			pseudo: input.language === 'pseudo',
			devMode: input.devMode,
			translations: input.translations
		};
	}

	public static equals(a: ExtensionScannerInput, b: ExtensionScannerInput): boolean {
		return (
			isEqual(a.location, b.location)
			&& a.mtime === b.mtime
			&& a.type === b.type
			&& a.excludeObsolete === b.excludeObsolete
			&& a.validate === b.validate
			&& a.productVersion === b.productVersion
			&& a.productDate === b.productDate
			&& a.productCommit === b.productCommit
			&& a.devMode === b.devMode
			&& a.language === b.language
			&& Translations.equals(a.translations, b.translations)
		);
	}
}

type NlsConfiguration = {
	language: string | undefined;
	pseudo: boolean;
	devMode: boolean;
	translations: Translations;
};

class ExtensionsScanner extends Disposable {

	constructor(
		protected readonly fileService: IFileService,
		protected readonly logService: ILogService
	) {
		super();
	}

	async scanExtensions(input: ExtensionScannerInput): Promise<IRelaxedScannedExtension[]> {
		const stat = await this.fileService.resolve(input.location);
		if (stat.children) {
			let obsolete: IStringDictionary<boolean> = {};
			if (input.excludeObsolete && input.type === ExtensionType.User) {
				try {
					const raw = (await this.fileService.readFile(joinPath(input.location, '.obsolete'))).value.toString();
					obsolete = JSON.parse(raw);
				} catch (error) { /* ignore */ }
			}
			const extensions = await Promise.all<IRelaxedScannedExtension | null>(
				stat.children.map(async c => {
					if (!c.isDirectory) {
						return null;
					}
					// Do not consider user extension folder starting with `.`
					if (input.type === ExtensionType.User && basename(c.resource).indexOf('.') === 0) {
						return null;
					}
					const extensionScannerInput = new ExtensionScannerInput(c.resource, input.mtime, input.type, input.excludeObsolete, input.validate, input.productVersion, input.productDate, input.productCommit, input.devMode, input.language, input.translations);
					const extension = await this.scanExtension(extensionScannerInput);
					return extension && !obsolete[ExtensionKey.create(extension).toString()] ? extension : null;
				}));
			return coalesce(extensions);
		}
		return [];
	}

	async scanOneOrMultipleExtensions(input: ExtensionScannerInput): Promise<IRelaxedScannedExtension[]> {
		try {
			if (await this.fileService.exists(joinPath(input.location, 'package.json'))) {
				const extension = await this.scanExtension(input);
				return extension ? [extension] : [];
			} else {
				return await this.scanExtensions(input);
			}
		} catch (error) {
			this.logService.error(`Error scanning extensions at ${input.location.path}:`, getErrorMessage(error));
			return [];
		}
	}

	async scanExtension(input: ExtensionScannerInput): Promise<IRelaxedScannedExtension | null> {
		try {
			let manifest = await this.scanExtensionManifest(input.location);
			if (manifest) {
				// allow publisher to be undefined to make the initial extension authoring experience smoother
				if (!manifest.publisher) {
					manifest.publisher = UNDEFINED_PUBLISHER;
				}
				const metadata = manifest.__metadata;
				delete manifest.__metadata;
				const id = getGalleryExtensionId(manifest.publisher, manifest.name);
				const identifier = metadata?.id ? { id, uuid: metadata.id } : { id };
				const type = metadata?.isSystem ? ExtensionType.System : input.type;
				const isBuiltin = type === ExtensionType.System || !!metadata?.isBuiltin;
				manifest = await this.translateManifest(input.location, manifest, ExtensionScannerInput.createNlsConfiguration(input));
				const extension = {
					type,
					identifier,
					manifest,
					location: input.location,
					isBuiltin,
					targetPlatform: metadata?.targetPlatform ?? TargetPlatform.UNDEFINED,
					metadata,
					isValid: true,
					validations: []
				};
				return input.validate ? this.validate(extension, input) : extension;
			}
		} catch (e) {
			if (input.type !== ExtensionType.System) {
				this.logService.error(e);
			}
		}
		return null;
	}

	validate(extension: IRelaxedScannedExtension, input: ExtensionScannerInput): IRelaxedScannedExtension {
		let isValid = true;
		const validations = validateExtensionManifest(input.productVersion, input.productDate, input.location, extension.manifest, extension.isBuiltin);
		for (const [severity, message] of validations) {
			if (severity === Severity.Error) {
				isValid = false;
				this.logService.error(this.formatMessage(input.location, message));
			}
		}
		extension.isValid = isValid;
		extension.validations = validations;
		return extension;
	}

	private async scanExtensionManifest(extensionLocation: URI): Promise<IScannedExtensionManifest | null> {
		const manifestLocation = joinPath(extensionLocation, 'package.json');
		let content;
		try {
			content = (await this.fileService.readFile(manifestLocation)).value.toString();
		} catch (error) {
			if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
				this.logService.error(this.formatMessage(extensionLocation, localize('fileReadFail', "Cannot read file {0}: {1}.", manifestLocation.path, error.message)));
			}
			return null;
		}
		let manifest: IScannedExtensionManifest;
		try {
			manifest = JSON.parse(content);
		} catch (err) {
			// invalid JSON, let's get good errors
			const errors: ParseError[] = [];
			parse(content, errors);
			for (const e of errors) {
				this.logService.error(this.formatMessage(extensionLocation, localize('jsonParseFail', "Failed to parse {0}: [{1}, {2}] {3}.", manifestLocation.path, e.offset, e.length, getParseErrorMessage(e.error))));
			}
			return null;
		}
		if (getNodeType(manifest) !== 'object') {
			this.logService.error(this.formatMessage(extensionLocation, localize('jsonParseInvalidType', "Invalid manifest file {0}: Not an JSON object.", manifestLocation.path)));
			return null;
		}
		return manifest;
	}

	private async translateManifest(extensionLocation: URI, extensionManifest: IExtensionManifest, nlsConfiguration: NlsConfiguration): Promise<IExtensionManifest> {
		const localizedMessages = await this.getLocalizedMessages(extensionLocation, extensionManifest, nlsConfiguration);
		if (localizedMessages) {
			try {
				const errors: ParseError[] = [];
				// resolveOriginalMessageBundle returns null if localizedMessages.default === undefined;
				const defaults = await this.resolveOriginalMessageBundle(localizedMessages.default, errors);
				if (errors.length > 0) {
					errors.forEach((error) => {
						this.logService.error(this.formatMessage(extensionLocation, localize('jsonsParseReportErrors', "Failed to parse {0}: {1}.", localizedMessages.default?.path, getParseErrorMessage(error.error))));
					});
					return extensionManifest;
				} else if (getNodeType(localizedMessages) !== 'object') {
					this.logService.error(this.formatMessage(extensionLocation, localize('jsonInvalidFormat', "Invalid format {0}: JSON object expected.", localizedMessages.default?.path)));
					return extensionManifest;
				}
				const localized = localizedMessages.values || Object.create(null);
				this.replaceNLStrings(nlsConfiguration.pseudo, extensionManifest, localized, defaults, extensionLocation);
			} catch (error) {
				/*Ignore Error*/
			}
		}
		return extensionManifest;
	}

	private async getLocalizedMessages(extensionLocation: URI, extensionManifest: IExtensionManifest, nlsConfiguration: NlsConfiguration): Promise<LocalizedMessages | undefined> {
		const defaultPackageNLS = joinPath(extensionLocation, 'package.nls.json');
		const reportErrors = (localized: URI | null, errors: ParseError[]): void => {
			errors.forEach((error) => {
				this.logService.error(this.formatMessage(extensionLocation, localize('jsonsParseReportErrors', "Failed to parse {0}: {1}.", localized?.path, getParseErrorMessage(error.error))));
			});
		};
		const reportInvalidFormat = (localized: URI | null): void => {
			this.logService.error(this.formatMessage(extensionLocation, localize('jsonInvalidFormat', "Invalid format {0}: JSON object expected.", localized?.path)));
		};

		const translationId = `${extensionManifest.publisher}.${extensionManifest.name}`;
		const translationPath = nlsConfiguration.translations[translationId];

		if (translationPath) {
			try {
				const translationResource = URI.file(translationPath);
				const content = (await this.fileService.readFile(translationResource)).value.toString();
				let errors: ParseError[] = [];
				let translationBundle: TranslationBundle = parse(content, errors);
				if (errors.length > 0) {
					reportErrors(translationResource, errors);
					return { values: undefined, default: defaultPackageNLS };
				} else if (getNodeType(translationBundle) !== 'object') {
					reportInvalidFormat(translationResource);
					return { values: undefined, default: defaultPackageNLS };
				} else {
					let values = translationBundle.contents ? translationBundle.contents.package : undefined;
					return { values: values, default: defaultPackageNLS };
				}
			} catch (error) {
				return { values: undefined, default: defaultPackageNLS };
			}
		} else {
			const exists = await this.fileService.exists(defaultPackageNLS);
			if (!exists) {
				return undefined;
			}
			let messageBundle;
			try {
				messageBundle = await this.findMessageBundles(extensionLocation, nlsConfiguration);
			} catch (error) {
				return undefined;
			}
			if (!messageBundle.localized) {
				return { values: undefined, default: messageBundle.original };
			}
			try {
				const messageBundleContent = (await this.fileService.readFile(messageBundle.localized)).value.toString();
				let errors: ParseError[] = [];
				let messages: MessageBag = parse(messageBundleContent, errors);
				if (errors.length > 0) {
					reportErrors(messageBundle.localized, errors);
					return { values: undefined, default: messageBundle.original };
				} else if (getNodeType(messages) !== 'object') {
					reportInvalidFormat(messageBundle.localized);
					return { values: undefined, default: messageBundle.original };
				}
				return { values: messages, default: messageBundle.original };
			} catch (error) {
				return { values: undefined, default: messageBundle.original };
			}
		}
	}

	/**
	 * Parses original message bundle, returns null if the original message bundle is null.
	 */
	private async resolveOriginalMessageBundle(originalMessageBundle: URI | null, errors: ParseError[]): Promise<{ [key: string]: string } | null> {
		if (originalMessageBundle) {
			try {
				const originalBundleContent = (await this.fileService.readFile(originalMessageBundle)).value.toString();
				return parse(originalBundleContent, errors);
			} catch (error) {
				/* Ignore Error */
				return null;
			}
		} else {
			return null;
		}
	}

	/**
	 * Finds localized message bundle and the original (unlocalized) one.
	 * If the localized file is not present, returns null for the original and marks original as localized.
	 */
	private findMessageBundles(extensionLocation: URI, nlsConfiguration: NlsConfiguration): Promise<{ localized: URI; original: URI | null }> {
		return new Promise<{ localized: URI; original: URI | null }>((c, e) => {
			const loop = (locale: string): void => {
				let toCheck = joinPath(extensionLocation, `package.nls.${locale}.json`);
				this.fileService.exists(toCheck).then(exists => {
					if (exists) {
						c({ localized: toCheck, original: joinPath(extensionLocation, 'package.nls.json') });
					}
					let index = locale.lastIndexOf('-');
					if (index === -1) {
						c({ localized: joinPath(extensionLocation, 'package.nls.json'), original: null });
					} else {
						locale = locale.substring(0, index);
						loop(locale);
					}
				});
			};
			if (nlsConfiguration.devMode || nlsConfiguration.pseudo || !nlsConfiguration.language) {
				return c({ localized: joinPath(extensionLocation, 'package.nls.json'), original: null });
			}
			loop(nlsConfiguration.language);
		});
	}

	/**
	 * This routine makes the following assumptions:
	 * The root element is an object literal
	 */
	private replaceNLStrings<T extends object>(pseudo: boolean, literal: T, messages: MessageBag, originalMessages: MessageBag | null, extensionLocation: URI): void {
		const processEntry = (obj: any, key: string | number, command?: boolean) => {
			const value = obj[key];
			if (isString(value)) {
				const str = <string>value;
				const length = str.length;
				if (length > 1 && str[0] === '%' && str[length - 1] === '%') {
					const messageKey = str.substr(1, length - 2);
					let translated = messages[messageKey];
					// If the messages come from a language pack they might miss some keys
					// Fill them from the original messages.
					if (translated === undefined && originalMessages) {
						translated = originalMessages[messageKey];
					}
					let message: string | undefined = typeof translated === 'string' ? translated : (typeof translated?.message === 'string' ? translated.message : undefined);
					if (message !== undefined) {
						if (pseudo) {
							// FF3B and FF3D is the Unicode zenkaku representation for [ and ]
							message = '\uFF3B' + message.replace(/[aouei]/g, '$&$&') + '\uFF3D';
						}
						obj[key] = command && (key === 'title' || key === 'category') && originalMessages ? { value: message, original: originalMessages[messageKey] } : message;
					} else {
						this.logService.warn(this.formatMessage(extensionLocation, localize('missingNLSKey', "Couldn't find message for key {0}.", messageKey)));
					}
				}
			} else if (isObject(value)) {
				for (let k in value) {
					if (value.hasOwnProperty(k)) {
						k === 'commands' ? processEntry(value, k, true) : processEntry(value, k, command);
					}
				}
			} else if (isArray(value)) {
				for (let i = 0; i < value.length; i++) {
					processEntry(value, i, command);
				}
			}
		};

		for (let key in literal) {
			if (literal.hasOwnProperty(key)) {
				processEntry(literal, key);
			}
		}
	}

	private formatMessage(extensionLocation: URI, message: string): string {
		return `[${extensionLocation.path}]: ${message}`;
	}

}

interface IExtensionCacheData {
	input: ExtensionScannerInput;
	result: IRelaxedScannedExtension[];
}

class CachedExtensionsScanner extends ExtensionsScanner {

	private input: ExtensionScannerInput | undefined;
	private readonly cacheValidatorThrottler: ThrottledDelayer<void> = this._register(new ThrottledDelayer(3000));

	private readonly _onDidChangeCache = this._register(new Emitter<void>());
	readonly onDidChangeCache = this._onDidChangeCache.event;

	constructor(
		private readonly cacheFile: URI,
		fileService: IFileService,
		logService: ILogService
	) {
		super(fileService, logService);
	}

	override async scanExtensions(input: ExtensionScannerInput): Promise<IRelaxedScannedExtension[]> {
		const cacheContents = await this.readExtensionCache();
		this.input = input;
		if (cacheContents && cacheContents.input && ExtensionScannerInput.equals(cacheContents.input, this.input)) {
			this.cacheValidatorThrottler.trigger(() => this.validateCache());
			return cacheContents.result.map((extension) => {
				// revive URI object
				extension.location = URI.revive(extension.location);
				return extension;
			});
		}
		const result = await super.scanExtensions(input);
		await this.writeExtensionCache({ input, result });
		return result;
	}

	private async readExtensionCache(): Promise<IExtensionCacheData | null> {
		try {
			const cacheRawContents = await this.fileService.readFile(this.cacheFile);
			const extensionCacheData: IExtensionCacheData = JSON.parse(cacheRawContents.value.toString());
			return { result: extensionCacheData.result, input: revive(extensionCacheData.input) };
		} catch (error) {
			this.logService.debug('Error while reading the extension cache file:', this.cacheFile.path, getErrorMessage(error));
		}
		return null;
	}

	private async writeExtensionCache(cacheContents: IExtensionCacheData): Promise<void> {
		try {
			await this.fileService.writeFile(this.cacheFile, VSBuffer.fromString(JSON.stringify(cacheContents)));
		} catch (error) {
			this.logService.debug('Error while writing the extension cache file:', this.cacheFile.path, getErrorMessage(error));
		}
	}

	private async validateCache(): Promise<void> {
		if (!this.input) {
			// Input has been unset by the time we get here, so skip validation
			return;
		}

		const cacheContents = await this.readExtensionCache();
		if (!cacheContents) {
			// Cache has been deleted by someone else, which is perfectly fine...
			return;
		}

		const actual = cacheContents.result;
		const expected = JSON.parse(JSON.stringify(await super.scanExtensions(this.input)));
		if (objects.equals(expected, actual)) {
			// Cache is valid and running with it is perfectly fine...
			return;
		}

		try {
			// Cache is invalid, delete it
			await this.fileService.del(this.cacheFile);
			this._onDidChangeCache.fire();
		} catch (error) {
			this.logService.error(error);
		}
	}

}

export function toExtensionDescription(extension: IScannedExtension, isUnderDevelopment: boolean): IExtensionDescription {
	const id = getExtensionId(extension.manifest.publisher, extension.manifest.name);
	return {
		id,
		identifier: new ExtensionIdentifier(id),
		isBuiltin: extension.type === ExtensionType.System,
		isUserBuiltin: extension.type === ExtensionType.User && extension.isBuiltin,
		isUnderDevelopment,
		extensionLocation: extension.location,
		uuid: extension.identifier.uuid,
		targetPlatform: extension.targetPlatform,
		...extension.manifest,
	};
}

export class NativeExtensionsScannerService extends AbstractExtensionsScannerService implements IExtensionsScannerService {

	private readonly translationsPromise: Promise<Translations>;

	constructor(
		systemExtensionsLocation: URI,
		userExtensionsLocation: URI,
		userHome: URI,
		userDataPath: URI,
		fileService: IFileService,
		logService: ILogService,
		environmentService: IEnvironmentService,
		productService: IProductService,
	) {
		super(
			systemExtensionsLocation,
			userExtensionsLocation,
			joinPath(userHome, '.vscode-oss-dev', 'extensions', 'control.json'),
			joinPath(userDataPath, MANIFEST_CACHE_FOLDER),
			fileService, logService, environmentService, productService);
		this.translationsPromise = (async () => {
			if (platform.translationsConfigFile) {
				try {
					const content = await this.fileService.readFile(URI.file(platform.translationsConfigFile));
					return JSON.parse(content.value.toString());
				} catch (err) { /* Ignore Error */ }
			}
			return Object.create(null);
		})();
	}

	protected getTranslations(language: string): Promise<Translations> {
		return this.translationsPromise;
	}

}
