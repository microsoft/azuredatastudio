/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/extensionEditor';
import { localize } from 'vs/nls';
import { createCancelablePromise } from 'vs/base/common/async';
import * as arrays from 'vs/base/common/arrays';
import { OS } from 'vs/base/common/platform';
import { Event, Emitter } from 'vs/base/common/event';
import { Cache, CacheResult } from 'vs/base/common/cache';
import { Action, IAction } from 'vs/base/common/actions';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import { dispose, toDisposable, Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { domEvent } from 'vs/base/browser/event';
import { append, $, addClass, removeClass, finalHandler, join, toggleClass, hide, show, addDisposableListener, EventType } from 'vs/base/browser/dom';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionRecommendationsService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IExtensionManifest, IKeyBinding, IView, IViewContainer, ExtensionType } from 'vs/platform/extensions/common/extensions';
import { ResolvedKeybinding, KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { ExtensionsInput } from 'vs/workbench/contrib/extensions/common/extensionsInput';
import { IExtensionsWorkbenchService, IExtensionsViewPaneContainer, VIEWLET_ID, IExtension, ExtensionContainers } from 'vs/workbench/contrib/extensions/common/extensions';
import { /*RatingsWidget, InstallCountWidget, */RemoteBadgeWidget } from 'vs/workbench/contrib/extensions/browser/extensionsWidgets';
import { EditorOptions } from 'vs/workbench/common/editor';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { CombinedInstallAction, UpdateAction, ExtensionEditorDropDownAction, ReloadAction, MaliciousStatusLabelAction, IgnoreExtensionRecommendationAction, UndoIgnoreExtensionRecommendationAction, EnableDropDownAction, DisableDropDownAction, StatusLabelAction, SetFileIconThemeAction, SetColorThemeAction, RemoteInstallAction, ExtensionToolTipAction, SystemDisabledWarningAction, LocalInstallAction, SyncIgnoredIconAction, SetProductIconThemeAction } from 'vs/workbench/contrib/extensions/browser/extensionsActions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { IOpenerService, matchesScheme } from 'vs/platform/opener/common/opener';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { KeybindingLabel } from 'vs/base/browser/ui/keybindingLabel/keybindingLabel';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Color } from 'vs/base/common/color';
import { assign } from 'vs/base/common/objects';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ExtensionsTree, ExtensionData, ExtensionsGridView, getExtensions } from 'vs/workbench/contrib/extensions/browser/extensionsViewer';
import { ShowCurrentReleaseNotesActionId } from 'vs/workbench/contrib/update/common/update';
import { KeybindingParser } from 'vs/base/common/keybindingParser';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { getDefaultValue } from 'vs/platform/configuration/common/configurationRegistry';
import { isUndefined } from 'vs/base/common/types';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IWebviewService, Webview, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED } from 'vs/workbench/contrib/webview/browser/webview';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { renderDashboardContributions } from 'sql/workbench/contrib/extensions/browser/contributionRenders'; // {{SQL CARBON EDIT}}
import { generateUuid } from 'vs/base/common/uuid';
import { platform } from 'vs/base/common/process';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { renderMarkdownDocument } from 'vs/workbench/contrib/markdown/common/markdownDocumentRenderer';
import { IModeService } from 'vs/editor/common/services/modeService';
import { TokenizationRegistry } from 'vs/editor/common/modes';
import { generateTokensCSSForColorMap } from 'vs/editor/common/modes/supports/tokenization';
import { editorBackground } from 'vs/platform/theme/common/colorRegistry';
import { registerAction2, Action2 } from 'vs/platform/actions/common/actions';

function removeEmbeddedSVGs(documentContent: string): string {
	const newDocument = new DOMParser().parseFromString(documentContent, 'text/html');

	// remove all inline svgs
	const allSVGs = newDocument.documentElement.querySelectorAll('svg');
	if (allSVGs) {
		for (let i = 0; i < allSVGs.length; i++) {
			const svg = allSVGs[i];
			if (svg.parentNode) {
				svg.parentNode.removeChild(allSVGs[i]);
			}
		}
	}

	return newDocument.documentElement.outerHTML;
}

class NavBar extends Disposable {

	private _onChange = this._register(new Emitter<{ id: string | null, focus: boolean }>());
	get onChange(): Event<{ id: string | null, focus: boolean }> { return this._onChange.event; }

	private _currentId: string | null = null;
	get currentId(): string | null { return this._currentId; }

	private actions: Action[];
	private actionbar: ActionBar;

	constructor(container: HTMLElement) {
		super();
		const element = append(container, $('.navbar'));
		this.actions = [];
		this.actionbar = this._register(new ActionBar(element, { animated: false }));
	}

	push(id: string, label: string, tooltip: string): void {
		const action = new Action(id, label, undefined, true, () => this._update(id, true));

		action.tooltip = tooltip;

		this.actions.push(action);
		this.actionbar.push(action);

		if (this.actions.length === 1) {
			this._update(id);
		}
	}

	clear(): void {
		this.actions = dispose(this.actions);
		this.actionbar.clear();
	}

	update(): void {
		this._update(this._currentId);
	}

	_update(id: string | null = this._currentId, focus?: boolean): Promise<void> {
		this._currentId = id;
		this._onChange.fire({ id, focus: !!focus });
		this.actions.forEach(a => a.checked = a.id === id);
		return Promise.resolve(undefined);
	}
}

const NavbarSection = {
	Readme: 'readme',
	Contributions: 'contributions',
	Changelog: 'changelog',
	Dependencies: 'dependencies',
};

interface ILayoutParticipant {
	layout(): void;
}

interface IActiveElement {
	focus(): void;
}

interface IExtensionEditorTemplate {
	iconContainer: HTMLElement;
	icon: HTMLImageElement;
	name: HTMLElement;
	identifier: HTMLElement;
	preview: HTMLElement;
	builtin: HTMLElement;
	license: HTMLElement;
	version: HTMLElement;
	publisher: HTMLElement;
	// installCount: HTMLElement; // {{SQL CARBON EDIT}} remove install count widget
	// rating: HTMLElement; // {{SQL CARBON EDIT}} remove rating widget
	repository: HTMLElement;
	description: HTMLElement;
	extensionActionBar: ActionBar;
	navbar: NavBar;
	content: HTMLElement;
	subtextContainer: HTMLElement;
	subtext: HTMLElement;
	ignoreActionbar: ActionBar;
	header: HTMLElement;
}

export class ExtensionEditor extends BaseEditor {

	static readonly ID: string = 'workbench.editor.extension';

	private template: IExtensionEditorTemplate | undefined;

	private extensionReadme: Cache<string> | null;
	private extensionChangelog: Cache<string> | null;
	private extensionManifest: Cache<IExtensionManifest | null> | null;

	private layoutParticipants: ILayoutParticipant[] = [];
	private readonly contentDisposables = this._register(new DisposableStore());
	private readonly transientDisposables = this._register(new DisposableStore());
	private activeElement: IActiveElement | null = null;
	private editorLoadComplete: boolean = false;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IViewletService private readonly viewletService: IViewletService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IThemeService protected themeService: IThemeService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@INotificationService private readonly notificationService: INotificationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IExtensionRecommendationsService private readonly extensionRecommendationsService: IExtensionRecommendationsService,
		@IStorageService storageService: IStorageService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IWorkbenchThemeService private readonly workbenchThemeService: IWorkbenchThemeService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IModeService private readonly modeService: IModeService,
	) {
		super(ExtensionEditor.ID, telemetryService, themeService, storageService);
		this.extensionReadme = null;
		this.extensionChangelog = null;
		this.extensionManifest = null;
	}

	createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.extension-editor'));
		root.tabIndex = 0; // this is required for the focus tracker on the editor
		root.style.outline = 'none';
		root.setAttribute('role', 'document');
		const header = append(root, $('.header'));

		const iconContainer = append(header, $('.icon-container'));
		const icon = append(iconContainer, $<HTMLImageElement>('img.icon', { draggable: false }));

		const details = append(header, $('.details'));
		const title = append(details, $('.title'));
		const name = append(title, $('span.name.clickable', { title: localize('name', "Extension name"), role: 'heading', tabIndex: 0 }));
		const identifier = append(title, $('span.identifier', { title: localize('extension id', "Extension identifier") }));

		const preview = append(title, $('span.preview', { title: localize('preview', "Preview") }));
		preview.textContent = localize('preview', "Preview");

		const builtin = append(title, $('span.builtin'));
		builtin.textContent = localize('builtin', "Built-in");

		const subtitle = append(details, $('.subtitle'));
		const publisher = append(subtitle, $('span.publisher.clickable', { title: localize('publisher', "Publisher name"), tabIndex: 0 }));

		// {{SQL CARBON EDIT}} remove rating and install count widgets
		// const installCount = append(subtitle, $('span.install', { title: localize('install count', "Install count"), tabIndex: 0 }));

		// const rating = append(subtitle, $('span.rating.clickable', { title: localize('rating', "Rating"), tabIndex: 0 }));

		const repository = append(subtitle, $('span.repository.clickable'));
		repository.textContent = localize('repository', 'Repository');
		repository.style.display = 'none';
		repository.tabIndex = 0;

		const license = append(subtitle, $('span.license.clickable'));
		license.textContent = localize('license', 'License');
		license.style.display = 'none';
		license.tabIndex = 0;

		const version = append(subtitle, $('span.version'));
		version.textContent = localize('version', 'Version');

		const description = append(details, $('.description'));

		const extensionActions = append(details, $('.actions'));
		const extensionActionBar = this._register(new ActionBar(extensionActions, {
			animated: false,
			actionViewItemProvider: (action: IAction) => {
				if (action instanceof ExtensionEditorDropDownAction) {
					return action.createActionViewItem();
				}
				return undefined;
			}
		}));

		const subtextContainer = append(details, $('.subtext-container'));
		const subtext = append(subtextContainer, $('.subtext'));
		const ignoreActionbar = this._register(new ActionBar(subtextContainer, { animated: false }));

		this._register(Event.chain(extensionActionBar.onDidRun)
			.map(({ error }) => error)
			.filter(error => !!error)
			.on(this.onError, this));

		this._register(Event.chain(ignoreActionbar.onDidRun)
			.map(({ error }) => error)
			.filter(error => !!error)
			.on(this.onError, this));

		const body = append(root, $('.body'));
		const navbar = new NavBar(body);

		const content = append(body, $('.content'));

		this.template = {
			builtin,
			content,
			description,
			extensionActionBar,
			header,
			icon,
			iconContainer,
			identifier,
			version,
			ignoreActionbar,
			// installCount, // {{SQL CARBON EDIT}} remove install count widget
			license,
			name,
			navbar,
			preview,
			publisher,
			// rating, // {{SQL CARBON EDIT}} remove rating widget
			repository,
			subtext,
			subtextContainer
		};
	}

	private onClick(element: HTMLElement, callback: () => void): IDisposable {
		const disposables: DisposableStore = new DisposableStore();
		disposables.add(addDisposableListener(element, EventType.CLICK, finalHandler(callback)));
		disposables.add(addDisposableListener(element, EventType.KEY_UP, e => {
			const keyboardEvent = new StandardKeyboardEvent(e);
			if (keyboardEvent.equals(KeyCode.Space) || keyboardEvent.equals(KeyCode.Enter)) {
				e.preventDefault();
				e.stopPropagation();
				callback();
			}
		}));
		return disposables;
	}

	async setInput(input: ExtensionsInput, options: EditorOptions | undefined, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, token);
		if (this.template) {
			await this.updateTemplate(input, this.template, !!options?.preserveFocus);
		}
	}

	private async updateTemplate(input: ExtensionsInput, template: IExtensionEditorTemplate, preserveFocus: boolean): Promise<void> {
		const runningExtensions = await this.extensionService.getExtensions();

		this.activeElement = null;
		this.editorLoadComplete = false;
		const extension = input.extension;

		this.transientDisposables.clear();

		this.extensionReadme = new Cache(() => createCancelablePromise(token => extension.getReadme(token)));
		this.extensionChangelog = new Cache(() => createCancelablePromise(token => extension.getChangelog(token)));
		this.extensionManifest = new Cache(() => createCancelablePromise(token => extension.getManifest(token)));

		const remoteBadge = this.instantiationService.createInstance(RemoteBadgeWidget, template.iconContainer, true);
		const onError = Event.once(domEvent(template.icon, 'error'));
		onError(() => template.icon.src = extension.iconUrlFallback, null, this.transientDisposables);
		template.icon.src = extension.iconUrl;

		template.name.textContent = extension.displayName;
		template.identifier.textContent = extension.identifier.id;
		template.preview.style.display = extension.preview ? 'inherit' : 'none';
		template.builtin.style.display = extension.type === ExtensionType.System ? 'inherit' : 'none';

		template.publisher.textContent = extension.publisherDisplayName;
		template.version.textContent = extension.version;
		template.description.textContent = extension.description;

		const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
		let recommendationsData = {};
		if (extRecommendations[extension.identifier.id.toLowerCase()]) {
			recommendationsData = { recommendationReason: extRecommendations[extension.identifier.id.toLowerCase()].reasonId };
		}

		/* __GDPR__
		"extensionGallery:openExtension" : {
			"recommendationReason": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
			"${include}": [
				"${GalleryExtensionTelemetryData}"
			]
		}
		*/
		this.telemetryService.publicLog('extensionGallery:openExtension', assign(extension.telemetryData, recommendationsData));

		toggleClass(template.name, 'clickable', !!extension.url);
		toggleClass(template.publisher, 'clickable', !!extension.publisher); // {{SQL CARBON EDIT}} !!extension.url -> !!extension.publisher, for ADS we don't have marketplace website, but still want to make it clickable and filter extensions by publisher
		// toggleClass(template.rating, 'clickable', !!extension.url); // {{SQL CARBON EDIT}} remove rating widget
		if (extension.url) {
			this.transientDisposables.add(this.onClick(template.name, () => this.openerService.open(URI.parse(extension.url!))));
			// this.transientDisposables.add(this.onClick(template.rating, () => this.openerService.open(URI.parse(`${extension.url}#review-details`)))); // {{SQL CARBON EDIT}} remove rating widget
			this.transientDisposables.add(this.onClick(template.publisher, () => {
				this.viewletService.openViewlet(VIEWLET_ID, true)
					.then(viewlet => viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer)
					.then(viewlet => viewlet.search(`publisher:"${extension.publisherDisplayName}"`));
			}));

			if (extension.licenseUrl) {
				this.transientDisposables.add(this.onClick(template.license, () => this.openerService.open(URI.parse(extension.licenseUrl!))));
				template.license.style.display = 'initial';
			} else {
				template.license.style.display = 'none';
			}
		} else {
			template.license.style.display = 'none';
		}

		// {{SQL CARBON EDIT}}
		// copied from the the extension.url condition block above
		// for ADS the extension.url will be empty but we still want to make the publisher and license controls to be clickable
		if (!extension.url) {
			if (extension.licenseUrl) {
				this.transientDisposables.add(this.onClick(template.license, () => this.openerService.open(URI.parse(extension.licenseUrl!))));
				template.license.style.display = 'initial';
			} else {
				template.license.style.display = 'none';
			}
			this.transientDisposables.add(this.onClick(template.publisher, () => {
				this.viewletService.openViewlet(VIEWLET_ID, true)
					.then(viewlet => viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer)
					.then(viewlet => {
						viewlet.search(`publisher:"${extension.publisherDisplayName}"`);
					});
			}));
		}
		// {{SQL CARBON EDIT}} - End

		if (extension.repository) {
			this.transientDisposables.add(this.onClick(template.repository, () => this.openerService.open(URI.parse(extension.repository!))));
			template.repository.style.display = 'initial';
		}
		else {
			template.repository.style.display = 'none';
		}

		const widgets = [
			remoteBadge,
			// this.instantiationService.createInstance(InstallCountWidget, template.installCount, false), {{SQL CARBON EDIT}} Remove the widgets
			// this.instantiationService.createInstance(RatingsWidget, template.rating, false) {{SQL CARBON EDIT}} Remove the widgets
		];
		const reloadAction = this.instantiationService.createInstance(ReloadAction);
		const combinedInstallAction = this.instantiationService.createInstance(CombinedInstallAction);
		const systemDisabledWarningAction = this.instantiationService.createInstance(SystemDisabledWarningAction);
		const actions = [
			reloadAction,
			this.instantiationService.createInstance(SyncIgnoredIconAction),
			this.instantiationService.createInstance(StatusLabelAction),
			this.instantiationService.createInstance(UpdateAction),
			this.instantiationService.createInstance(SetColorThemeAction, await this.workbenchThemeService.getColorThemes()),
			this.instantiationService.createInstance(SetFileIconThemeAction, await this.workbenchThemeService.getFileIconThemes()),
			this.instantiationService.createInstance(SetProductIconThemeAction, await this.workbenchThemeService.getProductIconThemes()),

			this.instantiationService.createInstance(EnableDropDownAction),
			this.instantiationService.createInstance(DisableDropDownAction, runningExtensions),
			this.instantiationService.createInstance(RemoteInstallAction),
			this.instantiationService.createInstance(LocalInstallAction),
			combinedInstallAction,
			systemDisabledWarningAction,
			this.instantiationService.createInstance(ExtensionToolTipAction, systemDisabledWarningAction, reloadAction),
			this.instantiationService.createInstance(MaliciousStatusLabelAction, true),
		];
		const extensionContainers: ExtensionContainers = this.instantiationService.createInstance(ExtensionContainers, [...actions, ...widgets]);
		extensionContainers.extension = extension;

		template.extensionActionBar.clear();
		template.extensionActionBar.push(actions, { icon: true, label: true });
		for (const disposable of [...actions, ...widgets, extensionContainers]) {
			this.transientDisposables.add(disposable);
		}

		this.setSubText(extension, reloadAction, template);
		template.content.innerHTML = ''; // Clear content before setting navbar actions.

		template.navbar.clear();

		if (extension.hasReadme()) {
			template.navbar.push(NavbarSection.Readme, localize('details', "Details"), localize('detailstooltip', "Extension details, rendered from the extension's 'README.md' file"));
		}

		const manifest = await this.extensionManifest.get().promise;
		if (manifest) {
			combinedInstallAction.manifest = manifest;
		}
		if (manifest && manifest.contributes) {
			template.navbar.push(NavbarSection.Contributions, localize('contributions', "Feature Contributions"), localize('contributionstooltip', "Lists contributions to VS Code by this extension"));
		}
		if (extension.hasChangelog()) {
			template.navbar.push(NavbarSection.Changelog, localize('changelog', "Changelog"), localize('changelogtooltip', "Extension update history, rendered from the extension's 'CHANGELOG.md' file"));
		}
		if (extension.dependencies.length) {
			template.navbar.push(NavbarSection.Dependencies, localize('dependencies', "Dependencies"), localize('dependenciestooltip', "Lists extensions this extension depends on"));
		}

		if (template.navbar.currentId) {
			this.onNavbarChange(extension, { id: template.navbar.currentId, focus: !preserveFocus }, template);
		}
		template.navbar.onChange(e => this.onNavbarChange(extension, e, template), this, this.transientDisposables);

		this.editorLoadComplete = true;
	}

	private setSubText(extension: IExtension, reloadAction: ReloadAction, template: IExtensionEditorTemplate): void {
		hide(template.subtextContainer);

		const ignoreAction = this.instantiationService.createInstance(IgnoreExtensionRecommendationAction, extension);
		const undoIgnoreAction = this.instantiationService.createInstance(UndoIgnoreExtensionRecommendationAction, extension);
		ignoreAction.enabled = false;
		undoIgnoreAction.enabled = false;

		template.ignoreActionbar.clear();
		template.ignoreActionbar.push([ignoreAction, undoIgnoreAction], { icon: true, label: true });
		this.transientDisposables.add(ignoreAction);
		this.transientDisposables.add(undoIgnoreAction);

		const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
		if (extRecommendations[extension.identifier.id.toLowerCase()]) {
			ignoreAction.enabled = true;
			template.subtext.textContent = extRecommendations[extension.identifier.id.toLowerCase()].reasonText;
			show(template.subtextContainer);
		} else if (this.extensionRecommendationsService.getIgnoredRecommendations().indexOf(extension.identifier.id.toLowerCase()) !== -1) {
			undoIgnoreAction.enabled = true;
			template.subtext.textContent = localize('recommendationHasBeenIgnored', "You have chosen not to receive recommendations for this extension.");
			show(template.subtextContainer);
		}
		else {
			template.subtext.textContent = '';
		}

		this.extensionRecommendationsService.onRecommendationChange(change => {
			if (change.extensionId.toLowerCase() === extension.identifier.id.toLowerCase()) {
				if (change.isRecommended) {
					undoIgnoreAction.enabled = false;
					const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
					if (extRecommendations[extension.identifier.id.toLowerCase()]) {
						ignoreAction.enabled = true;
						template.subtext.textContent = extRecommendations[extension.identifier.id.toLowerCase()].reasonText;
					}
				} else {
					undoIgnoreAction.enabled = true;
					ignoreAction.enabled = false;
					template.subtext.textContent = localize('recommendationHasBeenIgnored', "You have chosen not to receive recommendations for this extension.");
				}
			}
		});

		this.transientDisposables.add(reloadAction.onDidChange(e => {
			if (e.tooltip) {
				template.subtext.textContent = reloadAction.tooltip;
				show(template.subtextContainer);
				ignoreAction.enabled = false;
				undoIgnoreAction.enabled = false;
			}
			if (e.enabled === true) {
				show(template.subtextContainer);
			}
			if (e.enabled === false) {
				hide(template.subtextContainer);
			}
			this.layout();
		}));
	}

	clearInput(): void {
		this.contentDisposables.clear();
		this.transientDisposables.clear();

		super.clearInput();
	}

	focus(): void {
		if (this.activeElement) {
			this.activeElement.focus();
		}
	}

	showFind(): void {
		if (this.activeElement && (<Webview>this.activeElement).showFind) {
			(<Webview>this.activeElement).showFind();
		}
	}

	runFindAction(previous: boolean): void {
		if (this.activeElement && (<Webview>this.activeElement).runFindAction) {
			(<Webview>this.activeElement).runFindAction(previous);
		}
	}

	private onNavbarChange(extension: IExtension, { id, focus }: { id: string | null, focus: boolean }, template: IExtensionEditorTemplate): void {
		if (this.editorLoadComplete) {
			/* __GDPR__
				"extensionEditor:navbarChange" : {
					"navItem": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
					"${include}": [
						"${GalleryExtensionTelemetryData}"
					]
				}
			*/
			this.telemetryService.publicLog('extensionEditor:navbarChange', assign(extension.telemetryData, { navItem: id }));
		}

		this.contentDisposables.clear();
		template.content.innerHTML = '';
		this.activeElement = null;
		if (id) {
			this.open(id, extension, template)
				.then(activeElement => {
					this.activeElement = activeElement;
					if (focus) {
						this.focus();
					}
				});
		}
	}

	private open(id: string, extension: IExtension, template: IExtensionEditorTemplate): Promise<IActiveElement | null> {
		switch (id) {
			case NavbarSection.Readme: return this.openReadme(template);
			case NavbarSection.Contributions: return this.openContributions(template);
			case NavbarSection.Changelog: return this.openChangelog(template);
			case NavbarSection.Dependencies: return this.openDependencies(extension, template);
		}
		return Promise.resolve(null);
	}

	private async openMarkdown(cacheResult: CacheResult<string>, noContentCopy: string, template: IExtensionEditorTemplate): Promise<IActiveElement> {
		try {
			const body = await this.renderMarkdown(cacheResult, template);

			const webview = this.contentDisposables.add(this.webviewService.createWebviewOverlay('extensionEditor', {
				enableFindWidget: true,
			}, {}));

			webview.claim(this);
			webview.layoutWebviewOverElement(template.content);
			webview.html = body;

			this.contentDisposables.add(webview.onDidFocus(() => this.fireOnDidFocus()));
			const removeLayoutParticipant = arrays.insert(this.layoutParticipants, {
				layout: () => {
					webview.layoutWebviewOverElement(template.content);
				}
			});
			this.contentDisposables.add(toDisposable(removeLayoutParticipant));

			let isDisposed = false;
			this.contentDisposables.add(toDisposable(() => { isDisposed = true; }));

			this.contentDisposables.add(this.themeService.onDidColorThemeChange(async () => {
				// Render again since syntax highlighting of code blocks may have changed
				const body = await this.renderMarkdown(cacheResult, template);
				if (!isDisposed) { // Make sure we weren't disposed of in the meantime
					webview.html = body;
				}
			}));

			this.contentDisposables.add(webview.onDidClickLink(link => {
				if (!link) {
					return;
				}
				// Whitelist supported schemes for links
				if (matchesScheme(link, Schemas.http) || matchesScheme(link, Schemas.https) || matchesScheme(link, Schemas.mailto)
					|| (matchesScheme(link, Schemas.command) && URI.parse(link).path === ShowCurrentReleaseNotesActionId)
				) {
					this.openerService.open(link);
				}
			}, null, this.contentDisposables));

			return webview;
		} catch (e) {
			const p = append(template.content, $('p.nocontent'));
			p.textContent = noContentCopy;
			return p;
		}
	}

	private async renderMarkdown(cacheResult: CacheResult<string>, template: IExtensionEditorTemplate) {
		const contents = await this.loadContents(() => cacheResult, template);
		const content = await renderMarkdownDocument(contents, this.extensionService, this.modeService);
		const documentContent = await this.renderBody(content);
		return removeEmbeddedSVGs(documentContent);
	}

	private async renderBody(body: string): Promise<string> {
		const nonce = generateUuid();
		const colorMap = TokenizationRegistry.getColorMap();
		const css = colorMap ? generateTokensCSSForColorMap(colorMap) : '';
		return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; script-src 'none'; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					body {
						padding: 10px 20px;
						line-height: 22px;
						max-width: 882px;
						margin: 0 auto;
					}

					img {
						max-width: 100%;
						max-height: 100%;
					}

					a {
						text-decoration: none;
					}

					a:hover {
						text-decoration: underline;
					}

					a:focus,
					input:focus,
					select:focus,
					textarea:focus {
						outline: 1px solid -webkit-focus-ring-color;
						outline-offset: -1px;
					}

					hr {
						border: 0;
						height: 2px;
						border-bottom: 2px solid;
					}

					h1 {
						padding-bottom: 0.3em;
						line-height: 1.2;
						border-bottom-width: 1px;
						border-bottom-style: solid;
					}

					h1, h2, h3 {
						font-weight: normal;
					}

					table {
						border-collapse: collapse;
					}

					table > thead > tr > th {
						text-align: left;
						border-bottom: 1px solid;
					}

					table > thead > tr > th,
					table > thead > tr > td,
					table > tbody > tr > th,
					table > tbody > tr > td {
						padding: 5px 10px;
					}

					table > tbody > tr + tr > td {
						border-top: 1px solid;
					}

					blockquote {
						margin: 0 7px 0 5px;
						padding: 0 16px 0 10px;
						border-left-width: 5px;
						border-left-style: solid;
					}

					code {
						font-family: var(--vscode-editor-font-family);
						font-weight: var(--vscode-editor-font-weight);
						font-size: var(--vscode-editor-font-size);
					}

					code > div {
						padding: 16px;
						border-radius: 3px;
						overflow: auto;
					}

					.monaco-tokenized-source {
							white-space: pre;
					}

					#scroll-to-top {
						position: fixed;
						width: 40px;
						height: 40px;
						right: 25px;
						bottom: 25px;
						background-color:#444444;
						border-radius: 50%;
						cursor: pointer;
						box-shadow: 1px 1px 1px rgba(0,0,0,.25);
						outline: none;
						display: flex;
						justify-content: center;
						align-items: center;
					}

					#scroll-to-top:hover {
						background-color:#007acc;
						box-shadow: 2px 2px 2px rgba(0,0,0,.25);
					}

					body.vscode-light #scroll-to-top {
						background-color: #949494;
					}

					body.vscode-high-contrast #scroll-to-top:hover {
						background-color: #007acc;
					}

					body.vscode-high-contrast #scroll-to-top {
						background-color: black;
						border: 2px solid #6fc3df;
						box-shadow: none;
					}
					body.vscode-high-contrast #scroll-to-top:hover {
						background-color: #007acc;
					}

					#scroll-to-top span.icon::before {
						content: "";
						display: block;
						/* Chevron up icon */
						background:url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNiAxNiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTYgMTY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRkZGRkZGO30KCS5zdDF7ZmlsbDpub25lO30KPC9zdHlsZT4KPHRpdGxlPnVwY2hldnJvbjwvdGl0bGU+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDUuMWwtNy4zLDcuM0wwLDExLjZsOC04bDgsOGwtMC43LDAuN0w4LDUuMXoiLz4KPHJlY3QgY2xhc3M9InN0MSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+Cjwvc3ZnPgo=');
						width: 16px;
						height: 16px;
					}

					/** Theming */
					.vscode-light code > div {
						background-color: rgba(220, 220, 220, 0.4);
					}

					.vscode-dark code > div {
						background-color: rgba(10, 10, 10, 0.4);
					}

					.vscode-high-contrast code > div {
						background-color: rgb(0, 0, 0);
					}

					.vscode-high-contrast h1 {
						border-color: rgb(0, 0, 0);
					}

					.vscode-light table > thead > tr > th {
						border-color: rgba(0, 0, 0, 0.69);
					}

					.vscode-dark table > thead > tr > th {
						border-color: rgba(255, 255, 255, 0.69);
					}

					.vscode-light h1,
					.vscode-light hr,
					.vscode-light table > tbody > tr + tr > td {
						border-color: rgba(0, 0, 0, 0.18);
					}

					.vscode-dark h1,
					.vscode-dark hr,
					.vscode-dark table > tbody > tr + tr > td {
						border-color: rgba(255, 255, 255, 0.18);
					}

					${css}
				</style>
			</head>
			<body>
				<a id="scroll-to-top" role="button" aria-label="scroll to top" href="#"><span class="icon"></span></a>
				${body}
			</body>
		</html>`;
	}

	private async openReadme(template: IExtensionEditorTemplate): Promise<IActiveElement> {
		const manifest = await this.extensionManifest!.get().promise;
		if (manifest && manifest.extensionPack && manifest.extensionPack.length) {
			return this.openExtensionPackReadme(manifest, template);
		}
		return this.openMarkdown(this.extensionReadme!.get(), localize('noReadme', "No README available."), template);
	}

	private async openExtensionPackReadme(manifest: IExtensionManifest, template: IExtensionEditorTemplate): Promise<IActiveElement> {
		const extensionPackReadme = append(template.content, $('div', { class: 'extension-pack-readme' }));
		extensionPackReadme.style.margin = '0 auto';
		extensionPackReadme.style.maxWidth = '882px';

		const extensionPack = append(extensionPackReadme, $('div', { class: 'extension-pack' }));
		if (manifest.extensionPack!.length <= 3) {
			addClass(extensionPackReadme, 'one-row');
		} else if (manifest.extensionPack!.length <= 6) {
			addClass(extensionPackReadme, 'two-rows');
		} else if (manifest.extensionPack!.length <= 9) {
			addClass(extensionPackReadme, 'three-rows');
		} else {
			addClass(extensionPackReadme, 'more-rows');
		}

		const extensionPackHeader = append(extensionPack, $('div.header'));
		extensionPackHeader.textContent = localize('extension pack', "Extension Pack ({0})", manifest.extensionPack!.length);
		const extensionPackContent = append(extensionPack, $('div', { class: 'extension-pack-content' }));
		extensionPackContent.setAttribute('tabindex', '0');
		append(extensionPack, $('div.footer'));
		const readmeContent = append(extensionPackReadme, $('div.readme-content'));

		await Promise.all([
			this.renderExtensionPack(manifest, extensionPackContent),
			this.openMarkdown(this.extensionReadme!.get(), localize('noReadme', "No README available."), { ...template, ...{ content: readmeContent } }),
		]);

		return { focus: () => extensionPackContent.focus() };
	}

	private openChangelog(template: IExtensionEditorTemplate): Promise<IActiveElement> {
		return this.openMarkdown(this.extensionChangelog!.get(), localize('noChangelog', "No Changelog available."), template);
	}

	private openContributions(template: IExtensionEditorTemplate): Promise<IActiveElement> {
		const content = $('div', { class: 'subcontent', tabindex: '0' });
		return this.loadContents(() => this.extensionManifest!.get(), template)
			.then(manifest => {
				if (!manifest) {
					return content;
				}

				const scrollableContent = new DomScrollableElement(content, {});

				const layout = () => scrollableContent.scanDomNode();
				const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout });
				this.contentDisposables.add(toDisposable(removeLayoutParticipant));

				const renders = [
					this.renderSettings(content, manifest, layout),
					this.renderCommands(content, manifest, layout),
					this.renderCodeActions(content, manifest, layout),
					this.renderLanguages(content, manifest, layout),
					this.renderColorThemes(content, manifest, layout),
					this.renderIconThemes(content, manifest, layout),
					this.renderColors(content, manifest, layout),
					this.renderJSONValidation(content, manifest, layout),
					this.renderDebuggers(content, manifest, layout),
					this.renderViewContainers(content, manifest, layout),
					this.renderViews(content, manifest, layout),
					this.renderLocalizations(content, manifest, layout),
					renderDashboardContributions(content, manifest, layout), // {{SQL CARBON EDIT}}
					this.renderCustomEditors(content, manifest, layout),
				];

				scrollableContent.scanDomNode();

				const isEmpty = !renders.some(x => x);
				if (isEmpty) {
					append(content, $('p.nocontent')).textContent = localize('noContributions', "No Contributions");
					append(template.content, content);
				} else {
					append(template.content, scrollableContent.getDomNode());
					this.contentDisposables.add(scrollableContent);
				}
				return content;
			}, () => {
				append(content, $('p.nocontent')).textContent = localize('noContributions', "No Contributions");
				append(template.content, content);
				return content;
			});
	}

	private openDependencies(extension: IExtension, template: IExtensionEditorTemplate): Promise<IActiveElement> {
		if (arrays.isFalsyOrEmpty(extension.dependencies)) {
			append(template.content, $('p.nocontent')).textContent = localize('noDependencies', "No Dependencies");
			return Promise.resolve(template.content);
		}

		const content = $('div', { class: 'subcontent' });
		const scrollableContent = new DomScrollableElement(content, {});
		append(template.content, scrollableContent.getDomNode());
		this.contentDisposables.add(scrollableContent);

		const dependenciesTree = this.instantiationService.createInstance(ExtensionsTree,
			new ExtensionData(extension, null, extension => extension.dependencies || [], this.extensionsWorkbenchService), content,
			{
				listBackground: editorBackground
			});
		const layout = () => {
			scrollableContent.scanDomNode();
			const scrollDimensions = scrollableContent.getScrollDimensions();
			dependenciesTree.layout(scrollDimensions.height);
		};
		const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout });
		this.contentDisposables.add(toDisposable(removeLayoutParticipant));

		this.contentDisposables.add(dependenciesTree);
		scrollableContent.scanDomNode();
		return Promise.resolve({ focus() { dependenciesTree.domFocus(); } });
	}

	private async renderExtensionPack(manifest: IExtensionManifest, parent: HTMLElement): Promise<void> {
		const content = $('div', { class: 'subcontent' });
		const scrollableContent = new DomScrollableElement(content, { useShadows: false });
		append(parent, scrollableContent.getDomNode());

		const extensionsGridView = this.instantiationService.createInstance(ExtensionsGridView, content);
		const extensions: IExtension[] = await getExtensions(manifest.extensionPack!, this.extensionsWorkbenchService);
		extensionsGridView.setExtensions(extensions);
		scrollableContent.scanDomNode();

		this.contentDisposables.add(scrollableContent);
		this.contentDisposables.add(extensionsGridView);
		this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout: () => scrollableContent.scanDomNode() })));
	}

	private renderSettings(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const configuration = manifest.contributes?.configuration;
		let properties: any = {};
		if (Array.isArray(configuration)) {
			configuration.forEach(config => {
				properties = { ...properties, ...config.properties };
			});
		} else if (configuration) {
			properties = configuration.properties;
		}
		const contrib = properties ? Object.keys(properties) : [];

		if (!contrib.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('settings', "Settings ({0})", contrib.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('setting name', "Name")),
					$('th', undefined, localize('description', "Description")),
					$('th', undefined, localize('default', "Default"))
				),
				...contrib.map(key => $('tr', undefined,
					$('td', undefined, $('code', undefined, key)),
					$('td', undefined, properties[key].description),
					$('td', undefined, $('code', undefined, `${isUndefined(properties[key].default) ? getDefaultValue(properties[key].type) : properties[key].default}`))
				))
			)
		);

		append(container, details);
		return true;
	}

	private renderDebuggers(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const contrib = manifest.contributes?.debuggers || [];
		if (!contrib.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('debuggers', "Debuggers ({0})", contrib.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('debugger name', "Name")),
					$('th', undefined, localize('debugger type', "Type")),
				),
				...contrib.map(d => $('tr', undefined,
					$('td', undefined, d.label!),
					$('td', undefined, d.type)))
			)
		);

		append(container, details);
		return true;
	}

	private renderViewContainers(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const contrib = manifest.contributes?.viewsContainers || {};

		const viewContainers = Object.keys(contrib).reduce((result, location) => {
			let viewContainersForLocation: IViewContainer[] = contrib[location];
			result.push(...viewContainersForLocation.map(viewContainer => ({ ...viewContainer, location })));
			return result;
		}, [] as Array<{ id: string, title: string, location: string }>);

		if (!viewContainers.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('viewContainers', "View Containers ({0})", viewContainers.length)),
			$('table', undefined,
				$('tr', undefined, $('th', undefined, localize('view container id', "ID")), $('th', undefined, localize('view container title', "Title")), $('th', undefined, localize('view container location', "Where"))),
				...viewContainers.map(viewContainer => $('tr', undefined, $('td', undefined, viewContainer.id), $('td', undefined, viewContainer.title), $('td', undefined, viewContainer.location)))
			)
		);

		append(container, details);
		return true;
	}

	private renderViews(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const contrib = manifest.contributes?.views || {};

		const views = Object.keys(contrib).reduce((result, location) => {
			let viewsForLocation: IView[] = contrib[location];
			result.push(...viewsForLocation.map(view => ({ ...view, location })));
			return result;
		}, [] as Array<{ id: string, name: string, location: string }>);

		if (!views.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('views', "Views ({0})", views.length)),
			$('table', undefined,
				$('tr', undefined, $('th', undefined, localize('view id', "ID")), $('th', undefined, localize('view name', "Name")), $('th', undefined, localize('view location', "Where"))),
				...views.map(view => $('tr', undefined, $('td', undefined, view.id), $('td', undefined, view.name), $('td', undefined, view.location)))
			)
		);

		append(container, details);
		return true;
	}

	private renderLocalizations(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const localizations = manifest.contributes?.localizations || [];
		if (!localizations.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('localizations', "Localizations ({0})", localizations.length)),
			$('table', undefined,
				$('tr', undefined, $('th', undefined, localize('localizations language id', "Language Id")), $('th', undefined, localize('localizations language name', "Language Name")), $('th', undefined, localize('localizations localized language name', "Language Name (Localized)"))),
				...localizations.map(localization => $('tr', undefined, $('td', undefined, localization.languageId), $('td', undefined, localization.languageName || ''), $('td', undefined, localization.localizedLanguageName || '')))
			)
		);

		append(container, details);
		return true;
	}

	private renderCustomEditors(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const webviewEditors = manifest.contributes?.customEditors || [];
		if (!webviewEditors.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('customEditors', "Custom Editors ({0})", webviewEditors.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('customEditors view type', "View Type")),
					$('th', undefined, localize('customEditors priority', "Priority")),
					$('th', undefined, localize('customEditors filenamePattern', "Filename Pattern"))),
				...webviewEditors.map(webviewEditor =>
					$('tr', undefined,
						$('td', undefined, webviewEditor.viewType),
						$('td', undefined, webviewEditor.priority),
						$('td', undefined, arrays.coalesce(webviewEditor.selector.map(x => x.filenamePattern)).join(', '))))
			)
		);

		append(container, details);
		return true;
	}

	private renderCodeActions(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const codeActions = manifest.contributes?.codeActions || [];
		if (!codeActions.length) {
			return false;
		}

		const flatActions = arrays.flatten(
			codeActions.map(contribution =>
				contribution.actions.map(action => ({ ...action, languages: contribution.languages }))));

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('codeActions', "Code Actions ({0})", flatActions.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('codeActions.title', "Title")),
					$('th', undefined, localize('codeActions.kind', "Kind")),
					$('th', undefined, localize('codeActions.description', "Description")),
					$('th', undefined, localize('codeActions.languages', "Languages"))),
				...flatActions.map(action =>
					$('tr', undefined,
						$('td', undefined, action.title),
						$('td', undefined, $('code', undefined, action.kind)),
						$('td', undefined, action.description ?? ''),
						$('td', undefined, ...action.languages.map(language => $('code', undefined, language)))))
			)
		);

		append(container, details);
		return true;
	}

	private renderColorThemes(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const contrib = manifest.contributes?.themes || [];
		if (!contrib.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('colorThemes', "Color Themes ({0})", contrib.length)),
			$('ul', undefined, ...contrib.map(theme => $('li', undefined, theme.label)))
		);

		append(container, details);
		return true;
	}

	private renderIconThemes(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const contrib = manifest.contributes?.iconThemes || [];
		if (!contrib.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('iconThemes', "File Icon Themes ({0})", contrib.length)),
			$('ul', undefined, ...contrib.map(theme => $('li', undefined, theme.label)))
		);

		append(container, details);
		return true;
	}

	private renderColors(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const colors = manifest.contributes?.colors || [];
		if (!colors.length) {
			return false;
		}

		function colorPreview(colorReference: string): Node[] {
			let result: Node[] = [];
			if (colorReference && colorReference[0] === '#') {
				let color = Color.fromHex(colorReference);
				if (color) {
					result.push($('span', { class: 'colorBox', style: 'background-color: ' + Color.Format.CSS.format(color) }, ''));
				}
			}
			result.push($('code', undefined, colorReference));
			return result;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('colors', "Colors ({0})", colors.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('colorId', "Id")),
					$('th', undefined, localize('description', "Description")),
					$('th', undefined, localize('defaultDark', "Dark Default")),
					$('th', undefined, localize('defaultLight', "Light Default")),
					$('th', undefined, localize('defaultHC', "High Contrast Default"))
				),
				...colors.map(color => $('tr', undefined,
					$('td', undefined, $('code', undefined, color.id)),
					$('td', undefined, color.description),
					$('td', undefined, ...colorPreview(color.defaults.dark)),
					$('td', undefined, ...colorPreview(color.defaults.light)),
					$('td', undefined, ...colorPreview(color.defaults.highContrast))
				))
			)
		);

		append(container, details);
		return true;
	}


	private renderJSONValidation(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const contrib = manifest.contributes?.jsonValidation || [];
		if (!contrib.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('JSON Validation', "JSON Validation ({0})", contrib.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('fileMatch', "File Match")),
					$('th', undefined, localize('schema', "Schema"))
				),
				...contrib.map(v => $('tr', undefined,
					$('td', undefined, $('code', undefined, Array.isArray(v.fileMatch) ? v.fileMatch.join(', ') : v.fileMatch)),
					$('td', undefined, v.url)
				))));

		append(container, details);
		return true;
	}

	private renderCommands(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const rawCommands = manifest.contributes?.commands || [];
		const commands = rawCommands.map(c => ({
			id: c.command,
			title: c.title,
			keybindings: [] as ResolvedKeybinding[],
			menus: [] as string[]
		}));

		const byId = arrays.index(commands, c => c.id);

		const menus = manifest.contributes?.menus || {};

		Object.keys(menus).forEach(context => {
			menus[context].forEach(menu => {
				let command = byId[menu.command];

				if (command) {
					command.menus.push(context);
				} else {
					command = { id: menu.command, title: '', keybindings: [], menus: [context] };
					byId[command.id] = command;
					commands.push(command);
				}
			});
		});

		const rawKeybindings = manifest.contributes?.keybindings ? (Array.isArray(manifest.contributes.keybindings) ? manifest.contributes.keybindings : [manifest.contributes.keybindings]) : [];

		rawKeybindings.forEach(rawKeybinding => {
			const keybinding = this.resolveKeybinding(rawKeybinding);

			if (!keybinding) {
				return;
			}

			let command = byId[rawKeybinding.command];

			if (command) {
				command.keybindings.push(keybinding);
			} else {
				command = { id: rawKeybinding.command, title: '', keybindings: [keybinding], menus: [] };
				byId[command.id] = command;
				commands.push(command);
			}
		});

		if (!commands.length) {
			return false;
		}

		const renderKeybinding = (keybinding: ResolvedKeybinding): HTMLElement => {
			const element = $('');
			new KeybindingLabel(element, OS).set(keybinding);
			return element;
		};

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('commands', "Commands ({0})", commands.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('command name', "Name")),
					$('th', undefined, localize('description', "Description")),
					$('th', undefined, localize('keyboard shortcuts', "Keyboard Shortcuts")),
					$('th', undefined, localize('menuContexts', "Menu Contexts"))
				),
				...commands.map(c => $('tr', undefined,
					$('td', undefined, $('code', undefined, c.id)),
					$('td', undefined, c.title),
					$('td', undefined, ...c.keybindings.map(keybinding => renderKeybinding(keybinding))),
					$('td', undefined, ...c.menus.map(context => $('code', undefined, context)))
				))
			)
		);

		append(container, details);
		return true;
	}

	private renderLanguages(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
		const contributes = manifest.contributes;
		const rawLanguages = contributes?.languages || [];
		const languages = rawLanguages.map(l => ({
			id: l.id,
			name: (l.aliases || [])[0] || l.id,
			extensions: l.extensions || [],
			hasGrammar: false,
			hasSnippets: false
		}));

		const byId = arrays.index(languages, l => l.id);

		const grammars = contributes?.grammars || [];
		grammars.forEach(grammar => {
			let language = byId[grammar.language];

			if (language) {
				language.hasGrammar = true;
			} else {
				language = { id: grammar.language, name: grammar.language, extensions: [], hasGrammar: true, hasSnippets: false };
				byId[language.id] = language;
				languages.push(language);
			}
		});

		const snippets = contributes?.snippets || [];
		snippets.forEach(snippet => {
			let language = byId[snippet.language];

			if (language) {
				language.hasSnippets = true;
			} else {
				language = { id: snippet.language, name: snippet.language, extensions: [], hasGrammar: false, hasSnippets: true };
				byId[language.id] = language;
				languages.push(language);
			}
		});

		if (!languages.length) {
			return false;
		}

		const details = $('details', { open: true, ontoggle: onDetailsToggle },
			$('summary', { tabindex: '0' }, localize('languages', "Languages ({0})", languages.length)),
			$('table', undefined,
				$('tr', undefined,
					$('th', undefined, localize('language id', "ID")),
					$('th', undefined, localize('language name', "Name")),
					$('th', undefined, localize('file extensions', "File Extensions")),
					$('th', undefined, localize('grammar', "Grammar")),
					$('th', undefined, localize('snippets', "Snippets"))
				),
				...languages.map(l => $('tr', undefined,
					$('td', undefined, l.id),
					$('td', undefined, l.name),
					$('td', undefined, ...join(l.extensions.map(ext => $('code', undefined, ext)), ' ')),
					$('td', undefined, document.createTextNode(l.hasGrammar ? '✔︎' : '—')),
					$('td', undefined, document.createTextNode(l.hasSnippets ? '✔︎' : '—'))
				))
			)
		);

		append(container, details);
		return true;
	}

	private resolveKeybinding(rawKeyBinding: IKeyBinding): ResolvedKeybinding | null {
		let key: string | undefined;

		switch (platform) {
			case 'win32': key = rawKeyBinding.win; break;
			case 'linux': key = rawKeyBinding.linux; break;
			case 'darwin': key = rawKeyBinding.mac; break;
		}

		const keyBinding = KeybindingParser.parseKeybinding(key || rawKeyBinding.key, OS);
		if (keyBinding) {
			return this.keybindingService.resolveKeybinding(keyBinding)[0];

		}
		return null;
	}

	private loadContents<T>(loadingTask: () => CacheResult<T>, template: IExtensionEditorTemplate): Promise<T> {
		addClass(template.content, 'loading');

		const result = this.contentDisposables.add(loadingTask());
		const onDone = () => removeClass(template.content, 'loading');
		result.promise.then(onDone, onDone);

		return result.promise;
	}

	layout(): void {
		this.layoutParticipants.forEach(p => p.layout());
	}

	private onError(err: any): void {
		if (isPromiseCanceledError(err)) {
			return;
		}

		this.notificationService.error(err);
	}
}

const contextKeyExpr = ContextKeyExpr.and(ContextKeyExpr.equals('activeEditor', ExtensionEditor.ID), ContextKeyExpr.not('editorFocus'));
registerAction2(class ShowExtensionEditorFindAction extends Action2 {
	constructor() {
		super({
			id: 'editor.action.extensioneditor.showfind',
			title: localize('find', "Find"),
			keybinding: {
				when: contextKeyExpr,
				weight: KeybindingWeight.EditorContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KEY_F,
			}
		});
	}
	run(accessor: ServicesAccessor): any {
		const extensionEditor = getExtensionEditor(accessor);
		if (extensionEditor) {
			extensionEditor.showFind();
		}
	}
});

registerAction2(class StartExtensionEditorFindNextAction extends Action2 {
	constructor() {
		super({
			id: 'editor.action.extensioneditor.findNext',
			title: localize('find next', "Find Next"),
			keybinding: {
				when: ContextKeyExpr.and(
					contextKeyExpr,
					KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED),
				primary: KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}
	run(accessor: ServicesAccessor): any {
		const extensionEditor = getExtensionEditor(accessor);
		if (extensionEditor) {
			extensionEditor.runFindAction(false);
		}
	}
});

registerAction2(class StartExtensionEditorFindPreviousAction extends Action2 {
	constructor() {
		super({
			id: 'editor.action.extensioneditor.findPrevious',
			title: localize('find previous', "Find Previous"),
			keybinding: {
				when: ContextKeyExpr.and(
					contextKeyExpr,
					KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED),
				primary: KeyMod.Shift | KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}
	run(accessor: ServicesAccessor): any {
		const extensionEditor = getExtensionEditor(accessor);
		if (extensionEditor) {
			extensionEditor.runFindAction(true);
		}
	}
});

function getExtensionEditor(accessor: ServicesAccessor): ExtensionEditor | null {
	const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
	if (activeEditorPane instanceof ExtensionEditor) {
		return activeEditorPane;
	}
	return null;
}
