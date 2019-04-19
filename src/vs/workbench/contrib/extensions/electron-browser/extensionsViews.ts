/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { dispose, Disposable } from 'vs/base/common/lifecycle';
import { assign } from 'vs/base/common/objects';
import { Event, Emitter } from 'vs/base/common/event';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import { PagedModel, IPagedModel, IPager, DelayedPagedModel } from 'vs/base/common/paging';
import { SortBy, SortOrder, IQueryOptions, IExtensionTipsService, IExtensionRecommendation, IExtensionManagementServer, IExtensionManagementServerService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { areSameExtensions } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { append, $, toggleClass } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Delegate, Renderer, IExtensionsViewState } from 'vs/workbench/contrib/extensions/electron-browser/extensionsList';
import { IExtension, IExtensionsWorkbenchService } from '../common/extensions';
import { Query } from '../common/extensionQuery';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachBadgeStyler } from 'vs/platform/theme/common/styler';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { OpenGlobalSettingsAction } from 'vs/workbench/contrib/preferences/browser/preferencesActions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { CountBadge } from 'vs/base/browser/ui/countBadge/countBadge';
import { ActionBar, Separator } from 'vs/base/browser/ui/actionbar/actionbar';
import { InstallWorkspaceRecommendedExtensionsAction, ConfigureWorkspaceFolderRecommendedExtensionsAction, ManageExtensionAction } from 'vs/workbench/contrib/extensions/electron-browser/extensionsActions';
import { WorkbenchPagedList } from 'vs/platform/list/browser/listService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { distinct, coalesce } from 'vs/base/common/arrays';
import { IExperimentService, IExperiment, ExperimentActionType } from 'vs/workbench/contrib/experiments/node/experimentService';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { IListContextMenuEvent } from 'vs/base/browser/ui/list/list';
import { createErrorWithActions } from 'vs/base/common/errorsWithActions';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IAction } from 'vs/base/common/actions';
import { ExtensionType, ExtensionIdentifier, IExtensionDescription, isLanguagePackExtension } from 'vs/platform/extensions/common/extensions';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import product from 'vs/platform/product/node/product';
import { CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { ILabelService } from 'vs/platform/label/common/label';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { REMOTE_HOST_SCHEME } from 'vs/platform/remote/common/remoteHosts';

class ExtensionsViewState extends Disposable implements IExtensionsViewState {

	private readonly _onFocus: Emitter<IExtension> = this._register(new Emitter<IExtension>());
	readonly onFocus: Event<IExtension> = this._onFocus.event;

	private readonly _onBlur: Emitter<IExtension> = this._register(new Emitter<IExtension>());
	readonly onBlur: Event<IExtension> = this._onBlur.event;

	private currentlyFocusedItems: IExtension[] = [];

	onFocusChange(extensions: IExtension[]): void {
		this.currentlyFocusedItems.forEach(extension => this._onBlur.fire(extension));
		this.currentlyFocusedItems = extensions;
		this.currentlyFocusedItems.forEach(extension => this._onFocus.fire(extension));
	}
}

export interface ExtensionsListViewOptions extends IViewletViewOptions {
	server?: IExtensionManagementServer;
}

export class ExtensionsListView extends ViewletPanel {

	private readonly server: IExtensionManagementServer | undefined;
	private messageBox: HTMLElement;
	private extensionsList: HTMLElement;
	private badge: CountBadge;
	protected badgeContainer: HTMLElement;
	private list: WorkbenchPagedList<IExtension> | null;
	private queryRequest: { query: string, request: CancelablePromise<IPagedModel<IExtension>> } | null;

	constructor(
		options: ExtensionsListViewOptions,
		@INotificationService protected notificationService: INotificationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IThemeService private readonly themeService: IThemeService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IExtensionsWorkbenchService protected extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IEditorService private readonly editorService: IEditorService,
		@IExtensionTipsService protected tipsService: IExtensionTipsService,
		@IModeService private readonly modeService: IModeService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspaceContextService protected contextService: IWorkspaceContextService,
		@IExperimentService private readonly experimentService: IExperimentService,
		@IWorkbenchThemeService private readonly workbenchThemeService: IWorkbenchThemeService,
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService
	) {
		super({ ...(options as IViewletPanelOptions), ariaHeaderLabel: options.title }, keybindingService, contextMenuService, configurationService);
		this.server = options.server;
	}

	protected renderHeader(container: HTMLElement): void {
		this.renderHeaderTitle(container);
	}

	renderHeaderTitle(container: HTMLElement): void {
		super.renderHeaderTitle(container, this.title);

		this.badgeContainer = append(container, $('.count-badge-wrapper'));
		this.badge = new CountBadge(this.badgeContainer);
		this.disposables.push(attachBadgeStyler(this.badge, this.themeService));
	}

	renderBody(container: HTMLElement): void {
		this.extensionsList = append(container, $('.extensions-list'));
		this.messageBox = append(container, $('.message'));
		const delegate = new Delegate();
		const extensionsViewState = new ExtensionsViewState();
		const renderer = this.instantiationService.createInstance(Renderer, extensionsViewState);
		this.list = this.instantiationService.createInstance(WorkbenchPagedList, this.extensionsList, delegate, [renderer], {
			ariaLabel: localize('extensions', "Extensions"),
			multipleSelectionSupport: false,
			setRowLineHeight: false,
			horizontalScrolling: false
		}) as WorkbenchPagedList<IExtension>;
		this.list.onContextMenu(e => this.onContextMenu(e), this, this.disposables);
		this.list.onFocusChange(e => extensionsViewState.onFocusChange(coalesce(e.elements)), this, this.disposables);
		this.disposables.push(this.list);
		this.disposables.push(extensionsViewState);

		Event.chain(this.list.onOpen)
			.map(e => e.elements[0])
			.filter(e => !!e)
			.on(this.openExtension, this, this.disposables);

		Event.chain(this.list.onPin)
			.map(e => e.elements[0])
			.filter(e => !!e)
			.on(this.pin, this, this.disposables);
	}

	protected layoutBody(height: number, width: number): void {
		this.extensionsList.style.height = height + 'px';
		if (this.list) {
			this.list.layout(height, width);
		}
	}

	async show(query: string): Promise<IPagedModel<IExtension>> {
		if (this.queryRequest) {
			if (this.queryRequest.query === query) {
				return this.queryRequest.request;
			}
			this.queryRequest.request.cancel();
			this.queryRequest = null;
		}

		const parsedQuery = Query.parse(query);

		let options: IQueryOptions = {
			sortOrder: SortOrder.Default
		};

		switch (parsedQuery.sortBy) {
			case 'installs': options = assign(options, { sortBy: SortBy.InstallCount }); break;
			case 'rating': options = assign(options, { sortBy: SortBy.WeightedRating }); break;
			case 'name': options = assign(options, { sortBy: SortBy.Title }); break;
		}

		const successCallback = (model: IPagedModel<IExtension>) => {
			this.queryRequest = null;
			this.setModel(model);
			return model;
		};


		const errorCallback = (e: Error) => {
			const model = new PagedModel([]);
			if (!isPromiseCanceledError(e)) {
				this.queryRequest = null;
				console.warn('Error querying extensions gallery', e);
				this.setModel(model, true);
			}
			return this.list ? this.list.model : model;
		};

		const request = createCancelablePromise(token => this.query(parsedQuery, options, token).then(successCallback).catch(errorCallback));
		this.queryRequest = { query, request };
		return request;
	}

	count(): number {
		return this.list ? this.list.length : 0;
	}

	protected showEmptyModel(): Promise<IPagedModel<IExtension>> {
		const emptyModel = new PagedModel([]);
		this.setModel(emptyModel);
		return Promise.resolve(emptyModel);
	}

	private async onContextMenu(e: IListContextMenuEvent<IExtension>): Promise<void> {
		if (e.element) {
			const runningExtensions = await this.extensionService.getExtensions();
			const colorThemes = await this.workbenchThemeService.getColorThemes();
			const fileIconThemes = await this.workbenchThemeService.getFileIconThemes();
			const manageExtensionAction = this.instantiationService.createInstance(ManageExtensionAction);
			manageExtensionAction.extension = e.element;
			const groups = manageExtensionAction.getActionGroups(runningExtensions, colorThemes, fileIconThemes);
			let actions: IAction[] = [];
			for (const menuActions of groups) {
				actions = [...actions, ...menuActions, new Separator()];
			}
			if (manageExtensionAction.enabled) {
				this.contextMenuService.showContextMenu({
					getAnchor: () => e.anchor,
					getActions: () => actions.slice(0, actions.length - 1)
				});
			}
		}
	}

	private async query(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const idRegex = /@id:(([a-z0-9A-Z][a-z0-9\-A-Z]*)\.([a-z0-9A-Z][a-z0-9\-A-Z]*))/g;
		const ids: string[] = [];
		let idMatch;
		while ((idMatch = idRegex.exec(query.value)) !== null) {
			const name = idMatch[1];
			ids.push(name);
		}
		if (ids.length) {
			return this.queryByIds(ids, options, token);
		}
		if (ExtensionsListView.isLocalExtensionsQuery(query.value) || /@builtin/.test(query.value)) {
			return this.queryLocal(query, options);
		}
		return this.queryGallery(query, options, token);
	}

	private async queryByIds(ids: string[], options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const idsSet: Set<string> = ids.reduce((result, id) => { result.add(id.toLowerCase()); return result; }, new Set<string>());
		const result = (await this.extensionsWorkbenchService.queryLocal(this.server))
			.filter(e => idsSet.has(e.identifier.id.toLowerCase()));

		if (result.length) {
			return this.getPagedModel(this.sortExtensions(result, options));
		}

		return this.extensionsWorkbenchService.queryGallery({ names: ids, source: 'queryById' }, token)
			.then(pager => this.getPagedModel(pager));
	}

	private async queryLocal(query: Query, options: IQueryOptions): Promise<IPagedModel<IExtension>> {
		let value = query.value;
		if (/@builtin/i.test(value)) {
			const showThemesOnly = /@builtin:themes/i.test(value);
			if (showThemesOnly) {
				value = value.replace(/@builtin:themes/g, '');
			}
			const showBasicsOnly = /@builtin:basics/i.test(value);
			if (showBasicsOnly) {
				value = value.replace(/@builtin:basics/g, '');
			}
			const showFeaturesOnly = /@builtin:features/i.test(value);
			if (showFeaturesOnly) {
				value = value.replace(/@builtin:features/g, '');
			}

			value = value.replace(/@builtin/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();
			let result = await this.extensionsWorkbenchService.queryLocal(this.server);

			result = result
				.filter(e => e.type === ExtensionType.System && (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1));

			if (showThemesOnly) {
				const themesExtensions = result.filter(e => {
					return e.local
						&& e.local.manifest
						&& e.local.manifest.contributes
						&& Array.isArray(e.local.manifest.contributes.themes)
						&& e.local.manifest.contributes.themes.length;
				});
				return this.getPagedModel(this.sortExtensions(themesExtensions, options));
			}
			if (showBasicsOnly) {
				const basics = result.filter(e => {
					return e.local && e.local.manifest
						&& e.local.manifest.contributes
						&& Array.isArray(e.local.manifest.contributes.grammars)
						&& e.local.manifest.contributes.grammars.length
						&& e.local.identifier.id !== 'vscode.git';
				});
				return this.getPagedModel(this.sortExtensions(basics, options));
			}
			if (showFeaturesOnly) {
				const others = result.filter(e => {
					return e.local
						&& e.local.manifest
						&& e.local.manifest.contributes
						&& (!Array.isArray(e.local.manifest.contributes.grammars) || e.local.identifier.id === 'vscode.git')
						&& !Array.isArray(e.local.manifest.contributes.themes);
				});
				return this.getPagedModel(this.sortExtensions(others, options));
			}

			return this.getPagedModel(this.sortExtensions(result, options));
		}

		const categories: string[] = [];
		value = value.replace(/\bcategory:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedCategory, category) => {
			const entry = (category || quotedCategory || '').toLowerCase();
			if (categories.indexOf(entry) === -1) {
				categories.push(entry);
			}
			return '';
		});

		if (/@installed/i.test(value)) {
			// Show installed extensions
			value = value.replace(/@installed/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();

			let result = await this.extensionsWorkbenchService.queryLocal(this.server);

			result = result
				.filter(e => e.type === ExtensionType.User
					&& (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1)
					&& (!categories.length || categories.some(category => (e.local && e.local.manifest.categories || []).some(c => c.toLowerCase() === category))));

			if (options.sortBy !== undefined) {
				result = this.sortExtensions(result, options);
			} else {
				const runningExtensions = await this.extensionService.getExtensions();
				const runningExtensionsById = runningExtensions.reduce((result, e) => { result.set(ExtensionIdentifier.toKey(e.identifier.value), e); return result; }, new Map<string, IExtensionDescription>());
				result = result.sort((e1, e2) => {
					const running1 = runningExtensionsById.get(ExtensionIdentifier.toKey(e1.identifier.id));
					const isE1Running = running1 && this.extensionManagementServerService.getExtensionManagementServer(running1.extensionLocation) === e1.server;
					const running2 = runningExtensionsById.get(ExtensionIdentifier.toKey(e2.identifier.id));
					const isE2Running = running2 && this.extensionManagementServerService.getExtensionManagementServer(running2.extensionLocation) === e2.server;
					if ((isE1Running && isE2Running) || (!isE1Running && !isE2Running)) {
						return e1.displayName.localeCompare(e2.displayName);
					}
					const isE1LanguagePackExtension = e1.local && isLanguagePackExtension(e1.local.manifest);
					const isE2LanguagePackExtension = e2.local && isLanguagePackExtension(e2.local.manifest);
					if ((isE1Running && isE2LanguagePackExtension) || (isE2Running && isE1LanguagePackExtension)) {
						return e1.displayName.localeCompare(e2.displayName);
					}
					return isE1Running ? -1 : 1;
				});
			}
			return this.getPagedModel(result);
		}


		if (/@outdated/i.test(value)) {
			value = value.replace(/@outdated/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();

			const local = await this.extensionsWorkbenchService.queryLocal(this.server);
			const result = local
				.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName))
				.filter(extension => extension.outdated
					&& (extension.name.toLowerCase().indexOf(value) > -1 || extension.displayName.toLowerCase().indexOf(value) > -1)
					&& (!categories.length || categories.some(category => !!extension.local && extension.local.manifest.categories!.some(c => c.toLowerCase() === category))));

			return this.getPagedModel(this.sortExtensions(result, options));
		}

		if (/@disabled/i.test(value)) {
			value = value.replace(/@disabled/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();

			const local = await this.extensionsWorkbenchService.queryLocal(this.server);
			const runningExtensions = await this.extensionService.getExtensions();

			const result = local
				.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName))
				.filter(e => runningExtensions.every(r => !areSameExtensions({ id: r.identifier.value }, e.identifier))
					&& (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1)
					&& (!categories.length || categories.some(category => (e.local && e.local.manifest.categories || []).some(c => c.toLowerCase() === category))));

			return this.getPagedModel(this.sortExtensions(result, options));
		}

		if (/@enabled/i.test(value)) {
			value = value ? value.replace(/@enabled/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase() : '';

			const local = (await this.extensionsWorkbenchService.queryLocal(this.server)).filter(e => e.type === ExtensionType.User);
			const runningExtensions = await this.extensionService.getExtensions();

			const result = local
				.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName))
				.filter(e => runningExtensions.some(r => areSameExtensions({ id: r.identifier.value }, e.identifier))
					&& (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1)
					&& (!categories.length || categories.some(category => (e.local && e.local.manifest.categories || []).some(c => c.toLowerCase() === category))));

			return this.getPagedModel(this.sortExtensions(result, options));
		}

		return new PagedModel([]);
	}

	private async queryGallery(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const hasUserDefinedSortOrder = options.sortBy !== undefined;
		if (!hasUserDefinedSortOrder && !query.value.trim()) {
			options.sortBy = SortBy.InstallCount;
		}

		if (ExtensionsListView.isWorkspaceRecommendedExtensionsQuery(query.value)) {
			return this.getWorkspaceRecommendationsModel(query, options, token);
		} else if (ExtensionsListView.isKeymapsRecommendedExtensionsQuery(query.value)) {
			return this.getKeymapRecommendationsModel(query, options, token);
		} else if (/@recommended:all/i.test(query.value) || ExtensionsListView.isSearchRecommendedExtensionsQuery(query.value)) {
			return this.getAllRecommendationsModel(query, options, token);
		} else if (ExtensionsListView.isRecommendedExtensionsQuery(query.value)) {
			return this.getRecommendationsModel(query, options, token);
			// {{SQL CARBON EDIT}}
		} else if (ExtensionsListView.isAllMarketplaceExtensionsQuery(query.value)) {
			return this.getAllMarketplaceModel(query, options, token);
		}

		if (/\bcurated:([^\s]+)\b/.test(query.value)) {
			return this.getCuratedModel(query, options, token);
		}

		let text = query.value;
		const extensionRegex = /\bext:([^\s]+)\b/g;

		if (extensionRegex.test(query.value)) {
			text = query.value.replace(extensionRegex, (m, ext) => {

				// Get curated keywords
				const lookup = product.extensionKeywords || {};
				const keywords = lookup[ext] || [];

				// Get mode name
				const modeId = this.modeService.getModeIdByFilepathOrFirstLine(`.${ext}`);
				const languageName = modeId && this.modeService.getLanguageName(modeId);
				const languageTag = languageName ? ` tag:"${languageName}"` : '';

				// Construct a rich query
				return `tag:"__ext_${ext}" tag:"__ext_.${ext}" ${keywords.map(tag => `tag:"${tag}"`).join(' ')}${languageTag} tag:"${ext}"`;
			});

			if (text !== query.value) {
				options = assign(options, { text: text.substr(0, 350), source: 'file-extension-tags' });
				return this.extensionsWorkbenchService.queryGallery(options, token).then(pager => this.getPagedModel(pager));
			}
		}

		let preferredResults: string[] = [];
		if (text) {
			options = assign(options, { text: text.substr(0, 350), source: 'searchText' });
			if (!hasUserDefinedSortOrder) {
				const searchExperiments = await this.getSearchExperiments();
				for (const experiment of searchExperiments) {
					if (experiment.action && text.toLowerCase() === experiment.action.properties['searchText'] && Array.isArray(experiment.action.properties['preferredResults'])) {
						preferredResults = experiment.action.properties['preferredResults'];
						options.source += `-experiment-${experiment.id}`;
						break;
					}
				}
			}
		} else {
			options.source = 'viewlet';
		}

		const pager = await this.extensionsWorkbenchService.queryGallery(options, token);

		let positionToUpdate = 0;
		for (const preferredResult of preferredResults) {
			for (let j = positionToUpdate; j < pager.firstPage.length; j++) {
				if (areSameExtensions(pager.firstPage[j].identifier, { id: preferredResult })) {
					if (positionToUpdate !== j) {
						const preferredExtension = pager.firstPage.splice(j, 1)[0];
						pager.firstPage.splice(positionToUpdate, 0, preferredExtension);
						positionToUpdate++;
					}
					break;
				}
			}
		}
		return this.getPagedModel(pager);

	}

	private _searchExperiments: Promise<IExperiment[]>;
	private getSearchExperiments(): Promise<IExperiment[]> {
		if (!this._searchExperiments) {
			this._searchExperiments = this.experimentService.getExperimentsByType(ExperimentActionType.ExtensionSearchResults);
		}
		return this._searchExperiments;
	}

	private sortExtensions(extensions: IExtension[], options: IQueryOptions): IExtension[] {
		switch (options.sortBy) {
			case SortBy.InstallCount:
				extensions = extensions.sort((e1, e2) => typeof e2.installCount === 'number' && typeof e1.installCount === 'number' ? e2.installCount - e1.installCount : NaN);
				break;
			case SortBy.AverageRating:
			case SortBy.WeightedRating:
				extensions = extensions.sort((e1, e2) => typeof e2.rating === 'number' && typeof e1.rating === 'number' ? e2.rating - e1.rating : NaN);
				break;
			default:
				extensions = extensions.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName));
				break;
		}
		if (options.sortOrder === SortOrder.Descending) {
			extensions = extensions.reverse();
		}
		return extensions;
	}

	// Get All types of recommendations, trimmed to show a max of 8 at any given time
	private getAllRecommendationsModel(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const value = query.value.replace(/@recommended:all/g, '').replace(/@recommended/g, '').trim().toLowerCase();

		return this.extensionsWorkbenchService.queryLocal(this.server)
			.then(result => result.filter(e => e.type === ExtensionType.User))
			.then(local => {
				const fileBasedRecommendations = this.tipsService.getFileBasedRecommendations();
				const othersPromise = this.tipsService.getOtherRecommendations();
				const workspacePromise = this.tipsService.getWorkspaceRecommendations();

				return Promise.all([othersPromise, workspacePromise])
					.then(([others, workspaceRecommendations]) => {
						const names = this.getTrimmedRecommendations(local, value, fileBasedRecommendations, others, workspaceRecommendations);
						const recommendationsWithReason = this.tipsService.getAllRecommendationsWithReason();
						/* __GDPR__
							"extensionAllRecommendations:open" : {
								"count" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
								"recommendations": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
							}
						*/
						this.telemetryService.publicLog('extensionAllRecommendations:open', {
							count: names.length,
							recommendations: names.map(id => {
								return {
									id,
									recommendationReason: recommendationsWithReason[id.toLowerCase()].reasonId
								};
							})
						});
						if (!names.length) {
							return Promise.resolve(new PagedModel([]));
						}
						options.source = 'recommendations-all';
						return this.extensionsWorkbenchService.queryGallery(assign(options, { names, pageSize: names.length }), token)
							.then(pager => {
								this.sortFirstPage(pager, names);
								return this.getPagedModel(pager || []);
							});
					});
			});
	}

	private async getCuratedModel(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const value = query.value.replace(/curated:/g, '').trim();
		const names = await this.experimentService.getCuratedExtensionsList(value);
		if (Array.isArray(names) && names.length) {
			options.source = `curated:${value}`;
			const pager = await this.extensionsWorkbenchService.queryGallery(assign(options, { names, pageSize: names.length }), token);
			this.sortFirstPage(pager, names);
			return this.getPagedModel(pager || []);
		}
		return new PagedModel([]);
	}

	// Get All types of recommendations other than Workspace recommendations, trimmed to show a max of 8 at any given time
	private getRecommendationsModel(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const value = query.value.replace(/@recommended/g, '').trim().toLowerCase();

		return this.extensionsWorkbenchService.queryLocal(this.server)
			.then(result => result.filter(e => e.type === ExtensionType.User))
			.then(local => {
				let fileBasedRecommendations = this.tipsService.getFileBasedRecommendations();
				const othersPromise = this.tipsService.getOtherRecommendations();
				const workspacePromise = this.tipsService.getWorkspaceRecommendations();

				return Promise.all([othersPromise, workspacePromise])
					.then(([others, workspaceRecommendations]) => {
						fileBasedRecommendations = fileBasedRecommendations.filter(x => workspaceRecommendations.every(({ extensionId }) => x.extensionId !== extensionId));
						others = others.filter(x => workspaceRecommendations.every(({ extensionId }) => x.extensionId !== extensionId));

						const names = this.getTrimmedRecommendations(local, value, fileBasedRecommendations, others, []);
						const recommendationsWithReason = this.tipsService.getAllRecommendationsWithReason();

						/* __GDPR__
							"extensionRecommendations:open" : {
								"count" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
								"recommendations": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
							}
						*/
						this.telemetryService.publicLog('extensionRecommendations:open', {
							count: names.length,
							recommendations: names.map(id => {
								return {
									id,
									recommendationReason: recommendationsWithReason[id.toLowerCase()].reasonId
								};
							})
						});

						if (!names.length) {
							return Promise.resolve(new PagedModel([]));
						}
						options.source = 'recommendations';
						return this.extensionsWorkbenchService.queryGallery(assign(options, { names, pageSize: names.length }), token)
							.then(pager => {
								this.sortFirstPage(pager, names);
								return this.getPagedModel(pager || []);
							});
					});
			});
	}

	// {{SQL CARBON EDIT}}
	private getAllMarketplaceModel(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const value = query.value.trim().toLowerCase();
		return this.extensionsWorkbenchService.queryLocal()
			.then(result => result.filter(e => e.type === ExtensionType.User))
			.then(local => {
				return this.tipsService.getOtherRecommendations().then((recommmended) => {
					const installedExtensions = local.map(x => `${x.publisher}.${x.name}`);
					options = assign(options, { text: value, source: 'searchText' });
					return this.extensionsWorkbenchService.queryGallery(options, token).then((pager) => {
						// filter out installed extensions
						pager.firstPage = pager.firstPage.filter((p) => {
							return installedExtensions.indexOf(`${p.publisher}.${p.name}`) === -1;
						});

						// sort the marketplace extensions
						pager.firstPage.sort((a, b) => {
							let isRecommendedA: boolean = recommmended.findIndex(ext => ext.extensionId === `${a.publisher}.${a.name}`) > -1;
							let isRecommendedB: boolean = recommmended.findIndex(ext => ext.extensionId === `${b.publisher}.${b.name}`) > -1;

							// sort recommeded extensions before other extensions
							if (isRecommendedA !== isRecommendedB) {
								return (isRecommendedA && !isRecommendedB) ? -1 : 1;
							}

							// otherwise sort by name
							return a.displayName.toLowerCase() < b.displayName.toLowerCase() ? -1 : 1;
						});
						pager.total = pager.firstPage.length;
						pager.pageSize = pager.firstPage.length;
						return this.getPagedModel(pager);
					});
				});
			});
	}

	// Given all recommendations, trims and returns recommendations in the relevant order after filtering out installed extensions
	private getTrimmedRecommendations(installedExtensions: IExtension[], value: string, fileBasedRecommendations: IExtensionRecommendation[], otherRecommendations: IExtensionRecommendation[], workpsaceRecommendations: IExtensionRecommendation[]): string[] {
		const totalCount = 8;
		workpsaceRecommendations = workpsaceRecommendations
			.filter(recommendation => {
				return !this.isRecommendationInstalled(recommendation, installedExtensions)
					&& recommendation.extensionId.toLowerCase().indexOf(value) > -1;
			});
		fileBasedRecommendations = fileBasedRecommendations.filter(recommendation => {
			return !this.isRecommendationInstalled(recommendation, installedExtensions)
				&& workpsaceRecommendations.every(workspaceRecommendation => workspaceRecommendation.extensionId !== recommendation.extensionId)
				&& recommendation.extensionId.toLowerCase().indexOf(value) > -1;
		});
		otherRecommendations = otherRecommendations.filter(recommendation => {
			return !this.isRecommendationInstalled(recommendation, installedExtensions)
				&& fileBasedRecommendations.every(fileBasedRecommendation => fileBasedRecommendation.extensionId !== recommendation.extensionId)
				&& workpsaceRecommendations.every(workspaceRecommendation => workspaceRecommendation.extensionId !== recommendation.extensionId)
				&& recommendation.extensionId.toLowerCase().indexOf(value) > -1;
		});

		const otherCount = Math.min(2, otherRecommendations.length);
		const fileBasedCount = Math.min(fileBasedRecommendations.length, totalCount - workpsaceRecommendations.length - otherCount);
		const recommendations = workpsaceRecommendations;
		recommendations.push(...fileBasedRecommendations.splice(0, fileBasedCount));
		recommendations.push(...otherRecommendations.splice(0, otherCount));

		return distinct(recommendations.map(({ extensionId }) => extensionId));
	}

	private isRecommendationInstalled(recommendation: IExtensionRecommendation, installed: IExtension[]): boolean {
		return installed.some(i => areSameExtensions(i.identifier, { id: recommendation.extensionId }));
	}

	private getWorkspaceRecommendationsModel(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const value = query.value.replace(/@recommended:workspace/g, '').trim().toLowerCase();
		return this.tipsService.getWorkspaceRecommendations()
			.then(recommendations => {
				const names = recommendations.map(({ extensionId }) => extensionId).filter(name => name.toLowerCase().indexOf(value) > -1);
				/* __GDPR__
					"extensionWorkspaceRecommendations:open" : {
						"count" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
					}
				*/
				this.telemetryService.publicLog('extensionWorkspaceRecommendations:open', { count: names.length });

				if (!names.length) {
					return Promise.resolve(new PagedModel([]));
				}
				options.source = 'recommendations-workspace';
				return this.extensionsWorkbenchService.queryGallery(assign(options, { names, pageSize: names.length }), token)
					.then(pager => this.getPagedModel(pager || []));
			});
	}

	private getKeymapRecommendationsModel(query: Query, options: IQueryOptions, token: CancellationToken): Promise<IPagedModel<IExtension>> {
		const value = query.value.replace(/@recommended:keymaps/g, '').trim().toLowerCase();
		const names: string[] = this.tipsService.getKeymapRecommendations().map(({ extensionId }) => extensionId)
			.filter(extensionId => extensionId.toLowerCase().indexOf(value) > -1);

		if (!names.length) {
			return Promise.resolve(new PagedModel([]));
		}
		options.source = 'recommendations-keymaps';
		return this.extensionsWorkbenchService.queryGallery(assign(options, { names, pageSize: names.length }), token)
			.then(result => this.getPagedModel(result));
	}

	// Sorts the firstPage of the pager in the same order as given array of extension ids
	private sortFirstPage(pager: IPager<IExtension>, ids: string[]) {
		ids = ids.map(x => x.toLowerCase());
		pager.firstPage.sort((a, b) => {
			return ids.indexOf(a.identifier.id.toLowerCase()) < ids.indexOf(b.identifier.id.toLowerCase()) ? -1 : 1;
		});
	}

	private setModel(model: IPagedModel<IExtension>, isGalleryError?: boolean) {
		if (this.list) {
			this.list.model = new DelayedPagedModel(model);
			this.list.scrollTop = 0;
			const count = this.count();

			toggleClass(this.extensionsList, 'hidden', count === 0);
			toggleClass(this.messageBox, 'hidden', count > 0);
			this.badge.setCount(count);

			if (count === 0 && this.isBodyVisible()) {
				this.messageBox.textContent = isGalleryError ? localize('galleryError', "We cannot connect to the Extensions Marketplace at this time, please try again later.") : localize('no extensions found', "No extensions found.");
				if (isGalleryError) {
					alert(this.messageBox.textContent);
				}
			} else {
				this.messageBox.textContent = '';
			}
		}
	}

	private openExtension(extension: IExtension): void {
		this.extensionsWorkbenchService.open(extension).then(undefined, err => this.onError(err));
	}

	private pin(): void {
		const activeControl = this.editorService.activeControl;
		if (activeControl) {
			activeControl.group.pinEditor(activeControl.input);
			activeControl.focus();
		}
	}

	private onError(err: any): void {
		if (isPromiseCanceledError(err)) {
			return;
		}

		const message = err && err.message || '';

		if (/ECONNREFUSED/.test(message)) {
			const error = createErrorWithActions(localize('suggestProxyError', "Marketplace returned 'ECONNREFUSED'. Please check the 'http.proxy' setting."), {
				actions: [
					this.instantiationService.createInstance(OpenGlobalSettingsAction, OpenGlobalSettingsAction.ID, OpenGlobalSettingsAction.LABEL)
				]
			});

			this.notificationService.error(error);
			return;
		}

		this.notificationService.error(err);
	}

	private getPagedModel(arg: IPager<IExtension> | IExtension[]): IPagedModel<IExtension> {
		if (Array.isArray(arg)) {
			return new PagedModel(arg);
		}
		const pager = {
			total: arg.total,
			pageSize: arg.pageSize,
			firstPage: arg.firstPage,
			getPage: (pageIndex: number, cancellationToken: CancellationToken) => arg.getPage(pageIndex, cancellationToken)
		};
		return new PagedModel(pager);
	}

	dispose(): void {
		super.dispose();
		if (this.queryRequest) {
			this.queryRequest.request.cancel();
			this.queryRequest = null;
		}
		this.disposables = dispose(this.disposables);
		this.list = null;
	}

	static isBuiltInExtensionsQuery(query: string): boolean {
		return /^\s*@builtin\s*$/i.test(query);
	}

	static isLocalExtensionsQuery(query: string): boolean {
		return this.isInstalledExtensionsQuery(query)
			|| this.isOutdatedExtensionsQuery(query)
			|| this.isEnabledExtensionsQuery(query)
			|| this.isDisabledExtensionsQuery(query)
			|| this.isBuiltInExtensionsQuery(query);
	}

	static isInstalledExtensionsQuery(query: string): boolean {
		return /@installed/i.test(query);
	}

	static isOutdatedExtensionsQuery(query: string): boolean {
		return /@outdated/i.test(query);
	}

	static isEnabledExtensionsQuery(query: string): boolean {
		return /@enabled/i.test(query);
	}

	static isDisabledExtensionsQuery(query: string): boolean {
		return /@disabled/i.test(query);
	}

	static isRecommendedExtensionsQuery(query: string): boolean {
		return /^@recommended$/i.test(query.trim());
	}

	static isSearchRecommendedExtensionsQuery(query: string): boolean {
		return /@recommended/i.test(query) && !ExtensionsListView.isRecommendedExtensionsQuery(query);
	}

	static isWorkspaceRecommendedExtensionsQuery(query: string): boolean {
		return /@recommended:workspace/i.test(query);
	}

	static isKeymapsRecommendedExtensionsQuery(query: string): boolean {
		return /@recommended:keymaps/i.test(query);
	}

	focus(): void {
		super.focus();
		if (!this.list) {
			return;
		}

		if (!(this.list.getFocus().length || this.list.getSelection().length)) {
			this.list.focusNext();
		}
		this.list.domFocus();
	}

	// {{SQL CARBON EDIT}}
	static isAllMarketplaceExtensionsQuery(query: string): boolean {
		return /@allmarketplace/i.test(query);
	}
}

function getViewTitleForServer(viewTitle: string, server: IExtensionManagementServer, labelService: ILabelService, workbenchEnvironmentService: IWorkbenchEnvironmentService): string {
	const serverLabel = workbenchEnvironmentService.configuration.remoteAuthority === server.authority ? labelService.getHostLabel(REMOTE_HOST_SCHEME, server.authority) || server.label : server.label;
	if (viewTitle && workbenchEnvironmentService.configuration.remoteAuthority) {
		return `${serverLabel} - ${viewTitle}`;
	}
	return viewTitle ? viewTitle : serverLabel;
}

export class ServerExtensionsView extends ExtensionsListView {

	constructor(
		server: IExtensionManagementServer,
		options: ExtensionsListViewOptions,
		@INotificationService notificationService: INotificationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IExtensionService extensionService: IExtensionService,
		@IEditorService editorService: IEditorService,
		@IExtensionTipsService tipsService: IExtensionTipsService,
		@IModeService modeService: IModeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IExperimentService experimentService: IExperimentService,
		@IWorkbenchThemeService workbenchThemeService: IWorkbenchThemeService,
		@IExtensionsWorkbenchService extensionsWorkbenchService: IExtensionsWorkbenchService,
		@ILabelService labelService: ILabelService,
		@IWorkbenchEnvironmentService workbenchEnvironmentService: IWorkbenchEnvironmentService,
		@IExtensionManagementServerService extensionManagementServerService: IExtensionManagementServerService
	) {
		const viewTitle = options.title;
		options.title = getViewTitleForServer(viewTitle, server, labelService, workbenchEnvironmentService);
		options.server = server;
		super(options, notificationService, keybindingService, contextMenuService, instantiationService, themeService, extensionService, extensionsWorkbenchService, editorService, tipsService, modeService, telemetryService, configurationService, contextService, experimentService, workbenchThemeService, extensionManagementServerService);
		this.disposables.push(labelService.onDidChangeFormatters(() => this.updateTitle(getViewTitleForServer(viewTitle, server, labelService, workbenchEnvironmentService))));
	}

	async show(query: string): Promise<IPagedModel<IExtension>> {
		query = query ? query : '@installed';
		if (!ExtensionsListView.isLocalExtensionsQuery(query) && !ExtensionsListView.isBuiltInExtensionsQuery(query)) {
			query = query += ' @installed';
		}
		return super.show(query.trim());
	}
}

export class EnabledExtensionsView extends ExtensionsListView {
	private readonly enabledExtensionsQuery = '@enabled';

	async show(query: string): Promise<IPagedModel<IExtension>> {
		return (query && query.trim() !== this.enabledExtensionsQuery) ? this.showEmptyModel() : super.show(this.enabledExtensionsQuery);
	}
}

export class DisabledExtensionsView extends ExtensionsListView {
	private readonly disabledExtensionsQuery = '@disabled';

	async show(query: string): Promise<IPagedModel<IExtension>> {
		return (query && query.trim() !== this.disabledExtensionsQuery) ? this.showEmptyModel() : super.show(this.disabledExtensionsQuery);
	}
}

export class BuiltInExtensionsView extends ExtensionsListView {
	async show(query: string): Promise<IPagedModel<IExtension>> {
		return (query && query.trim() !== '@builtin') ? this.showEmptyModel() : super.show('@builtin:features');
	}
}

export class BuiltInThemesExtensionsView extends ExtensionsListView {
	async show(query: string): Promise<IPagedModel<IExtension>> {
		return (query && query.trim() !== '@builtin') ? this.showEmptyModel() : super.show('@builtin:themes');
	}
}

export class BuiltInBasicsExtensionsView extends ExtensionsListView {
	async show(query: string): Promise<IPagedModel<IExtension>> {
		return (query && query.trim() !== '@builtin') ? this.showEmptyModel() : super.show('@builtin:basics');
	}
}

export class DefaultRecommendedExtensionsView extends ExtensionsListView {
	// {{SQL CARBON EDIT}}
	private readonly recommendedExtensionsQuery = '@allmarketplace';

	renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.disposables.push(this.tipsService.onRecommendationChange(() => {
			this.show('');
		}));
	}

	async show(query: string): Promise<IPagedModel<IExtension>> {
		if (query && query.trim() !== this.recommendedExtensionsQuery) {
			return this.showEmptyModel();
		}
		const model = await super.show(this.recommendedExtensionsQuery);
		if (!this.extensionsWorkbenchService.local.some(e => e.type === ExtensionType.User)) {
			// This is part of popular extensions view. Collapse if no installed extensions.
			this.setExpanded(model.length > 0);
		}
		return model;
	}

}

export class RecommendedExtensionsView extends ExtensionsListView {
	private readonly recommendedExtensionsQuery = '@recommended';

	renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.disposables.push(this.tipsService.onRecommendationChange(() => {
			this.show('');
		}));
	}

	async show(query: string): Promise<IPagedModel<IExtension>> {
		// {{SQL CARBON EDIT}}
		return super.show('@allmarketplace');
	}
}

export class WorkspaceRecommendedExtensionsView extends ExtensionsListView {
	private readonly recommendedExtensionsQuery = '@recommended:workspace';
	private installAllAction: InstallWorkspaceRecommendedExtensionsAction;

	renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.disposables.push(this.tipsService.onRecommendationChange(() => this.update()));
		this.disposables.push(this.extensionsWorkbenchService.onChange(() => this.setRecommendationsToInstall()));
		this.disposables.push(this.contextService.onDidChangeWorkbenchState(() => this.update()));
	}

	renderHeader(container: HTMLElement): void {
		super.renderHeader(container);

		const listActionBar = $('.list-actionbar-container');
		container.insertBefore(listActionBar, this.badgeContainer);

		const actionbar = new ActionBar(listActionBar, {
			animated: false
		});
		actionbar.onDidRun(({ error }) => error && this.notificationService.error(error));

		this.installAllAction = this.instantiationService.createInstance(InstallWorkspaceRecommendedExtensionsAction, InstallWorkspaceRecommendedExtensionsAction.ID, InstallWorkspaceRecommendedExtensionsAction.LABEL, []);
		const configureWorkspaceFolderAction = this.instantiationService.createInstance(ConfigureWorkspaceFolderRecommendedExtensionsAction, ConfigureWorkspaceFolderRecommendedExtensionsAction.ID, ConfigureWorkspaceFolderRecommendedExtensionsAction.LABEL);

		this.installAllAction.class = 'octicon octicon-cloud-download';
		configureWorkspaceFolderAction.class = 'octicon octicon-pencil';

		actionbar.push([this.installAllAction], { icon: true, label: false });
		actionbar.push([configureWorkspaceFolderAction], { icon: true, label: false });

		this.disposables.push(...[this.installAllAction, configureWorkspaceFolderAction, actionbar]);
	}

	async show(query: string): Promise<IPagedModel<IExtension>> {
		let shouldShowEmptyView = query && query.trim() !== '@recommended' && query.trim() !== '@recommended:workspace';
		let model = await (shouldShowEmptyView ? this.showEmptyModel() : super.show(this.recommendedExtensionsQuery));
		this.setExpanded(model.length > 0);
		return model;
	}

	private update(): void {
		this.show(this.recommendedExtensionsQuery);
		this.setRecommendationsToInstall();
	}

	private setRecommendationsToInstall(): Promise<void> {
		return this.getRecommendationsToInstall()
			.then(recommendations => { this.installAllAction.recommendations = recommendations; });
	}

	private getRecommendationsToInstall(): Promise<IExtensionRecommendation[]> {
		return this.tipsService.getWorkspaceRecommendations()
			.then(recommendations => recommendations.filter(({ extensionId }) => !this.extensionsWorkbenchService.local.some(i => areSameExtensions({ id: extensionId }, i.identifier))));
	}
}
