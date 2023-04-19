/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ExtensionRecommendations, ExtensionRecommendation } from 'vs/workbench/contrib/extensions/browser/extensionRecommendations';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { EnablementState, IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { ExtensionRecommendationReason, IExtensionIgnoredRecommendationsService } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';
import { IExtensionsViewPaneContainer, IExtensionsWorkbenchService, IExtension, VIEWLET_ID as EXTENSIONS_VIEWLET_ID } from 'vs/workbench/contrib/extensions/common/extensions';
import { CancellationToken } from 'vs/base/common/cancellation';
import { localize } from 'vs/nls';
import { StorageScope, IStorageService, StorageTarget } from 'vs/platform/storage/common/storage';
import { IProductService } from 'vs/platform/product/common/productService';
import { ImportantExtensionTip } from 'vs/base/common/product';
import { forEach, IStringDictionary } from 'vs/base/common/collections';
import { ITextModel } from 'vs/editor/common/model';
import { Schemas } from 'vs/base/common/network';
import { basename, extname } from 'vs/base/common/resources';
import { match } from 'vs/base/common/glob';
import { URI } from 'vs/base/common/uri';
import { Mimes } from 'vs/base/common/mime';
import { getMimeTypes } from 'vs/editor/common/services/languagesAssociations';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IModelService } from 'vs/editor/common/services/model';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { IExtensionRecommendationNotificationService, RecommendationsNotificationResult, RecommendationSource } from 'vs/platform/extensionRecommendations/common/extensionRecommendations';
import { IWorkbenchAssignmentService } from 'vs/workbench/services/assignment/common/assignmentService';
import { distinct } from 'vs/base/common/arrays';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { CellUri } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { disposableTimeout } from 'vs/base/common/async';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { ViewContainerLocation } from 'vs/workbench/common/views';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { areSameExtensions } from 'vs/platform/extensionManagement/common/extensionManagementUtil';

type FileExtensionSuggestionClassification = {
	userReaction: { classification: 'SystemMetaData'; purpose: 'FeatureInsight' };
	fileExtension: { classification: 'PublicNonPersonalData'; purpose: 'FeatureInsight' };
};

const promptedRecommendationsStorageKey = 'fileBasedRecommendations/promptedRecommendations';
const promptedFileExtensionsStorageKey = 'fileBasedRecommendations/promptedFileExtensions';
const recommendationsStorageKey = 'extensionsAssistant/recommendations';
const searchMarketplace = localize('searchMarketplace', "Search Marketplace");
const milliSecondsInADay = 1000 * 60 * 60 * 24;

export class FileBasedRecommendations extends ExtensionRecommendations {

	private readonly extensionTips = new Map<string, string>();
	private readonly importantExtensionTips = new Map<string, ImportantExtensionTip>();

	private readonly fileBasedRecommendationsByPattern = new Map<string, string[]>();
	private readonly fileBasedRecommendationsByLanguage = new Map<string, string[]>();
	private readonly fileBasedRecommendations = new Map<string, { recommendedTime: number }>();
	private readonly processedFileExtensions: string[] = [];
	private readonly processedLanguages: string[] = [];

	get recommendations(): ReadonlyArray<ExtensionRecommendation> {
		const recommendations: ExtensionRecommendation[] = [];
		[...this.fileBasedRecommendations.keys()]
			.sort((a, b) => {
				if (this.fileBasedRecommendations.get(a)!.recommendedTime === this.fileBasedRecommendations.get(b)!.recommendedTime) {
					if (this.importantExtensionTips.has(a)) {
						return -1;
					}
					if (this.importantExtensionTips.has(b)) {
						return 1;
					}
				}
				return this.fileBasedRecommendations.get(a)!.recommendedTime > this.fileBasedRecommendations.get(b)!.recommendedTime ? -1 : 1;
			})
			.forEach(extensionId => {
				recommendations.push({
					extensionId,
					reason: {
						reasonId: ExtensionRecommendationReason.File,
						reasonText: localize('fileBasedRecommendation', "This extension is recommended based on the files you recently opened.")
					}
				});
			});
		return recommendations;
	}

	get importantRecommendations(): ReadonlyArray<ExtensionRecommendation> {
		return this.recommendations.filter(e => this.importantExtensionTips.has(e.extensionId));
	}

	get otherRecommendations(): ReadonlyArray<ExtensionRecommendation> {
		return this.recommendations.filter(e => !this.importantExtensionTips.has(e.extensionId));
	}

	constructor(
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IPaneCompositePartService private readonly paneCompositeService: IPaneCompositePartService,
		@IModelService private readonly modelService: IModelService,
		@ILanguageService private readonly languageService: ILanguageService,
		@IProductService productService: IProductService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IStorageService private readonly storageService: IStorageService,
		@IExtensionRecommendationNotificationService private readonly extensionRecommendationNotificationService: IExtensionRecommendationNotificationService,
		@IExtensionIgnoredRecommendationsService private readonly extensionIgnoredRecommendationsService: IExtensionIgnoredRecommendationsService,
		@IWorkbenchAssignmentService private readonly tasExperimentService: IWorkbenchAssignmentService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService,
	) {
		super();

		this.tasExperimentService = tasExperimentService;

		if (productService.extensionTips) {
			forEach(productService.extensionTips, ({ key, value }) => this.extensionTips.set(key.toLowerCase(), value));
		}
		if (productService.extensionImportantTips) {
			forEach(productService.extensionImportantTips, ({ key, value }) => this.importantExtensionTips.set(key.toLowerCase(), value));
		}
	}

	protected async doActivate(): Promise<void> {
		await this.extensionService.whenInstalledExtensionsRegistered();

		const allRecommendations: string[] = [];

		// group extension recommendations by pattern, like {**/*.md} -> [ext.foo1, ext.bar2]
		for (const [extensionId, pattern] of this.extensionTips) {
			const ids = this.fileBasedRecommendationsByPattern.get(pattern) || [];
			ids.push(extensionId);
			this.fileBasedRecommendationsByPattern.set(pattern, ids);
			allRecommendations.push(extensionId);
		}
		for (const [extensionId, value] of this.importantExtensionTips) {
			if (value.pattern) {
				const ids = this.fileBasedRecommendationsByPattern.get(value.pattern) || [];
				ids.push(extensionId);
				this.fileBasedRecommendationsByPattern.set(value.pattern, ids);
			}
			if (value.languages) {
				for (const language of value.languages) {
					const ids = this.fileBasedRecommendationsByLanguage.get(language) || [];
					ids.push(extensionId);
					this.fileBasedRecommendationsByLanguage.set(language, ids);
				}
			}
			allRecommendations.push(extensionId);
		}

		const cachedRecommendations = this.getCachedRecommendations();
		const now = Date.now();
		// Retire existing recommendations if they are older than a week or are not part of this.productService.extensionTips anymore
		forEach(cachedRecommendations, ({ key, value }) => {
			const diff = (now - value) / milliSecondsInADay;
			if (diff <= 7 && allRecommendations.indexOf(key) > -1) {
				this.fileBasedRecommendations.set(key.toLowerCase(), { recommendedTime: value });
			}
		});

		this._register(this.modelService.onModelAdded(model => this.onModelAdded(model)));
		this.modelService.getModels().forEach(model => this.onModelAdded(model));
	}

	private onModelAdded(model: ITextModel): void {
		const uri = model.uri.scheme === Schemas.vscodeNotebookCell ? CellUri.parse(model.uri)?.notebook : model.uri;
		if (!uri) {
			return;
		}

		const supportedSchemes = distinct([Schemas.untitled, Schemas.file, Schemas.vscodeRemote, ...this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri.scheme)]);
		if (!uri || !supportedSchemes.includes(uri.scheme)) {
			return;
		}

		this.promptRecommendationsForModel(model);
		const disposables = new DisposableStore();
		disposables.add(model.onDidChangeLanguage(() => this.promptRecommendationsForModel(model)));
		disposables.add(model.onWillDispose(() => disposables.dispose()));
	}

	/**
	 * Prompt the user to either install the recommended extension for the file type in the current editor model
	 * or prompt to search the marketplace if it has extensions that can support the file type
	 */
	private promptRecommendationsForModel(model: ITextModel): void {
		const uri = model.uri;
		const language = model.getLanguageId();
		const fileExtension = extname(uri).toLowerCase();
		if (this.processedLanguages.includes(language) && this.processedFileExtensions.includes(fileExtension)) {
			return;
		}

		this.processedLanguages.push(language);
		this.processedFileExtensions.push(fileExtension);

		// re-schedule this bit of the operation to be off the critical path - in case glob-match is slow
		this._register(disposableTimeout(() => this.promptRecommendations(uri, language, fileExtension), 0));
	}

	private async promptRecommendations(uri: URI, language: string, fileExtension: string): Promise<void> {
		const installed = await this.extensionsWorkbenchService.queryLocal();
		const importantRecommendations: string[] = (this.fileBasedRecommendationsByLanguage.get(language) || [])
			.filter(extensionId => {
				const importantTip = this.importantExtensionTips.get(extensionId);
				if (importantTip) {
					return !importantTip.whenNotInstalled || importantTip.whenNotInstalled.every(id => installed.every(local => !areSameExtensions(local.identifier, { id })));
				}
				return false;
			});
		let languageName: string | null = importantRecommendations.length ? this.languageService.getLanguageName(language) : null;

		const fileBasedRecommendations: string[] = [...importantRecommendations];
		for (let [pattern, extensionIds] of this.fileBasedRecommendationsByPattern) {
			extensionIds = extensionIds.filter(extensionId => !importantRecommendations.includes(extensionId));
			if (!extensionIds.length) {
				continue;
			}
			if (!match(pattern, uri.with({ fragment: '' }).toString())) {
				continue;
			}
			for (const extensionId of extensionIds) {
				fileBasedRecommendations.push(extensionId);
				const importantExtensionTip = this.importantExtensionTips.get(extensionId);
				if (importantExtensionTip && importantExtensionTip.pattern === pattern) {
					importantRecommendations.push(extensionId);
				}
			}
		}

		// Update file based recommendations
		for (const recommendation of fileBasedRecommendations) {
			const filedBasedRecommendation = this.fileBasedRecommendations.get(recommendation) || { recommendedTime: Date.now(), sources: [] };
			filedBasedRecommendation.recommendedTime = Date.now();
			this.fileBasedRecommendations.set(recommendation, filedBasedRecommendation);
		}

		this.storeCachedRecommendations();

		if (this.extensionRecommendationNotificationService.hasToIgnoreRecommendationNotifications()) {
			return;
		}

		if (importantRecommendations.length &&
			await this.promptRecommendedExtensionForFileType(languageName || basename(uri), language, importantRecommendations, installed)) {
			return;
		}

		this.promptRecommendedExtensionForFileExtension(uri, fileExtension, installed);
	}

	private async promptRecommendedExtensionForFileType(name: string, language: string, recommendations: string[], installed: IExtension[]): Promise<boolean> {

		recommendations = this.filterIgnoredOrNotAllowed(recommendations);
		if (recommendations.length === 0) {
			return false;
		}

		recommendations = this.filterInstalled(recommendations, installed);
		if (recommendations.length === 0) {
			return false;
		}

		const extensionId = recommendations[0];
		const entry = this.importantExtensionTips.get(extensionId);
		if (!entry) {
			return false;
		}

		const promptedRecommendations = this.getPromptedRecommendations();
		if (promptedRecommendations[language] && promptedRecommendations[language].includes(extensionId)) {
			return false;
		}

		const treatmentMessage = await this.tasExperimentService.getTreatment<string>('languageRecommendationMessage');
		const message = treatmentMessage ? treatmentMessage.replace('{0}', name) : localize('reallyRecommended', "Do you want to install the recommended extensions for {0}?", name);

		this.extensionRecommendationNotificationService.promptImportantExtensionsInstallNotification([extensionId], message, `@id:${extensionId}`, RecommendationSource.FILE)
			.then(result => {
				if (result === RecommendationsNotificationResult.Accepted) {
					this.addToPromptedRecommendations(language, [extensionId]);
				}
			});
		return true;
	}

	private getPromptedRecommendations(): IStringDictionary<string[]> {
		return JSON.parse(this.storageService.get(promptedRecommendationsStorageKey, StorageScope.GLOBAL, '{}'));
	}

	private addToPromptedRecommendations(exeName: string, extensions: string[]) {
		const promptedRecommendations = this.getPromptedRecommendations();
		promptedRecommendations[exeName] = extensions;
		this.storageService.store(promptedRecommendationsStorageKey, JSON.stringify(promptedRecommendations), StorageScope.GLOBAL, StorageTarget.USER);
	}

	private getPromptedFileExtensions(): string[] {
		return JSON.parse(this.storageService.get(promptedFileExtensionsStorageKey, StorageScope.GLOBAL, '[]'));
	}

	private addToPromptedFileExtensions(fileExtension: string) {
		const promptedFileExtensions = this.getPromptedFileExtensions();
		promptedFileExtensions.push(fileExtension);
		this.storageService.store(promptedFileExtensionsStorageKey, JSON.stringify(distinct(promptedFileExtensions)), StorageScope.GLOBAL, StorageTarget.USER);
	}

	private async promptRecommendedExtensionForFileExtension(uri: URI, fileExtension: string, installed: IExtension[]): Promise<void> {
		// Do not prompt when there is no local and remote extension management servers
		if (!this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer) {
			return;
		}

		fileExtension = fileExtension.substring(1); // Strip the dot
		if (!fileExtension) {
			return;
		}

		const mimeTypes = getMimeTypes(uri);
		if (mimeTypes.length !== 1 || mimeTypes[0] !== Mimes.unknown) {
			return;
		}

		const fileExtensionSuggestionIgnoreList = <string[]>JSON.parse(this.storageService.get('extensionsAssistant/fileExtensionsSuggestionIgnore', StorageScope.GLOBAL, '[]'));
		if (fileExtensionSuggestionIgnoreList.indexOf(fileExtension) > -1) {
			return;
		}

		const promptedFileExtensions = this.getPromptedFileExtensions();
		if (promptedFileExtensions.includes(fileExtension)) {
			return;
		}

		const text = `ext:${fileExtension}`;
		const pager = await this.extensionsWorkbenchService.queryGallery({ text, pageSize: 100 }, CancellationToken.None);
		if (pager.firstPage.length === 0) {
			return;
		}

		const installedExtensionsIds = installed.reduce((result, i) => { result.add(i.identifier.id.toLowerCase()); return result; }, new Set<string>());
		if (pager.firstPage.some(e => installedExtensionsIds.has(e.identifier.id.toLowerCase()))) {
			return;
		}

		this.notificationService.prompt(
			Severity.Info,
			localize('showLanguageExtensions', "The Marketplace has extensions that can help with '.{0}' files", fileExtension),
			[{
				label: searchMarketplace,
				run: () => {
					this.addToPromptedFileExtensions(fileExtension);
					this.telemetryService.publicLog2<{ userReaction: string; fileExtension: string }, FileExtensionSuggestionClassification>('fileExtensionSuggestion:popup', { userReaction: 'ok', fileExtension });
					this.paneCompositeService.openPaneComposite(EXTENSIONS_VIEWLET_ID, ViewContainerLocation.Sidebar, true)
						.then(viewlet => viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer)
						.then(viewlet => {
							viewlet.search(`ext:${fileExtension}`);
							viewlet.focus();
						});
				}
			}, {
				label: localize('dontShowAgainExtension', "Don't Show Again for '.{0}' files", fileExtension),
				run: () => {
					fileExtensionSuggestionIgnoreList.push(fileExtension);
					this.storageService.store(
						'extensionsAssistant/fileExtensionsSuggestionIgnore',
						JSON.stringify(fileExtensionSuggestionIgnoreList),
						StorageScope.GLOBAL,
						StorageTarget.USER);
					this.telemetryService.publicLog2<{ userReaction: string; fileExtension: string }, FileExtensionSuggestionClassification>('fileExtensionSuggestion:popup', { userReaction: 'neverShowAgain', fileExtension });
				}
			}],
			{
				sticky: true,
				onCancel: () => {
					this.telemetryService.publicLog2<{ userReaction: string; fileExtension: string }, FileExtensionSuggestionClassification>('fileExtensionSuggestion:popup', { userReaction: 'cancelled', fileExtension });
				}
			}
		);
	}

	private filterIgnoredOrNotAllowed(recommendationsToSuggest: string[]): string[] {
		const ignoredRecommendations = [...this.extensionIgnoredRecommendationsService.ignoredRecommendations, ...this.extensionRecommendationNotificationService.ignoredRecommendations];
		return recommendationsToSuggest.filter(id => !ignoredRecommendations.includes(id));
	}

	private filterInstalled(recommendationsToSuggest: string[], installed: IExtension[]): string[] {
		const installedExtensionsIds = installed.reduce((result, i) => {
			if (i.enablementState !== EnablementState.DisabledByExtensionKind) {
				result.add(i.identifier.id.toLowerCase());
			}
			return result;
		}, new Set<string>());
		return recommendationsToSuggest.filter(id => !installedExtensionsIds.has(id.toLowerCase()));
	}

	private getCachedRecommendations(): IStringDictionary<number> {
		let storedRecommendations = JSON.parse(this.storageService.get(recommendationsStorageKey, StorageScope.GLOBAL, '[]'));
		if (Array.isArray(storedRecommendations)) {
			storedRecommendations = storedRecommendations.reduce((result, id) => { result[id] = Date.now(); return result; }, <IStringDictionary<number>>{});
		}
		const result: IStringDictionary<number> = {};
		forEach(storedRecommendations, ({ key, value }) => {
			if (typeof value === 'number') {
				result[key.toLowerCase()] = value;
			}
		});
		return result;
	}

	private storeCachedRecommendations(): void {
		const storedRecommendations: IStringDictionary<number> = {};
		this.fileBasedRecommendations.forEach((value, key) => storedRecommendations[key] = value.recommendedTime);
		this.storageService.store(recommendationsStorageKey, JSON.stringify(storedRecommendations), StorageScope.GLOBAL, StorageTarget.MACHINE);
	}
}
