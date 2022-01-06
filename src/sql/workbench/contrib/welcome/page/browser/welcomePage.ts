/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./welcomePage';
import 'sql/workbench/contrib/welcome/page/browser/az_data_welcome_page';
import { URI } from 'vs/base/common/uri';
import { ICommandService } from 'vs/platform/commands/common/commands';
import * as arrays from 'vs/base/common/arrays';
import { WalkThroughInput } from 'vs/workbench/contrib/welcome/walkThrough/browser/walkThroughInput';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { onUnexpectedError, isPromiseCanceledError } from 'vs/base/common/errors';
import { IWindowOpenable } from 'vs/platform/windows/common/windows';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { localize } from 'vs/nls';
import { Action, WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification } from 'vs/base/common/actions';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Schemas } from 'vs/base/common/network';
import { getInstalledExtensions, IExtensionStatus, onExtensionChanged, isKeymapExtension } from 'vs/workbench/contrib/extensions/common/extensionsUtils';
import { IExtensionManagementService, IExtensionGalleryService, ILocalExtension } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IWorkbenchExtensionEnablementService, EnablementState } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { ILifecycleService, StartupKind } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Disposable } from 'vs/base/common/lifecycle';
import { splitName } from 'vs/base/common/labels';
import { IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { tileBorder, gradientOne, gradientTwo, gradientBackground, extensionPackHeaderShadow, extensionPackGradientColorOneColor, extensionPackGradientColorTwoColor, tileBoxShadow, hoverShadow } from 'sql/platform/theme/common/colorRegistry';
import { registerColor, foreground, textLinkActiveForeground, descriptionForeground, activeContrastBorder, buttonForeground, menuBorder, menuForeground, editorWidgetBorder, selectBackground, buttonHoverBackground, selectBorder, iconForeground, textLinkForeground, inputBackground, focusBorder, listFocusBackground, listFocusForeground, buttonSecondaryBackground, buttonSecondaryBorder, buttonDisabledForeground, buttonDisabledBackground, buttonSecondaryForeground, buttonSecondaryHoverBackground } from 'vs/platform/theme/common/colorRegistry';
import { IExtensionsWorkbenchService } from 'vs/workbench/contrib/extensions/common/extensions';
import { IEditorSerializer } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { TimeoutTimer } from 'vs/base/common/async';
import { areSameExtensions } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { ILabelService } from 'vs/platform/label/common/label';
import { IFileService } from 'vs/platform/files/common/files';
import { ExtensionType } from 'vs/platform/extensions/common/extensions';
import { IRecentlyOpened, isRecentWorkspace, IRecentWorkspace, IRecentFolder, isRecentFolder, IWorkspacesService } from 'vs/platform/workspaces/common/workspaces';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { IProductService } from 'vs/platform/product/common/productService';
import { joinPath } from 'vs/base/common/resources';
import { clearNode } from 'vs/base/browser/dom';
import { GuidedTour } from 'sql/workbench/contrib/welcome/page/browser/gettingStartedTour';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Button } from 'sql/base/browser/ui/button/button';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ICommandAction, MenuItemAction } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IExtensionRecommendationsService } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { AddServerAction } from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { IWorkingCopyBackupService } from 'vs/workbench/services/workingCopy/common/workingCopyBackup';
const configurationKey = 'workbench.startupEditor';
const oldConfigurationKey = 'workbench.welcome.enabled';
const telemetryFrom = 'welcomePage';

export class WelcomePageContribution implements IWorkbenchContribution {

	constructor(

		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkingCopyBackupService private readonly workingCopyBackupService: IWorkingCopyBackupService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@ICommandService private readonly commandService: ICommandService,
		@IWorkbenchLayoutService protected layoutService: IWorkbenchLayoutService) {
		this.enableWelcomePage().catch(onUnexpectedError);
	}
	private async enableWelcomePage(): Promise<void> {
		const enabled = isWelcomePageEnabled(this.configurationService, this.contextService);
		const guidedTourEnabled = isGuidedTourEnabled(this.configurationService);
		if (enabled && this.lifecycleService.startupKind !== StartupKind.ReloadedWindow || guidedTourEnabled) {
			const hasBackups: boolean = await this.workingCopyBackupService.hasBackups();
			const activeEditor = this.editorService.activeEditor;
			if (!activeEditor && !hasBackups) {
				const openWithReadme = this.configurationService.getValue(configurationKey) === 'readme';
				if (openWithReadme) {
					let readmes = await Promise.all(this.contextService.getWorkspace().folders.map(async folder => {
						const folderUri = folder.uri;
						try {
							const folder = await this.fileService.resolve(folderUri);
							const files = folder.children ? folder.children.map(child => child.name) : [];
							const file = files.sort().find(file => file.toLowerCase().startsWith('readme'));
							if (file) {
								return joinPath(folderUri, file);
							}
						} catch (err) {
							onUnexpectedError(err);
						}
						return undefined;
					}));
					arrays.coalesceInPlace(readmes);
					if (!this.editorService.activeEditor) {
						if (readmes.length) {
							const isMarkDown = (readme: URI) => readme.path.toLowerCase().endsWith('.md');
							await Promise.all([
								this.commandService.executeCommand('markdown.showPreview', null, readmes.filter(isMarkDown), { locked: true }),
								this.editorService.openEditors(readmes.filter(readme => !isMarkDown(readme)).map(readme => ({ resource: readme }))),
							]);
						} else {
							await this.instantiationService.createInstance(WelcomePage).openEditor();
						}
					}
				} else {
					await this.instantiationService.createInstance(WelcomePage).openEditor();
				}
			}
		}
	}
}


function isWelcomePageEnabled(configurationService: IConfigurationService, contextService: IWorkspaceContextService) {
	const startupEditor = configurationService.inspect(configurationKey);
	if (!startupEditor.userValue && !startupEditor.workspaceValue) {
		const welcomeEnabled = configurationService.inspect(oldConfigurationKey);
		if (welcomeEnabled.value !== undefined && welcomeEnabled.value !== null) {
			return welcomeEnabled.value;
		}
	}
	return startupEditor.value === 'welcomePage' || startupEditor.value === 'readme' || startupEditor.value === 'welcomePageInEmptyWorkbench' && contextService.getWorkbenchState() === WorkbenchState.EMPTY;
}

function isGuidedTourEnabled(configurationService: IConfigurationService): boolean {
	const tourEnabled = configurationService.inspect(configurationKey);
	if (tourEnabled.value === 'welcomePageWithTour') {
		return true;
	}
	return false;
}

export class WelcomePageAction extends Action {


	public static readonly ID = 'workbench.action.showWelcomePage';
	public static readonly LABEL = localize('welcomePage', "Welcome");

	constructor(
		id: string,
		label: string,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public override run(): Promise<void> {
		return this.instantiationService.createInstance(WelcomePage)
			.openEditor()
			.then(() => undefined);
	}
}

interface ExtensionSuggestion {
	name: string;
	title?: string;
	description?: string;
	id: string;
	isKeymap?: boolean;
	isCommand?: boolean;
	isExtensionPack?: boolean;
	icon?: string;
	link?: string;
}

interface ExtensionPackExtensions {
	name: string;
	icon: string;
	link: string;
}

const extensionPacks: ExtensionSuggestion[] = [
	{
		name: localize('welcomePage.adminPack', "SQL Admin Pack"),
		title: localize('welcomePage.showAdminPack', "SQL Admin Pack"),
		description: localize('welcomePage.adminPackDescription', "Admin Pack for SQL Server is a collection of popular database administration extensions to help you manage SQL Server"),
		id: 'microsoft.admin-pack',
		isExtensionPack: true
	},
];

const extensionPackExtensions: ExtensionPackExtensions[] = [
	{ name: localize('welcomePage.sqlServerAgent', "SQL Server Agent"), icon: require.toUrl('./../../media/agentExtensionIcon.png'), link: `command:azdata.extension.open?{"id":"microsoft.agent"}` },
	{ name: localize('welcomePage.sqlServerProfiler', "SQL Server Profiler"), icon: require.toUrl('./../../media/defaultExtensionIcon.svg'), link: `command:azdata.extension.open?{"id":"microsoft.profiler"}` },
	{ name: localize('welcomePage.sqlServerImport', "SQL Server Import"), icon: require.toUrl('./../../media/defaultExtensionIcon.svg'), link: `command:azdata.extension.open?{"id":"microsoft.import"}` },
	{ name: localize('welcomePage.sqlServerDacpac', "SQL Server Dacpac"), icon: require.toUrl('./../../media/defaultExtensionIcon.svg'), link: `command:azdata.extension.open?{"id":"microsoft.dacpac"}` }
];

const extensions: ExtensionSuggestion[] = [
	{ name: localize('welcomePage.powershell', "Powershell"), id: 'microsoft.powershell', description: localize('welcomePage.powershellDescription', "Write and execute PowerShell scripts using Azure Data Studio's rich query editor"), icon: require.toUrl('./../../media/icon_powershell.png'), link: `command:azdata.extension.open?{"id":"microsoft.powershell"}` },
	{ name: localize('welcomePage.dataVirtualization', "Data Virtualization"), id: 'microsoft.datavirtualization', description: localize('welcomePage.dataVirtualizationDescription', "Virtualize data with SQL Server 2019 and create external tables using interactive wizards"), icon: require.toUrl('./../../media/defaultExtensionIcon.svg'), link: `command:azdata.extension.open?{"id":"microsoft.datavirtualization"}` },
	{ name: localize('welcomePage.PostgreSQL', "PostgreSQL"), id: 'microsoft.azuredatastudio-postgresql', description: localize('welcomePage.PostgreSQLDescription', "Connect, query, and manage Postgres databases with Azure Data Studio"), icon: require.toUrl('./../../media/icon_postgre_sql.png'), link: `command:azdata.extension.open?{"id":"microsoft.azuredatastudio-postgresql"}` },
];

const extensionPackStrings = {
	installEvent: 'installExtension',
	installedEvent: 'installedExtension',
	detailsEvent: 'detailsExtension',
	alreadyInstalled: (extensionName: string) => { return localize('welcomePage.extensionPackAlreadyInstalled', "Support for {0} is already installed.", extensionName); },
	reloadAfterInstall: (extensionName: string) => { return localize('welcomePage.willReloadAfterInstallingExtensionPack', "The window will reload after installing additional support for {0}.", extensionName); },
	installing: (extensionName: string) => { return localize('welcomePage.installingExtensionPack', "Installing additional support for {0}...", extensionName); },
	extensionNotFound: (extensionName: string, extensionId: string) => { return localize('welcomePage.extensionPackNotFound', "Support for {0} with id {1} could not be found.", extensionName, extensionId); },
};

const NewActionItems: ICommandAction[] = [
	{
		title: localize('welcomePage.newConnection', "New connection"),
		id: AddServerAction.ID
	}, {
		title: localize('welcomePage.newQuery', "New query"),
		id: 'workbench.action.files.newUntitledFile'
	}, {
		title: localize('welcomePage.newNotebook', "New notebook"),
		id: 'notebook.command.new'
	}, {
		title: localize('welcomePage.deployServer', "Deploy a server"),
		id: 'azdata.resource.deploy'
	}
];

const welcomeInputTypeId = 'workbench.editors.welcomePageInput';
class WelcomePage extends Disposable {

	readonly editorInput: WalkThroughInput;
	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILabelService private readonly labelService: ILabelService,
		@INotificationService private readonly notificationService: INotificationService,
		@IWorkbenchExtensionEnablementService private readonly extensionEnablementService: IWorkbenchExtensionEnablementService,
		@IExtensionGalleryService private readonly extensionGalleryService: IExtensionGalleryService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IExtensionRecommendationsService private readonly tipsService: IExtensionRecommendationsService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IHostService private readonly hostService: IHostService,
		@IFileService fileService: IFileService,
		@IProductService private readonly productService: IProductService,
		@IWorkbenchLayoutService protected layoutService: IWorkbenchLayoutService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IThemeService private themeService: IThemeService) {
		super();
		this._register(lifecycleService.onWillShutdown(() => this.dispose()));
		const recentlyOpened = this.workspacesService.getRecentlyOpened();
		const installedExtensions = this.instantiationService.invokeFunction(getInstalledExtensions);
		const resource = URI.parse(require.toUrl('./az_data_welcome_page'))
			.with({
				scheme: Schemas.walkThrough,
				query: JSON.stringify({ moduleId: 'sql/workbench/contrib/welcome/page/browser/az_data_welcome_page' })
			});
		this.editorInput = this.instantiationService.createInstance(WalkThroughInput, {
			typeId: welcomeInputTypeId,
			name: localize('welcome.title', "Welcome"),
			resource,
			telemetryFrom,
			onReady: (container: HTMLElement) => this.onReady(container, recentlyOpened, installedExtensions, fileService, layoutService)
		});
	}

	public openEditor() {
		return this.editorService.openEditor(this.editorInput, { pinned: false });
	}

	private onReady(container: HTMLElement, recentlyOpened: Promise<IRecentlyOpened>, installedExtensions: Promise<IExtensionStatus[]>, fileService: IFileService, layoutService: ILayoutService): void {
		const enabled = isWelcomePageEnabled(this.configurationService, this.contextService);
		const showOnStartup = <HTMLInputElement>container.querySelector('#showOnStartup');
		const guidedTourEnabled = isGuidedTourEnabled(this.configurationService);
		if (enabled || guidedTourEnabled) {
			showOnStartup.setAttribute('checked', 'checked');
		}
		if (guidedTourEnabled) {
			this.enableGuidedTour();
		}

		showOnStartup.addEventListener('click', e => {
			this.configurationService.updateValue(configurationKey, showOnStartup.checked ? 'welcomePageWithTour' : 'newUntitledFile', ConfigurationTarget.USER);
		});
		const prodName = container.querySelector('.welcomePage .title .caption') as HTMLElement;
		if (prodName) {
			prodName.innerHTML = this.productService.nameLong;
		}
		const welcomeContainerContainer = document.querySelector('.welcomePageContainer').parentElement as HTMLElement;
		const adsHomepage = document.querySelector('.ads-homepage') as HTMLElement;
		adsHomepage.classList.add('responsive-container');
		const observer = new MutationObserver(parseMutations);
		observer.observe(welcomeContainerContainer, {
			attributes: true,
			attributeFilter: ['style']
		});

		const defaultBreakpoints = { XS: 435, SM: 608, MD: 824, LG: 906, XL: 1192 };
		const startingWidth = parseInt(welcomeContainerContainer.style.width);
		adsHomepage.classList.add('XS');
		Object.keys(defaultBreakpoints).forEach(function (breakpoint) {
			let minWidth = defaultBreakpoints[breakpoint];
			if (startingWidth >= minWidth) {
				adsHomepage.classList.add(breakpoint);
			}
			else {
				adsHomepage.classList.remove(breakpoint);
			}
		});
		function parseMutations(): void {
			const width = parseInt(welcomeContainerContainer.style.width);
			Object.keys(defaultBreakpoints).forEach(function (breakpoint) {
				let minWidth = defaultBreakpoints[breakpoint];
				if (width >= minWidth) {
					adsHomepage.classList.add(breakpoint);
				}
				else {
					adsHomepage.classList.remove(breakpoint);
				}
			});
		}

		recentlyOpened.then(async ({ workspaces }) => {
			// Filter out the current workspace
			workspaces = workspaces.filter(recent => !this.contextService.isCurrentWorkspace(isRecentWorkspace(recent) ? recent.workspace : recent.folderUri));
			if (!workspaces.length) {
				const recent = container.querySelector('.welcomePage') as HTMLElement;
				const moreRecent = container.querySelector('.moreRecent') as HTMLElement;
				moreRecent.remove();
				recent.classList.add('emptyRecent');

				return;
			}
			const ul = container.querySelector('.recent ul') as HTMLElement;
			if (!ul) {
				return;
			}

			const workspacesToShow = workspaces.slice(0, 5);
			clearNode(ul);
			await this.mapListEntries(workspacesToShow, container);
		}).then(undefined, onUnexpectedError);
		this.addExtensionList(container, '.extension-list');
		this.addExtensionPack(container, '.extensionPack');
		this.updateInstalledExtensions(container, installedExtensions);
		this._register(this.instantiationService.invokeFunction(onExtensionChanged)(ids => {
			for (const id of ids) {
				if (container.querySelector(`.installExtension[data-extension="${id.id}"], .enabledExtension[data-extension="${id.id}"]`)) {
					const installedExtensions = this.instantiationService.invokeFunction(getInstalledExtensions);
					this.updateInstalledExtensions(container, installedExtensions);
					break;
				}
			}
		}));
		this.createButtons(container);
	}

	private createButtons(welcomePageContainer: HTMLElement): void {
		const container = welcomePageContainer.querySelector('#welcome-page-button-container');

		// New button, contains a down arrow, invoking the button will open a context menu.
		const newButtonContainer = document.createElement('div');
		newButtonContainer.classList.add('btn', 'btn-primary');
		container.appendChild(newButtonContainer);
		const newButton = this._register(new Button(newButtonContainer));
		newButton.label = localize('welcomePage.new', "New");
		const newButtonHtmlElement = newButton.element;
		newButtonHtmlElement.setAttribute('aria-haspopup', 'true');
		newButtonHtmlElement.setAttribute('aria-controls', 'dropdown');
		newButtonHtmlElement.setAttribute('aria-expanded', 'false');
		const newButtonIcon = document.createElement('div');
		newButtonIcon.classList.add('codicon', 'codicon-chevron-down');
		newButtonHtmlElement.appendChild(newButtonIcon);

		newButton.onDidClick(() => {
			this.contextMenuService.showContextMenu({
				getAnchor: () => newButtonHtmlElement,
				getActions: () => NewActionItems.map(command => new MenuItemAction(command, undefined, {}, this.contextKeyService, this.commandService))
			});
		});

		// Secondary buttons
		// We are handling macOS specially here because the same dialog is being used to select both file and folder on macOS.
		const macSecondaryButtons = [
			{
				command: 'workbench.action.files.openLocalFileFolder',
				title: localize('welcomePage.open', "Open…")
			}
		];

		const nonMacSecondaryButtons = [
			{
				command: 'workbench.action.files.openFile',
				title: localize('welcomePage.openFile', "Open file…")
			},
			{
				command: 'workbench.action.files.openFolder',
				title: localize('welcomePage.openFolder', "Open folder…")
			}
		];

		const secondaryButtons = document.body.classList.contains('mac') ? macSecondaryButtons : nonMacSecondaryButtons;

		secondaryButtons.forEach(item => {

			const btnContainer = document.createElement('div');
			btnContainer.classList.add('btn', 'btn-secondary');
			container.appendChild(btnContainer);
			const secondaryButton = this._register(new Button(btnContainer));
			secondaryButton.label = item.title;
			secondaryButton.element.classList.add('btn-secondary');
			secondaryButton.onDidClick(async () => {
				await this.commandService.executeCommand(item.command);
			});
		});
	}

	private enableGuidedTour(): void {
		const guidedTour = this.instantiationService.createInstance(GuidedTour);
		const adsHomepage = document.querySelector('.ads-homepage');
		const guidedTourNotificationContainer = document.createElement('div');
		const p = document.createElement('p');
		const b = document.createElement('b');
		const icon = document.createElement('div');
		const containerLeft = document.createElement('div');
		const containerRight = document.createElement('div');
		let startTourBtn = new Button(containerRight);
		startTourBtn.label = localize('welcomePage.startTour', "Start Tour");
		const removeTourBtn = document.createElement('a');
		removeTourBtn.setAttribute('role', 'button');
		removeTourBtn.tabIndex = 0;
		removeTourBtn.title = localize('closeTourBar', "Close quick tour bar");
		const removeBtnClasses = ['btn-remove-tour', 'codicon', 'codicon-close'];
		const flexClassesLeft = ['flex', 'flex-a-center'];
		const flexClassesRight = ['flex', 'flex-a-start'];
		guidedTourNotificationContainer.id = 'guidedTourBanner';
		guidedTourNotificationContainer.classList.add('guided-tour-banner');
		containerLeft.classList.add(...flexClassesLeft);
		containerRight.classList.add(...flexClassesRight);
		removeTourBtn.classList.add(...removeBtnClasses);
		p.appendChild(b);
		p.innerText = localize('WelcomePage.TakeATour', "Would you like to take a quick tour of Azure Data Studio?");
		b.innerText = localize('WelcomePage.welcome', "Welcome!");


		containerLeft.appendChild(icon);
		containerLeft.appendChild(p);
		containerRight.appendChild(removeTourBtn);

		guidedTourNotificationContainer.appendChild(containerLeft);
		guidedTourNotificationContainer.appendChild(containerRight);

		startTourBtn.onDidClick((e) => {
			this.configurationService.updateValue(configurationKey, 'welcomePageWithTour', ConfigurationTarget.USER);
			this.layoutService.setSideBarHidden(true);
			guidedTour.create();
		});


		removeTourBtn.addEventListener('click', (e: MouseEvent) => {
			this.configurationService.updateValue(configurationKey, 'welcomePage', ConfigurationTarget.USER);
			guidedTourNotificationContainer.classList.add('hide');
			guidedTourNotificationContainer.classList.remove('show');
		});

		adsHomepage.prepend(guidedTourNotificationContainer);

		setTimeout(function () {
			guidedTourNotificationContainer.classList.add('show');

		}, 3000);
	}

	private async createListEntries(container: HTMLElement, fullPath: string, windowOpenable: IWindowOpenable): Promise<HTMLElement[]> {
		let result: HTMLElement[] = [];
		const { name, parentPath } = splitName(fullPath);
		const li = document.createElement('li');
		const icon = document.createElement('i');
		const a = document.createElement('a');
		const span = document.createElement('span');
		icon.title = fullPath;
		a.innerText = name;
		a.title = fullPath;
		a.setAttribute('aria-label', localize('welcomePage.openFolderWithPath', "Open folder {0} with path {1}", name, parentPath));
		a.setAttribute('role', 'button');
		a.href = 'javascript:void(0)';

		a.addEventListener('click', e => {
			this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', {
				id: 'openRecentFolder',
				from: telemetryFrom
			});
			this.hostService.openWindow([windowOpenable], { forceNewWindow: e.ctrlKey || e.metaKey });
			e.preventDefault();
			e.stopPropagation();
		});
		icon.classList.add('themed-icon');

		li.appendChild(icon);
		li.appendChild(a);
		span.classList.add('path');
		span.classList.add('detail');
		span.innerText = parentPath;
		span.title = parentPath;
		li.appendChild(span);
		const ul = container.querySelector('.list');
		ul.appendChild(li);
		result.push(li);
		return result;
	}

	private async mapListEntries(recents: (IRecentWorkspace | IRecentFolder)[], container: HTMLElement): Promise<HTMLElement[]> {
		const result: HTMLElement[] = [];
		for (let i = 0; i < recents.length; i++) {
			const recent = recents[i];
			let fullPath: string;
			let windowOpenable: IWindowOpenable;
			if (isRecentFolder(recent)) {
				windowOpenable = { folderUri: recent.folderUri };
				fullPath = recent.label || this.labelService.getWorkspaceLabel(recent.folderUri, { verbose: true });
			} else {
				fullPath = recent.label || this.labelService.getWorkspaceLabel(recent.workspace, { verbose: true });
				windowOpenable = { workspaceUri: recent.workspace.configPath };
			}
			const elements = await this.createListEntries(container, fullPath, windowOpenable);
			result.push(...elements);
		}
		return result;
	}

	private addExtensionList(container: HTMLElement, listSelector: string): void {
		const list = container.querySelector(listSelector);
		if (list) {
			extensions.forEach((extension, i) => {
				const flexDivContainerClasses = ['flex', 'flex-a-center', 'extension-inner'];
				const outerAnchorContainerElm = document.createElement('a');
				const flexDivContainerElm = document.createElement('div');
				const descriptionContainerElm = document.createElement('div');
				const imgContainerElm = document.createElement('div');
				const iconElm = document.createElement('img');
				iconElm.setAttribute('aria-label', extension.name);
				const pElm = document.createElement('p');
				const bodyElm = document.createElement('p');
				outerAnchorContainerElm.classList.add('extension');
				outerAnchorContainerElm.classList.add('tile');
				outerAnchorContainerElm.setAttribute('role', 'button');
				outerAnchorContainerElm.href = extension.link;
				flexDivContainerElm.classList.add(...flexDivContainerClasses);
				descriptionContainerElm.classList.add('description');
				imgContainerElm.classList.add('img-container');
				iconElm.classList.add('icon');
				pElm.classList.add('extension-header');
				iconElm.src = extension.icon;
				imgContainerElm.appendChild(iconElm);
				flexDivContainerElm.appendChild(imgContainerElm);
				flexDivContainerElm.appendChild(descriptionContainerElm);
				descriptionContainerElm.appendChild(pElm);
				descriptionContainerElm.appendChild(bodyElm);
				outerAnchorContainerElm.appendChild(flexDivContainerElm);
				pElm.innerText = extension.name;
				bodyElm.innerText = extension.description;
				list.appendChild(outerAnchorContainerElm);
			});
		}
	}

	private addExtensionPack(container: HTMLElement, anchorSelector: string): void {
		const btnContainer = container.querySelector(anchorSelector) as HTMLElement;

		if (btnContainer) {
			extensionPacks.forEach((extension) => {
				const installText = localize('welcomePage.install', "Install");
				let dropdownBtn = this._register(new Button(btnContainer));
				this._register(attachButtonStyler(dropdownBtn, this.themeService));
				dropdownBtn.label = installText;
				const classes = ['btn'];
				const getDropdownBtn = container.querySelector('.extensionPack .monaco-button:first-of-type') as HTMLAnchorElement;
				getDropdownBtn.id = 'dropdown-btn';
				getDropdownBtn.classList.add(...classes);
				getDropdownBtn.title = extension.title || (extension.isKeymap ? localize('welcomePage.installKeymap', "Install {0} keymap", extension.name) : localize('welcomePage.installExtensionPack', "Install additional support for {0}", extension.name));
				getDropdownBtn.setAttribute('aria-haspopup', 'true');
				getDropdownBtn.setAttribute('aria-controls', 'dropdown');
				getDropdownBtn.setAttribute('role', 'navigation');
				getDropdownBtn.id = 'dropdown-btn';
				getDropdownBtn.classList.add('installExtension');
				getDropdownBtn.setAttribute('data-extension', extension.id);
				getDropdownBtn.href = 'javascript:void(0)';

				getDropdownBtn.addEventListener('click', e => {
					this.installExtension(extension);
					e.preventDefault();
					e.stopPropagation();
				});


				const description = container.querySelector('.extension-pack-body');
				const header = container.querySelector('.extension-pack-header');

				const installedText = localize('welcomePage.installed', "Installed");
				let installedButton = new Button(btnContainer);
				installedButton.label = installedText;
				installedButton.enabled = false;
				const getInstalledButton = container.querySelector('.extensionPack .monaco-button:nth-of-type(2)') as HTMLAnchorElement;
				this._register(attachButtonStyler(installedButton, this.themeService));

				getInstalledButton.innerText = localize('welcomePage.installed', "Installed");
				getInstalledButton.title = extension.isKeymap ? localize('welcomePage.installedKeymap', "{0} keymap is already installed", extension.name) : localize('welcomePage.installedExtensionPack', "{0} support is already installed", extension.name);
				getInstalledButton.classList.add('enabledExtension');
				getInstalledButton.classList.add(...classes);
				getInstalledButton.setAttribute('data-extension', extension.id);
				description.innerHTML = extension.description;
				header.innerHTML = extension.name;
				this.addExtensionPackList(container, '.extension-pack-extension-list');
			});
		}
	}

	private addExtensionPackList(container: HTMLElement, listSelector: string): void {
		const list = container.querySelector(listSelector);
		if (list) {
			extensionPackExtensions.forEach((j) => {
				const outerContainerElem = document.createElement('div');
				const flexContainerElem = document.createElement('div');
				const iconContainerElem = document.createElement('img');
				iconContainerElem.setAttribute('aria-label', j.name);
				const descriptionContainerElem = document.createElement('div');
				const pElem = document.createElement('p');
				const anchorElem = document.createElement('a');
				const outerContainerClasses = ['extension-pack-extension-container', 'flex', 'flex-j-center'];
				const flexContainerClasses = ['flex', 'flex-a-center'];
				anchorElem.href = j.link;
				anchorElem.setAttribute('role', 'button');
				outerContainerElem.classList.add(...outerContainerClasses);
				flexContainerElem.classList.add(...flexContainerClasses);
				iconContainerElem.classList.add('icon');
				pElem.classList.add('extension-pack-extension-list-header');
				descriptionContainerElem.classList.add('description');
				outerContainerElem.appendChild(flexContainerElem);
				flexContainerElem.appendChild(iconContainerElem);
				flexContainerElem.appendChild(descriptionContainerElem);
				descriptionContainerElem.appendChild(anchorElem);
				anchorElem.appendChild(pElem);
				pElem.innerText = j.name;
				iconContainerElem.src = j.icon;
				list.appendChild(outerContainerElem);
			});
		}
	}


	private installExtension(extensionSuggestion: ExtensionSuggestion): void {
		/* __GDPR__FRAGMENT__
			"WelcomePageInstall-1" : {
				"from" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
				"extensionId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		this.telemetryService.publicLog(extensionPackStrings.installEvent, {
			from: telemetryFrom,
			extensionId: extensionSuggestion.id,
		});
		this.instantiationService.invokeFunction(getInstalledExtensions).then(extensions => {
			const installedExtension = extensions.find(extension => areSameExtensions(extension.identifier, { id: extensionSuggestion.id }));
			if (installedExtension && installedExtension.globallyEnabled) {
				/* __GDPR__FRAGMENT__
					"WelcomePageInstalled-1" : {
						"from" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
						"extensionId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
						"outcome": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
					}
				*/
				this.telemetryService.publicLog(extensionPackStrings.installedEvent, {
					from: telemetryFrom,
					extensionId: extensionSuggestion.id,
					outcome: 'already_enabled',
				});
				this.notificationService.info(extensionPackStrings.alreadyInstalled(extensionSuggestion.name));
				return;
			}
			const foundAndInstalled = installedExtension ? Promise.resolve(installedExtension.local) : this.extensionGalleryService.query({ names: [extensionSuggestion.id], source: telemetryFrom }, CancellationToken.None)
				.then((result): null | Promise<ILocalExtension | null> => {
					const [extension] = result.firstPage;
					if (!extension) {
						return null;
					}
					return this.extensionManagementService.installFromGallery(extension)
						.then(() => this.extensionManagementService.getInstalled(ExtensionType.User))
						.then(installed => {
							const local = installed.filter(i => areSameExtensions(extension.identifier, i.identifier))[0];
							// TODO: Do this as part of the install to avoid multiple events.
							return this.extensionEnablementService.setEnablement([local], EnablementState.DisabledGlobally).then(() => local);
						});
				});

			this.notificationService.prompt(
				Severity.Info,
				extensionPackStrings.reloadAfterInstall(extensionSuggestion.name),
				[{
					label: localize('ok', "OK"),
					run: () => {
						const messageDelay = new TimeoutTimer();
						messageDelay.cancelAndSet(() => {
							this.notificationService.info(extensionPackStrings.reloadAfterInstall(extensionSuggestion.name));
						}, 300);
						const extensionsToDisable = extensions.filter(extension => isKeymapExtension(this.tipsService, extension) && extension.globallyEnabled).map(extension => extension.local);
						extensionsToDisable.length ? this.extensionEnablementService.setEnablement(extensionsToDisable, EnablementState.DisabledGlobally) : Promise.resolve()
							.then(() => {
								return foundAndInstalled.then(foundExtension => {
									messageDelay.cancel();
									if (foundExtension) {
										return this.extensionEnablementService.setEnablement([foundExtension], EnablementState.EnabledGlobally)
											.then(() => {
												/* __GDPR__FRAGMENT__
													"WelcomePageInstalled-2" : {
														"from" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
														"extensionId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
														"outcome": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
													}
												*/
												this.telemetryService.publicLog(extensionPackStrings.installedEvent, {
													from: telemetryFrom,
													extensionId: extensionSuggestion.id,
													outcome: installedExtension ? 'enabled' : 'installed',
												});
												return this.hostService.reload();
											});
									} else {
										/* __GDPR__FRAGMENT__
											"WelcomePageInstalled-3" : {
												"from" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
												"extensionId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
												"outcome": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
											}
										*/
										this.telemetryService.publicLog(extensionPackStrings.installedEvent, {
											from: telemetryFrom,
											extensionId: extensionSuggestion.id,
											outcome: 'not_found',
										});
										this.notificationService.info(extensionPackStrings.extensionNotFound(extensionSuggestion.name, extensionSuggestion.id));
										return undefined;
									}
								});
							}).then(undefined, err => {
								/* __GDPR__FRAGMENT__
									"WelcomePageInstalled-4" : {
										"from" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
										"extensionId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
										"outcome": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
									}
								*/
								this.telemetryService.publicLog(extensionPackStrings.installedEvent, {
									from: telemetryFrom,
									extensionId: extensionSuggestion.id,
									outcome: isPromiseCanceledError(err) ? 'canceled' : 'error',
								});
								this.notificationService.error(err);
							});
					}
				}, {
					label: localize('details', "Details"),
					run: () => {
						/* __GDPR__FRAGMENT__
							"WelcomePageDetails-1" : {
								"from" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
								"extensionId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
							}
						*/
						this.telemetryService.publicLog(extensionPackStrings.detailsEvent, {
							from: telemetryFrom,
							extensionId: extensionSuggestion.id,
						});
						this.extensionsWorkbenchService.queryGallery({ names: [extensionSuggestion.id] }, CancellationToken.None)
							.then(result => this.extensionsWorkbenchService.open(result.firstPage[0]))
							.then(undefined, onUnexpectedError);
					}
				}]
			);
		}).then(undefined, err => {
			/* __GDPR__FRAGMENT__
				"WelcomePageInstalled-6" : {
					"from" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
					"extensionId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
					"outcome": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
				}
			*/
			this.telemetryService.publicLog(extensionPackStrings.installedEvent, {
				from: telemetryFrom,
				extensionId: extensionSuggestion.id,
				outcome: isPromiseCanceledError(err) ? 'canceled' : 'error',
			});
			this.notificationService.error(err);
		});
	}

	private updateInstalledExtensions(container: HTMLElement, installedExtensions: Promise<IExtensionStatus[]>) {
		installedExtensions.then(extensions => {
			const elements = container.querySelectorAll('.installExtension, .enabledExtension');
			for (let i = 0; i < elements.length; i++) {
				elements[i].classList.remove('installed');
			}
			extensions.filter(ext => ext.globallyEnabled)
				.map(ext => ext.identifier.id)
				.forEach(id => {
					const install = container.querySelectorAll(`.installExtension[data-extension="${id}"]`);
					for (let i = 0; i < install.length; i++) {
						install[i].classList.add('installed');
					}
					const enabled = container.querySelectorAll(`.enabledExtension[data-extension="${id}"]`);
					for (let i = 0; i < enabled.length; i++) {
						enabled[i].classList.add('installed');
					}
				});
		}).then(undefined, onUnexpectedError);
	}
}

export class WelcomeInputSerializer implements IEditorSerializer {

	static readonly ID = welcomeInputTypeId;

	public canSerialize(editorInput: EditorInput): boolean {
		return true;
	}

	public serialize(editorInput: EditorInput): string {
		return '{}';
	}

	public deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): WalkThroughInput {
		return instantiationService.createInstance(WelcomePage)
			.editorInput;
	}
}

// theming
export const welcomePageBackground = registerColor('welcomePage.background', { light: null, dark: null, hc: null }, localize('welcomePage.background', 'Background color for the Welcome page.'));

registerThemingParticipant((theme, collector) => {
	const backgroundColor = theme.getColor(welcomePageBackground);
	if (backgroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer { background-color: ${backgroundColor}; }`);
	}
	const tileBackgroundColor = theme.getColor(inputBackground);
	if (tileBackgroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .tile:not(.extension):not(.extension-pack) { background-color: ${tileBackgroundColor};  }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .btn-secondary .monaco-button { background-color: ${tileBackgroundColor} !important;  }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .tool-tip .tool-tip-text { background-color: ${tileBackgroundColor};  }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .modal-content { background-color: ${tileBackgroundColor};  }`);
	}
	const tileBorderColor = theme.getColor(tileBorder);
	if (tileBorderColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .tile:not(.extension):not(.extension-pack) { border-color: ${tileBorderColor}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .tool-tip .tool-tip-text:after { border-color: transparent transparent ${tileBorderColor}; transparent }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .tool-tip .tool-tip-text { border: 1px solid ${tileBorderColor};  }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .modal-content { border: 1px solid ${tileBorderColor};  }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .dropdown-content{ border: 1px solid ${tileBorderColor};  }`);
	}
	const tileBoxShadowColor = theme.getColor(tileBoxShadow);
	if (tileBoxShadowColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .tile:not(.extension):not(.extension-pack) { box-shadow: 0px 1px 4px ${tileBoxShadowColor}; }`);
	}

	const buttonForegroundColor = theme.getColor(buttonForeground);
	if (buttonForegroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .btn-primary { color: ${buttonForegroundColor};}`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .icon-arrow-down:before { color: ${buttonForegroundColor};}`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .extension-pack-body { color: ${buttonForegroundColor};}`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .extension-pack-header { color: ${buttonForegroundColor};}`);
	}
	const listFocusForegroundColor = theme.getColor(listFocusForeground);
	if (listFocusForegroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content a:hover, .monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content a:hover { color: ${buttonForegroundColor};}`);
	}
	const listFocusBackgroundColor = theme.getColor(listFocusBackground);
	if (listFocusBackgroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content a:hover, .monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content a:focus { background: ${listFocusBackgroundColor};}`);
	}
	const buttonHoverBackgroundColor = theme.getColor(buttonHoverBackground);
	if (buttonHoverBackgroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .btn-primary:hover { background-color: ${buttonHoverBackgroundColor}}`);
	}
	const buttonSecondaryBackgroundColor = theme.getColor(buttonSecondaryBackground);
	if (buttonSecondaryBackgroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .btn-secondary { background-color: ${buttonSecondaryBackgroundColor}}`);
	}
	const buttonSecondaryBorderColor = theme.getColor(buttonSecondaryBorder);
	if (buttonSecondaryBorderColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .btn-secondary .monaco-button{ border: 1px solid ${buttonSecondaryBorderColor}}`);
	}
	const buttonSecondaryColor = theme.getColor(buttonSecondaryForeground);
	if (buttonSecondaryColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .btn-secondary { color: ${buttonSecondaryColor} !important}`);
	}
	const buttonSecondaryHover = theme.getColor(buttonSecondaryHoverBackground);
	if (buttonSecondaryColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .btn-secondary:hover:not(.disabled) { background-color: ${buttonSecondaryHover};}`);
	}
	const selectBackgroundColor = theme.getColor(selectBackground);
	if (selectBackgroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content { background: ${selectBackgroundColor};}`);
	}
	const menuForegroundColor = theme.getColor(menuForeground);
	if (menuForegroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content a { color: ${menuForegroundColor};}`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .icon-arrow-down-dark:before { color: ${menuForegroundColor};}`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .ads-homepage-section .history .moreRecent-list li.moreRecent a { color: ${menuForegroundColor};}`);
	}
	const hoverShadowColor = theme.getColor(hoverShadow);
	if (hoverShadowColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .tile:hover:not(.no-hover) { box-shadow: 0px 3px 8px ${hoverShadowColor}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content { box-shadow: 0px 4px 4px ${hoverShadowColor};}`);
	}
	const menuBorderColor = theme.getColor(menuBorder);
	if (menuBorderColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .dropdown-content a { border-color: ${menuBorderColor};}`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .ads-homepage .dropdown-content { border-color: ${menuBorderColor};}`);
	}
	const editorWidgetBorderColor = theme.getColor(editorWidgetBorder);
	if (editorWidgetBorderColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .tile.extension-pack { border-color: ${editorWidgetBorderColor};}`);
	}
	const extensionPackHeaderTextShadow = theme.getColor(extensionPackHeaderShadow);
	if (extensionPackHeaderTextShadow) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .extension-pack-header { text-shadow: 0px 4px 4px ${extensionPackHeaderTextShadow};}`);
	}
	const extensionPackGradientColorOne = theme.getColor(extensionPackGradientColorOneColor);
	const extensionPackGradientColorTwo = theme.getColor(extensionPackGradientColorTwoColor);
	if (extensionPackGradientColorOne && extensionPackGradientColorTwo) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .extension-pack-description:before { background-image: linear-gradient(0.49deg, ${extensionPackGradientColorOne} 82.75%, ${extensionPackGradientColorTwo});}`);
	}
	const selectBorderColor = theme.getColor(selectBorder);
	if (selectBorderColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .ads-homepage-section .history .list li:not(.moreRecent), .monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .ads-homepage-section .history .list-header-container, .monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .ads-homepage-section .pinned .list li:not(.moreRecent), .monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .ads-homepage-section .pinned .list-header-container { border-color: ${selectBorderColor};}`);
	}
	const descriptionColor = theme.getColor(descriptionForeground);
	if (descriptionColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .detail { color: ${descriptionColor}; }`);
	}
	const disabledButtonColor = theme.getColor(buttonDisabledForeground);
	if (disabledButtonColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .btn:disabled { color: ${disabledButtonColor}; }`);
	}
	const disabledButtonBackgroundColor = theme.getColor(buttonDisabledBackground);
	if (disabledButtonColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .btn:disabled { background: ${disabledButtonBackgroundColor}; }`);
	}
	const foregroundColor = theme.getColor(foreground);
	if (foregroundColor) {
		collector.addRule(`
		.monaco-workbench .part.editor > .content .welcomePage a p,
		.monaco-workbench .part.editor > .content .welcomePage a h3,
		.monaco-workbench .part.editor > .content .welcomePage a h4 { color: ${foregroundColor}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .ads-homepage .resources .label { color: ${foregroundColor}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .ads-homepage-section .history .list li a { color: ${foregroundColor};}`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .ads-homepage .resources .label { color: ${foregroundColor}; }`);
	}
	const link = theme.getColor(textLinkForeground);
	if (link) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage a.ads-welcome-page-link { color: ${link}; }`);
	}
	const activeLink = theme.getColor(textLinkActiveForeground);
	if (activeLink) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage a:hover, .monaco-workbench .part.editor > .content .welcomePage a:active { color: ${activeLink}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .ads-homepage .themed-icon-alt { background-color: ${activeLink}; }`);
	}
	const activeBorder = theme.getColor(activeContrastBorder);
	if (activeBorder) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .commands .item button:hover { outline-color: ${activeBorder}; }`);
	}
	const focusBorderColor = theme.getColor(focusBorder);
	if (focusBorderColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .ads-homepage #dropdown-btn:focus { outline-color: ${focusBorderColor}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage *:focus { outline: 1px solid ${focusBorderColor}} `);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .header-bottom-nav-tile-link:focus { outline: 1px solid ${focusBorderColor}} `);
	}
	const iconForegroundColor = theme.getColor(iconForeground);
	if (iconForegroundColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .entity { color: ${iconForegroundColor}; }`);
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePage .ads-homepage .themed-icon { background-color: ${iconForegroundColor}; }`);
	}
	const gradientOneColor = theme.getColor(gradientOne);
	const gradientTwoColor = theme.getColor(gradientTwo);
	const gradientBackgroundColor = theme.getColor(gradientBackground);
	if (gradientTwoColor && gradientOneColor) {
		collector.addRule(`.monaco-workbench .part.editor > .content .welcomePageContainer .ads-homepage .gradient { background-image: linear-gradient(0deg, ${gradientOneColor} 0%, ${gradientTwoColor} 100%); background-color: ${gradientBackgroundColor}}`);
	}
});
