/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { combinedDisposable, IDisposable, DisposableStore } from 'vs/base/common/lifecycle';
import * as resources from 'vs/base/common/resources';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { Position } from 'vs/editor/common/core/position';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { setSnippetSuggestSupport } from 'vs/editor/contrib/suggest/browser/suggest';
import { localize } from 'vs/nls';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { FileChangeType, IFileService } from 'vs/platform/files/common/files';
import { ILifecycleService, LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkspace, IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ISnippetGetOptions, ISnippetsService } from 'vs/workbench/contrib/snippets/browser/snippets';
import { Snippet, SnippetFile, SnippetSource } from 'vs/workbench/contrib/snippets/browser/snippetsFile';
import { ExtensionsRegistry, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { languagesExtPoint } from 'vs/workbench/services/language/common/languageService';
import { SnippetCompletionProvider } from './snippetCompletionProvider';
import { IExtensionResourceLoaderService } from 'vs/platform/extensionResourceLoader/common/extensionResourceLoader';
import { ResourceMap } from 'vs/base/common/map';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { isStringArray } from 'vs/base/common/types';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ILanguageConfigurationService } from 'vs/editor/common/languages/languageConfigurationRegistry';
import { IUserDataProfileService } from 'vs/workbench/services/userDataProfile/common/userDataProfile';
import { insertInto } from 'vs/base/common/arrays';

namespace snippetExt {

	export interface ISnippetsExtensionPoint {
		language: string;
		path: string;
	}

	export interface IValidSnippetsExtensionPoint {
		language: string;
		location: URI;
	}

	export function toValidSnippet(extension: IExtensionPointUser<ISnippetsExtensionPoint[]>, snippet: ISnippetsExtensionPoint, languageService: ILanguageService): IValidSnippetsExtensionPoint | null {

		if (isFalsyOrWhitespace(snippet.path)) {
			extension.collector.error(localize(
				'invalid.path.0',
				"Expected string in `contributes.{0}.path`. Provided value: {1}",
				extension.description.name, String(snippet.path)
			));
			return null;
		}

		if (isFalsyOrWhitespace(snippet.language) && !snippet.path.endsWith('.code-snippets')) {
			extension.collector.error(localize(
				'invalid.language.0',
				"When omitting the language, the value of `contributes.{0}.path` must be a `.code-snippets`-file. Provided value: {1}",
				extension.description.name, String(snippet.path)
			));
			return null;
		}

		if (!isFalsyOrWhitespace(snippet.language) && !languageService.isRegisteredLanguageId(snippet.language)) {
			extension.collector.error(localize(
				'invalid.language',
				"Unknown language in `contributes.{0}.language`. Provided value: {1}",
				extension.description.name, String(snippet.language)
			));
			return null;

		}

		const extensionLocation = extension.description.extensionLocation;
		const snippetLocation = resources.joinPath(extensionLocation, snippet.path);
		if (!resources.isEqualOrParent(snippetLocation, extensionLocation)) {
			extension.collector.error(localize(
				'invalid.path.1',
				"Expected `contributes.{0}.path` ({1}) to be included inside extension's folder ({2}). This might make the extension non-portable.",
				extension.description.name, snippetLocation.path, extensionLocation.path
			));
			return null;
		}

		return {
			language: snippet.language,
			location: snippetLocation
		};
	}

	export const snippetsContribution: IJSONSchema = {
		description: localize('vscode.extension.contributes.snippets', 'Contributes snippets.'),
		type: 'array',
		defaultSnippets: [{ body: [{ language: '', path: '' }] }],
		items: {
			type: 'object',
			defaultSnippets: [{ body: { language: '${1:id}', path: './snippets/${2:id}.json.' } }],
			properties: {
				language: {
					description: localize('vscode.extension.contributes.snippets-language', 'Language identifier for which this snippet is contributed to.'),
					type: 'string'
				},
				path: {
					description: localize('vscode.extension.contributes.snippets-path', 'Path of the snippets file. The path is relative to the extension folder and typically starts with \'./snippets/\'.'),
					type: 'string'
				}
			}
		}
	};

	export const point = ExtensionsRegistry.registerExtensionPoint<snippetExt.ISnippetsExtensionPoint[]>({
		extensionPoint: 'snippets',
		deps: [languagesExtPoint],
		jsonSchema: snippetExt.snippetsContribution
	});
}

function watch(service: IFileService, resource: URI, callback: () => any): IDisposable {
	return combinedDisposable(
		service.watch(resource),
		service.onDidFilesChange(e => {
			if (e.affects(resource)) {
				callback();
			}
		})
	);
}

class SnippetEnablement {

	private static _key = 'snippets.ignoredSnippets';

	private readonly _ignored: Set<string>;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {

		const raw = _storageService.get(SnippetEnablement._key, StorageScope.PROFILE, '');
		let data: string[] | undefined;
		try {
			data = JSON.parse(raw);
		} catch { }

		this._ignored = isStringArray(data) ? new Set(data) : new Set();
	}

	isIgnored(id: string): boolean {
		return this._ignored.has(id);
	}

	updateIgnored(id: string, value: boolean): void {
		let changed = false;
		if (this._ignored.has(id) && !value) {
			this._ignored.delete(id);
			changed = true;
		} else if (!this._ignored.has(id) && value) {
			this._ignored.add(id);
			changed = true;
		}
		if (changed) {
			this._storageService.store(SnippetEnablement._key, JSON.stringify(Array.from(this._ignored)), StorageScope.PROFILE, StorageTarget.USER);
		}
	}
}

class SnippetUsageTimestamps {

	private static _key = 'snippets.usageTimestamps';

	private readonly _usages: Map<string, number>;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {

		const raw = _storageService.get(SnippetUsageTimestamps._key, StorageScope.PROFILE, '');
		let data: [string, number][] | undefined;
		try {
			data = JSON.parse(raw);
		} catch {
			data = [];
		}

		this._usages = Array.isArray(data) ? new Map(data) : new Map();
	}

	getUsageTimestamp(id: string): number | undefined {
		return this._usages.get(id);
	}

	updateUsageTimestamp(id: string): void {
		// map uses insertion order, we want most recent at the end
		this._usages.delete(id);
		this._usages.set(id, Date.now());

		// persist last 100 item
		const all = [...this._usages].slice(-100);
		this._storageService.store(SnippetUsageTimestamps._key, JSON.stringify(all), StorageScope.PROFILE, StorageTarget.USER);
	}
}

export class SnippetsService implements ISnippetsService {

	declare readonly _serviceBrand: undefined;

	private readonly _disposables = new DisposableStore();
	private readonly _pendingWork: Promise<any>[] = [];
	private readonly _files = new ResourceMap<SnippetFile>();
	private readonly _enablement: SnippetEnablement;
	private readonly _usageTimestamps: SnippetUsageTimestamps;

	constructor(
		@IEnvironmentService private readonly _environmentService: IEnvironmentService,
		@IUserDataProfileService private readonly _userDataProfileService: IUserDataProfileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ILanguageService private readonly _languageService: ILanguageService,
		@ILogService private readonly _logService: ILogService,
		@IFileService private readonly _fileService: IFileService,
		@ITextFileService private readonly _textfileService: ITextFileService,
		@IExtensionResourceLoaderService private readonly _extensionResourceLoaderService: IExtensionResourceLoaderService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ILanguageConfigurationService languageConfigurationService: ILanguageConfigurationService,
	) {
		this._pendingWork.push(Promise.resolve(lifecycleService.when(LifecyclePhase.Restored).then(() => {
			this._initExtensionSnippets();
			this._initUserSnippets();
			this._initWorkspaceSnippets();
		})));

		setSnippetSuggestSupport(new SnippetCompletionProvider(this._languageService, this, languageConfigurationService));

		this._enablement = instantiationService.createInstance(SnippetEnablement);
		this._usageTimestamps = instantiationService.createInstance(SnippetUsageTimestamps);
	}

	dispose(): void {
		this._disposables.dispose();
	}

	isEnabled(snippet: Snippet): boolean {
		return !this._enablement.isIgnored(snippet.snippetIdentifier);
	}

	updateEnablement(snippet: Snippet, enabled: boolean): void {
		this._enablement.updateIgnored(snippet.snippetIdentifier, !enabled);
	}

	updateUsageTimestamp(snippet: Snippet): void {
		this._usageTimestamps.updateUsageTimestamp(snippet.snippetIdentifier);
	}

	private _joinSnippets(): Promise<any> {
		const promises = this._pendingWork.slice(0);
		this._pendingWork.length = 0;
		return Promise.all(promises);
	}

	async getSnippetFiles(): Promise<Iterable<SnippetFile>> {
		await this._joinSnippets();
		return this._files.values();
	}

	async getSnippets(languageId: string | undefined, opts?: ISnippetGetOptions): Promise<Snippet[]> {
		await this._joinSnippets();

		const result: Snippet[] = [];
		const promises: Promise<any>[] = [];

		if (languageId) {
			if (this._languageService.isRegisteredLanguageId(languageId)) {
				for (const file of this._files.values()) {
					promises.push(file.load()
						.then(file => file.select(languageId, result))
						.catch(err => this._logService.error(err, file.location.toString()))
					);
				}
			}
		} else {
			for (const file of this._files.values()) {
				promises.push(file.load()
					.then(file => insertInto(result, result.length, file.data))
					.catch(err => this._logService.error(err, file.location.toString()))
				);
			}
		}
		await Promise.all(promises);
		return this._filterAndSortSnippets(result, opts);
	}

	getSnippetsSync(languageId: string, opts?: ISnippetGetOptions): Snippet[] {
		const result: Snippet[] = [];
		if (this._languageService.isRegisteredLanguageId(languageId)) {
			for (const file of this._files.values()) {
				// kick off loading (which is a noop in case it's already loaded)
				// and optimistically collect snippets
				file.load().catch(_err => { /*ignore*/ });
				file.select(languageId, result);
			}
		}
		return this._filterAndSortSnippets(result, opts);
	}

	private _filterAndSortSnippets(snippets: Snippet[], opts?: ISnippetGetOptions): Snippet[] {

		const result: Snippet[] = [];

		for (const snippet of snippets) {
			if (!snippet.prefix && !opts?.includeNoPrefixSnippets) {
				// prefix or no-prefix wanted
				continue;
			}
			if (!this.isEnabled(snippet) && !opts?.includeDisabledSnippets) {
				// enabled or disabled wanted
				continue;
			}
			if (typeof opts?.fileTemplateSnippets === 'boolean' && opts.fileTemplateSnippets !== snippet.isFileTemplate) {
				// isTopLevel requested but mismatching
				continue;
			}
			result.push(snippet);
		}


		return result.sort((a, b) => {
			let result = 0;
			if (!opts?.noRecencySort) {
				const val1 = this._usageTimestamps.getUsageTimestamp(a.snippetIdentifier) ?? -1;
				const val2 = this._usageTimestamps.getUsageTimestamp(b.snippetIdentifier) ?? -1;
				result = val2 - val1;
			}
			if (result === 0) {
				result = this._compareSnippet(a, b);
			}
			return result;
		});
	}

	private _compareSnippet(a: Snippet, b: Snippet): number {
		if (a.snippetSource < b.snippetSource) {
			return -1;
		} else if (a.snippetSource > b.snippetSource) {
			return 1;
		} else if (a.source < b.source) {
			return -1;
		} else if (a.source > b.source) {
			return 1;
		} else if (a.name > b.name) {
			return 1;
		} else if (a.name < b.name) {
			return -1;
		} else {
			return 0;
		}
	}

	// --- loading, watching

	private _initExtensionSnippets(): void {
		snippetExt.point.setHandler(extensions => {

			for (const [key, value] of this._files) {
				if (value.source === SnippetSource.Extension) {
					this._files.delete(key);
				}
			}

			for (const extension of extensions) {
				for (const contribution of extension.value) {
					const validContribution = snippetExt.toValidSnippet(extension, contribution, this._languageService);
					if (!validContribution) {
						continue;
					}

					const file = this._files.get(validContribution.location);
					if (file) {
						if (file.defaultScopes) {
							file.defaultScopes.push(validContribution.language);
						} else {
							file.defaultScopes = [];
						}
					} else {
						const file = new SnippetFile(SnippetSource.Extension, validContribution.location, validContribution.language ? [validContribution.language] : undefined, extension.description, this._fileService, this._extensionResourceLoaderService);
						this._files.set(file.location, file);

						if (this._environmentService.isExtensionDevelopment) {
							file.load().then(file => {
								// warn about bad tabstop/variable usage
								if (file.data.some(snippet => snippet.isBogous)) {
									extension.collector.warn(localize(
										'badVariableUse',
										"One or more snippets from the extension '{0}' very likely confuse snippet-variables and snippet-placeholders (see https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax for more details)",
										extension.description.name
									));
								}
							}, err => {
								// generic error
								extension.collector.warn(localize(
									'badFile',
									"The snippet file \"{0}\" could not be read.",
									file.location.toString()
								));
							});
						}

					}
				}
			}
		});
	}

	private _initWorkspaceSnippets(): void {
		// workspace stuff
		const disposables = new DisposableStore();
		const updateWorkspaceSnippets = () => {
			disposables.clear();
			this._pendingWork.push(this._initWorkspaceFolderSnippets(this._contextService.getWorkspace(), disposables));
		};
		this._disposables.add(disposables);
		this._disposables.add(this._contextService.onDidChangeWorkspaceFolders(updateWorkspaceSnippets));
		this._disposables.add(this._contextService.onDidChangeWorkbenchState(updateWorkspaceSnippets));
		updateWorkspaceSnippets();
	}

	private async _initWorkspaceFolderSnippets(workspace: IWorkspace, bucket: DisposableStore): Promise<any> {
		const promises = workspace.folders.map(async folder => {
			const snippetFolder = folder.toResource('.vscode');
			const value = await this._fileService.exists(snippetFolder);
			if (value) {
				this._initFolderSnippets(SnippetSource.Workspace, snippetFolder, bucket);
			} else {
				// watch
				bucket.add(this._fileService.onDidFilesChange(e => {
					if (e.contains(snippetFolder, FileChangeType.ADDED)) {
						this._initFolderSnippets(SnippetSource.Workspace, snippetFolder, bucket);
					}
				}));
			}
		});
		await Promise.all(promises);
	}

	private async _initUserSnippets(): Promise<any> {
		const disposables = new DisposableStore();
		const updateUserSnippets = async () => {
			disposables.clear();
			const userSnippetsFolder = this._userDataProfileService.currentProfile.snippetsHome;
			await this._fileService.createFolder(userSnippetsFolder);
			await this._initFolderSnippets(SnippetSource.User, userSnippetsFolder, disposables);
		};
		this._disposables.add(disposables);
		this._disposables.add(this._userDataProfileService.onDidChangeCurrentProfile(e => e.join((async () => {
			this._pendingWork.push(updateUserSnippets());
		})())));
		await updateUserSnippets();
	}

	private _initFolderSnippets(source: SnippetSource, folder: URI, bucket: DisposableStore): Promise<any> {
		const disposables = new DisposableStore();
		const addFolderSnippets = async () => {
			disposables.clear();
			if (!await this._fileService.exists(folder)) {
				return;
			}
			try {
				const stat = await this._fileService.resolve(folder);
				for (const entry of stat.children || []) {
					disposables.add(this._addSnippetFile(entry.resource, source));
				}
			} catch (err) {
				this._logService.error(`Failed snippets from folder '${folder.toString()}'`, err);
			}
		};

		bucket.add(this._textfileService.files.onDidSave(e => {
			if (resources.isEqualOrParent(e.model.resource, folder)) {
				addFolderSnippets();
			}
		}));
		bucket.add(watch(this._fileService, folder, addFolderSnippets));
		bucket.add(disposables);
		return addFolderSnippets();
	}

	private _addSnippetFile(uri: URI, source: SnippetSource): IDisposable {
		const ext = resources.extname(uri);
		if (source === SnippetSource.User && ext === '.json') {
			const langName = resources.basename(uri).replace(/\.json/, '');
			this._files.set(uri, new SnippetFile(source, uri, [langName], undefined, this._fileService, this._extensionResourceLoaderService));
		} else if (ext === '.code-snippets') {
			this._files.set(uri, new SnippetFile(source, uri, undefined, undefined, this._fileService, this._extensionResourceLoaderService));
		}
		return {
			dispose: () => this._files.delete(uri)
		};
	}
}


export interface ISimpleModel {
	getLineContent(lineNumber: number): string;
}

export function getNonWhitespacePrefix(model: ISimpleModel, position: Position): string {
	/**
	 * Do not analyze more characters
	 */
	const MAX_PREFIX_LENGTH = 100;

	const line = model.getLineContent(position.lineNumber).substr(0, position.column - 1);

	const minChIndex = Math.max(0, line.length - MAX_PREFIX_LENGTH);
	for (let chIndex = line.length - 1; chIndex >= minChIndex; chIndex--) {
		const ch = line.charAt(chIndex);

		if (/\s/.test(ch)) {
			return line.substr(chIndex + 1);
		}
	}

	if (minChIndex === 0) {
		return line;
	}

	return '';
}
