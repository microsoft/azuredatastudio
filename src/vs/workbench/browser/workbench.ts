/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/workbench/browser/style';

import { localize } from 'vs/nls';
import { setFileNameComparer } from 'vs/base/common/comparers';
import { Event, Emitter, setGlobalLeakWarningThreshold } from 'vs/base/common/event';
import { addClasses, addClass, removeClasses } from 'vs/base/browser/dom';
import { runWhenIdle, IdleValue } from 'vs/base/common/async';
import { getZoomLevel } from 'vs/base/browser/browser';
import { mark } from 'vs/base/common/performance';
import { onUnexpectedError, setUnexpectedErrorHandler } from 'vs/base/common/errors';
import { Registry } from 'vs/platform/registry/common/platform';
import { isWindows, isLinux } from 'vs/base/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IEditorInputFactoryRegistry, Extensions as EditorExtensions } from 'vs/workbench/common/editor';
import { IActionBarRegistry, Extensions as ActionBarExtensions } from 'vs/workbench/browser/actions';
import { getServices } from 'vs/platform/instantiation/common/extensions';
import { Position, Parts, IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IFileService } from 'vs/platform/files/common/files';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { LifecyclePhase, ILifecycleService, WillShutdownEvent } from 'vs/platform/lifecycle/common/lifecycle';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { NotificationService } from 'vs/workbench/services/notification/common/notificationService';
import { NotificationsCenter } from 'vs/workbench/browser/parts/notifications/notificationsCenter';
import { NotificationsAlerts } from 'vs/workbench/browser/parts/notifications/notificationsAlerts';
import { NotificationsStatus } from 'vs/workbench/browser/parts/notifications/notificationsStatus';
import { registerNotificationCommands } from 'vs/workbench/browser/parts/notifications/notificationsCommands';
import { NotificationsToasts } from 'vs/workbench/browser/parts/notifications/notificationsToasts';
import { IEditorService, IResourceEditor } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { setARIAContainer } from 'vs/base/browser/ui/aria/aria';
import { restoreFontInfo, readFontInfo, saveFontInfo } from 'vs/editor/browser/config/configuration';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { ILogService } from 'vs/platform/log/common/log';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { WorkbenchContextKeysHandler } from 'vs/workbench/browser/contextkeys';
import { coalesce } from 'vs/base/common/arrays';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { Layout } from 'vs/workbench/browser/layout';

// {{SQL CARBON EDIT}}
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { ConnectionDialogService } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ErrorMessageService } from 'sql/workbench/services/errorMessage/browser/errorMessageService';
import { ServerGroupController } from 'sql/workbench/services/serverGroup/browser/serverGroupController';
import { IServerGroupController } from 'sql/platform/serverGroup/common/serverGroupController';
import { IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';
import { AngularEventingService } from 'sql/platform/angularEventing/node/angularEventingService';
import { ICapabilitiesService, CapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ICredentialsService, CredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { ISerializationService, SerializationService } from 'sql/platform/serialization/common/serializationService';
import { IMetadataService, MetadataService } from 'sql/platform/metadata/common/metadataService';
import { IObjectExplorerService, ObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { ITaskService, TaskService } from 'sql/platform/taskHistory/common/taskService';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { QueryModelService } from 'sql/platform/query/common/queryModelService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { QueryEditorService } from 'sql/workbench/services/queryEditor/browser/queryEditorService';
import { IQueryManagementService, QueryManagementService } from 'sql/platform/query/common/queryManagement';
import { IEditorDescriptorService, EditorDescriptorService } from 'sql/workbench/services/queryEditor/common/editorDescriptorService';
import { IScriptingService, ScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IAdminService, AdminService } from 'sql/workbench/services/admin/common/adminService';
import { IJobManagementService } from 'sql/platform/jobManagement/common/interfaces';
import { JobManagementService } from 'sql/platform/jobManagement/common/jobManagementService';
import { IDacFxService, DacFxService } from 'sql/platform/dacfx/common/dacFxService';
import { IBackupService } from 'sql/platform/backup/common/backupService';
import { BackupService } from 'sql/platform/backup/common/backupServiceImp';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';
import { BackupUiService } from 'sql/workbench/services/backup/browser/backupUiService';
import { IRestoreDialogController, IRestoreService } from 'sql/platform/restore/common/restoreService';
import { RestoreService, RestoreDialogController } from 'sql/platform/restore/common/restoreServiceImpl';
import { INewDashboardTabDialogService } from 'sql/workbench/services/dashboard/common/newDashboardTabDialog';
import { NewDashboardTabDialogService } from 'sql/workbench/services/dashboard/browser/newDashboardTabDialogService';
import { IFileBrowserService } from 'sql/platform/fileBrowser/common/interfaces';
import { FileBrowserService } from 'sql/platform/fileBrowser/common/fileBrowserService';
import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { FileBrowserDialogController } from 'sql/workbench/services/fileBrowser/browser/fileBrowserDialogController';
import { IInsightsDialogService } from 'sql/workbench/services/insights/common/insightsDialogService';
import { InsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { IAccountManagementService } from 'sql/platform/accountManagement/common/interfaces';
import { AccountManagementService } from 'sql/workbench/services/accountManagement/browser/accountManagementService';
import { IProfilerService } from 'sql/workbench/services/profiler/common/interfaces';
import { ProfilerService } from 'sql/workbench/services/profiler/common/profilerService';
import { ISqlOAuthService } from 'sql/platform/oAuth/common/sqlOAuthService';
import { SqlOAuthService } from 'sql/platform/oAuth/electron-browser/sqlOAuthServiceImpl';
import { IClipboardService as sqlIClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ClipboardService as sqlClipboardService } from 'sql/platform/clipboard/electron-browser/clipboardService';
import { AccountPickerService } from 'sql/platform/accountManagement/browser/accountPickerService';
import { IAccountPickerService } from 'sql/platform/accountManagement/common/accountPicker';
import { IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { ResourceProviderService } from 'sql/workbench/services/resourceProvider/browser/resourceProviderService';
import { IDashboardViewService } from 'sql/platform/dashboard/common/dashboardViewService';
import { DashboardViewService } from 'sql/platform/dashboard/common/dashboardViewServiceImpl';
import { IModelViewService } from 'sql/platform/modelComponents/common/modelViewService';
import { ModelViewService } from 'sql/platform/modelComponents/common/modelViewServiceImpl';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { DashboardService } from 'sql/platform/dashboard/browser/dashboardServiceImpl';
import { NotebookService } from 'sql/workbench/services/notebook/common/notebookServiceImpl';
import { INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { ICommandLineProcessing } from 'sql/workbench/services/commandLine/common/commandLine';
import { CommandLineService } from 'sql/workbench/services/commandLine/common/commandLineService';
import { OEShimService, IOEShimService } from 'sql/parts/objectExplorer/common/objectExplorerViewTreeShim';
// {{SQL CARBON EDIT}} - End

export class Workbench extends Layout {

	private readonly _onShutdown = this._register(new Emitter<void>());
	get onShutdown(): Event<void> { return this._onShutdown.event; }

	private readonly _onWillShutdown = this._register(new Emitter<WillShutdownEvent>());
	get onWillShutdown(): Event<WillShutdownEvent> { return this._onWillShutdown.event; }

	constructor(
		parent: HTMLElement,
		private readonly serviceCollection: ServiceCollection,
		logService: ILogService
	) {
		super(parent);

		this.registerErrorHandler(logService);
	}

	private registerErrorHandler(logService: ILogService): void {

		// Listen on unhandled rejection events
		window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {

			// See https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
			onUnexpectedError(event.reason);

			// Prevent the printing of this event to the console
			event.preventDefault();
		});

		// Install handler for unexpected errors
		setUnexpectedErrorHandler(error => this.handleUnexpectedError(error, logService));

		// Inform user about loading issues from the loader
		(<any>self).require.config({
			onError: err => {
				if (err.errorCode === 'load') {
					onUnexpectedError(new Error(localize('loaderErrorNative', "Failed to load a required file. Please restart the application to try again. Details: {0}", JSON.stringify(err))));
				}
			}
		});
	}

	private previousUnexpectedError: { message: string | undefined, time: number } = { message: undefined, time: 0 };
	private handleUnexpectedError(error: any, logService: ILogService): void {
		const message = toErrorMessage(error, true);
		if (!message) {
			return;
		}

		const now = Date.now();
		if (message === this.previousUnexpectedError.message && now - this.previousUnexpectedError.time <= 1000) {
			return; // Return if error message identical to previous and shorter than 1 second
		}

		this.previousUnexpectedError.time = now;
		this.previousUnexpectedError.message = message;

		// Log it
		logService.error(message);
	}

	startup(): IInstantiationService {
		try {

			// Configure emitter leak warning threshold
			setGlobalLeakWarningThreshold(175);

			// Setup Intl for comparers
			setFileNameComparer(new IdleValue(() => {
				const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
				return {
					collator: collator,
					collatorIsNumeric: collator.resolvedOptions().numeric
				};
			}));

			// ARIA
			setARIAContainer(document.body);

			// Services
			const instantiationService = this.initServices(this.serviceCollection);

			instantiationService.invokeFunction(accessor => {
				const lifecycleService = accessor.get(ILifecycleService);
				const storageService = accessor.get(IStorageService);
				const configurationService = accessor.get(IConfigurationService);

				// Layout
				this.initLayout(accessor);

				// Registries
				this.initRegistries(accessor);

				// Context Keys
				this._register(instantiationService.createInstance(WorkbenchContextKeysHandler));

				// Register Listeners
				this.registerListeners(lifecycleService, storageService, configurationService);

				// Render Workbench
				this.renderWorkbench(instantiationService, accessor.get(INotificationService) as NotificationService, storageService, configurationService);

				// Workbench Layout
				this.createWorkbenchLayout(instantiationService);

				// Layout
				this.layout();

				// Restore
				this.restoreWorkbench(accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IViewletService), accessor.get(IPanelService), accessor.get(ILogService), lifecycleService).then(undefined, error => onUnexpectedError(error));
			});

			return instantiationService;
		} catch (error) {
			onUnexpectedError(error);

			throw error; // rethrow because this is a critical issue we cannot handle properly here
		}
	}

	// {{SQL CARBON EDIT}}
	/*
	private sendUsageEvents(telemetryService: ITelemetryService): void {
		const dailyLastUseDate = Date.parse(this.storageService.get('telemetry.dailyLastUseDate', StorageScope.GLOBAL, '0'));
		const weeklyLastUseDate = Date.parse(this.storageService.get('telemetry.weeklyLastUseDate', StorageScope.GLOBAL, '0'));
		const monthlyLastUseDate = Date.parse(this.storageService.get('telemetry.monthlyLastUseDate', StorageScope.GLOBAL, '0'));

		let today = new Date().toUTCString();

		// daily user event
		if (this.diffInDays(Date.parse(today), dailyLastUseDate) >= 1) {
			// daily first use
			telemetryService.publicLog('telemetry.dailyFirstUse', { dailyFirstUse: true });
			this.storageService.store('telemetry.dailyLastUseDate', today, StorageScope.GLOBAL);
		}

		// weekly user event
		if (this.diffInDays(Date.parse(today), weeklyLastUseDate) >= 7) {
			// weekly first use
			telemetryService.publicLog('telemetry.weeklyFirstUse', { weeklyFirstUse: true });
			this.storageService.store('telemetry.weeklyLastUseDate', today, StorageScope.GLOBAL);
		}

		// monthly user events
		if (this.diffInDays(Date.parse(today), monthlyLastUseDate) >= 30) {
			telemetryService.publicLog('telemetry.monthlyUse', { monthlyFirstUse: true });
			this.storageService.store('telemetry.monthlyLastUseDate', today, StorageScope.GLOBAL);
		}
	}

	// {{SQL CARBON EDIT}}
	private diffInDays(nowDate: number, lastUseDate: number): number {
		return (nowDate - lastUseDate) / (24 * 3600 * 1000);
	}
	*/

	private initServices(serviceCollection: ServiceCollection): IInstantiationService {

		// Layout Service
		serviceCollection.set(IWorkbenchLayoutService, this);

		//
		// NOTE: DO NOT ADD ANY OTHER SERVICE INTO THE COLLECTION HERE.
		// INSTEAD, CONTRIBUTE IT VIA WORKBENCH.MAIN.TS
		//

		// All Contributed Services
		const contributedServices = getServices();
		for (let contributedService of contributedServices) {
			serviceCollection.set(contributedService.id, contributedService.descriptor);
		}

		const instantationServie = new InstantiationService(serviceCollection, true);

		// {{SQL CARBON EDIT}}
		// SQL Tools services
		serviceCollection.set(IDashboardService, instantationServie.createInstance(DashboardService));
		serviceCollection.set(IDashboardViewService, instantationServie.createInstance(DashboardViewService));
		serviceCollection.set(IModelViewService, instantationServie.createInstance(ModelViewService));
		serviceCollection.set(IAngularEventingService, instantationServie.createInstance(AngularEventingService));
		serviceCollection.set(INewDashboardTabDialogService, instantationServie.createInstance(NewDashboardTabDialogService));
		serviceCollection.set(ISqlOAuthService, instantationServie.createInstance(SqlOAuthService));
		serviceCollection.set(sqlIClipboardService, instantationServie.createInstance(sqlClipboardService));
		serviceCollection.set(ICapabilitiesService, instantationServie.createInstance(CapabilitiesService));
		serviceCollection.set(IErrorMessageService, instantationServie.createInstance(ErrorMessageService));
		serviceCollection.set(IConnectionDialogService, instantationServie.createInstance(ConnectionDialogService));
		serviceCollection.set(IServerGroupController, instantationServie.createInstance(ServerGroupController));
		serviceCollection.set(ICredentialsService, instantationServie.createInstance(CredentialsService));
		serviceCollection.set(IResourceProviderService, instantationServie.createInstance(ResourceProviderService));
		serviceCollection.set(IAccountManagementService, instantationServie.createInstance(AccountManagementService, undefined));
		serviceCollection.set(IConnectionManagementService, instantationServie.createInstance(ConnectionManagementService, undefined, undefined));
		serviceCollection.set(ISerializationService, instantationServie.createInstance(SerializationService));
		serviceCollection.set(IQueryManagementService, instantationServie.createInstance(QueryManagementService));
		serviceCollection.set(IQueryModelService, instantationServie.createInstance(QueryModelService));
		serviceCollection.set(IQueryEditorService, instantationServie.createInstance(QueryEditorService));
		serviceCollection.set(IEditorDescriptorService, instantationServie.createInstance(EditorDescriptorService));
		serviceCollection.set(ITaskService, instantationServie.createInstance(TaskService));
		serviceCollection.set(IMetadataService, instantationServie.createInstance(MetadataService));
		serviceCollection.set(IObjectExplorerService, instantationServie.createInstance(ObjectExplorerService));
		serviceCollection.set(IOEShimService, instantationServie.createInstance(OEShimService));
		serviceCollection.set(IScriptingService, instantationServie.createInstance(ScriptingService));
		serviceCollection.set(IAdminService, instantationServie.createInstance(AdminService));
		serviceCollection.set(IJobManagementService, instantationServie.createInstance(JobManagementService));
		serviceCollection.set(IBackupService, instantationServie.createInstance(BackupService));
		serviceCollection.set(IBackupUiService, instantationServie.createInstance(BackupUiService));
		serviceCollection.set(IRestoreService, instantationServie.createInstance(RestoreService));
		serviceCollection.set(IRestoreDialogController, instantationServie.createInstance(RestoreDialogController));
		serviceCollection.set(IFileBrowserService, instantationServie.createInstance(FileBrowserService));
		serviceCollection.set(IFileBrowserDialogController, instantationServie.createInstance(FileBrowserDialogController));
		serviceCollection.set(IInsightsDialogService, instantationServie.createInstance(InsightsDialogService));
		serviceCollection.set(INotebookService, instantationServie.createInstance(NotebookService));
		serviceCollection.set(IAccountPickerService, instantationServie.createInstance(AccountPickerService));
		serviceCollection.set(IProfilerService, instantationServie.createInstance(ProfilerService));
		serviceCollection.set(ICommandLineProcessing, instantationServie.createInstance(CommandLineService));
		serviceCollection.set(IDacFxService, instantationServie.createInstance(DacFxService));

		// {{SQL CARBON EDIT}} - End

		// Wrap up
		instantationServie.invokeFunction(accessor => {
			const lifecycleService = accessor.get(ILifecycleService);

			// TODO@Ben TODO@Sandeep TODO@Martin debt around cyclic dependencies
			const fileService = accessor.get(IFileService);
			const instantiationService = accessor.get(IInstantiationService);
			const configurationService = accessor.get(IConfigurationService) as any;
			const themeService = accessor.get(IWorkbenchThemeService) as any;

			if (typeof configurationService.acquireFileService === 'function') {
				configurationService.acquireFileService(fileService);
			}

			if (typeof configurationService.acquireInstantiationService === 'function') {
				configurationService.acquireInstantiationService(instantiationService);
			}

			if (typeof themeService.acquireFileService === 'function') {
				themeService.acquireFileService(fileService);
			}

			// Signal to lifecycle that services are set
			lifecycleService.phase = LifecyclePhase.Ready;
		});

		return instantationServie;
	}

	private initRegistries(accessor: ServicesAccessor): void {
		Registry.as<IActionBarRegistry>(ActionBarExtensions.Actionbar).start(accessor);
		Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).start(accessor);
		Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).start(accessor);
	}

	private registerListeners(
		lifecycleService: ILifecycleService,
		storageService: IStorageService,
		configurationService: IConfigurationService
	): void {

		// Lifecycle
		this._register(lifecycleService.onWillShutdown(event => this._onWillShutdown.fire(event)));
		this._register(lifecycleService.onShutdown(() => {
			this._onShutdown.fire();
			this.dispose();
		}));

		// Storage
		this._register(storageService.onWillSaveState(() => saveFontInfo(storageService)));

		// Configuration changes
		this._register(configurationService.onDidChangeConfiguration(() => this.setFontAliasing(configurationService)));
	}

	private fontAliasing: 'default' | 'antialiased' | 'none' | 'auto';
	private setFontAliasing(configurationService: IConfigurationService) {
		const aliasing = configurationService.getValue<'default' | 'antialiased' | 'none' | 'auto'>('workbench.fontAliasing');
		if (this.fontAliasing === aliasing) {
			return;
		}

		this.fontAliasing = aliasing;

		// Remove all
		const fontAliasingValues: (typeof aliasing)[] = ['antialiased', 'none', 'auto'];
		removeClasses(this.container, ...fontAliasingValues.map(value => `monaco-font-aliasing-${value}`));

		// Add specific
		if (fontAliasingValues.some(option => option === aliasing)) {
			addClass(this.container, `monaco-font-aliasing-${aliasing}`);
		}
	}

	private renderWorkbench(instantiationService: IInstantiationService, notificationService: NotificationService, storageService: IStorageService, configurationService: IConfigurationService): void {

		// State specific classes
		const platformClass = isWindows ? 'windows' : isLinux ? 'linux' : 'mac';
		const workbenchClasses = coalesce([
			'monaco-workbench',
			platformClass,
			this.state.sideBar.hidden ? 'nosidebar' : undefined,
			this.state.panel.hidden ? 'nopanel' : undefined,
			this.state.statusBar.hidden ? 'nostatusbar' : undefined,
			this.state.fullscreen ? 'fullscreen' : undefined
		]);

		addClasses(this.container, ...workbenchClasses);
		addClasses(document.body, platformClass); // used by our fonts

		// Apply font aliasing
		this.setFontAliasing(configurationService);

		// Warm up font cache information before building up too many dom elements
		restoreFontInfo(storageService);
		readFontInfo(BareFontInfo.createFromRawSettings(configurationService.getValue('editor'), getZoomLevel()));

		// Create Parts
		[
			{ id: Parts.TITLEBAR_PART, role: 'contentinfo', classes: ['titlebar'] },
			{ id: Parts.ACTIVITYBAR_PART, role: 'navigation', classes: ['activitybar', this.state.sideBar.position === Position.LEFT ? 'left' : 'right'] },
			{ id: Parts.SIDEBAR_PART, role: 'complementary', classes: ['sidebar', this.state.sideBar.position === Position.LEFT ? 'left' : 'right'] },
			{ id: Parts.EDITOR_PART, role: 'main', classes: ['editor'], options: { restorePreviousState: this.state.editor.restoreEditors } },
			{ id: Parts.PANEL_PART, role: 'complementary', classes: ['panel', this.state.panel.position === Position.BOTTOM ? 'bottom' : 'right'] },
			{ id: Parts.STATUSBAR_PART, role: 'contentinfo', classes: ['statusbar'] }
		].forEach(({ id, role, classes, options }) => {
			const partContainer = this.createPart(id, role, classes);

			if (!configurationService.getValue('workbench.useExperimentalGridLayout')) {
				// TODO@Ben cleanup once moved to grid
				// Insert all workbench parts at the beginning. Issue #52531
				// This is primarily for the title bar to allow overriding -webkit-app-region
				this.container.insertBefore(partContainer, this.container.lastChild);
			}

			this.getPart(id).create(partContainer, options);
		});

		// Notification Handlers
		this.createNotificationsHandlers(instantiationService, notificationService);

		// Add Workbench to DOM
		this.parent.appendChild(this.container);
	}

	private createPart(id: string, role: string, classes: string[]): HTMLElement {
		const part = document.createElement('div');
		addClasses(part, 'part', ...classes);
		part.id = id;
		part.setAttribute('role', role);

		return part;
	}

	private createNotificationsHandlers(instantiationService: IInstantiationService, notificationService: NotificationService): void {

		// Instantiate Notification components
		const notificationsCenter = this._register(instantiationService.createInstance(NotificationsCenter, this.container, notificationService.model));
		const notificationsToasts = this._register(instantiationService.createInstance(NotificationsToasts, this.container, notificationService.model));
		this._register(instantiationService.createInstance(NotificationsAlerts, notificationService.model));
		const notificationsStatus = instantiationService.createInstance(NotificationsStatus, notificationService.model);

		// Visibility
		this._register(notificationsCenter.onDidChangeVisibility(() => {
			notificationsStatus.update(notificationsCenter.isVisible);
			notificationsToasts.update(notificationsCenter.isVisible);
		}));

		// Register Commands
		registerNotificationCommands(notificationsCenter, notificationsToasts);
	}

	private restoreWorkbench(
		editorService: IEditorService,
		editorGroupService: IEditorGroupsService,
		viewletService: IViewletService,
		panelService: IPanelService,
		logService: ILogService,
		lifecycleService: ILifecycleService
	): Promise<void> {
		const restorePromises: Promise<any>[] = [];

		// Restore editors
		mark('willRestoreEditors');
		restorePromises.push(editorGroupService.whenRestored.then(() => {

			function openEditors(editors: IResourceEditor[], editorService: IEditorService) {
				if (editors.length) {
					return editorService.openEditors(editors);
				}

				return Promise.resolve(undefined);
			}

			if (Array.isArray(this.state.editor.editorsToOpen)) {
				return openEditors(this.state.editor.editorsToOpen, editorService);
			}

			return this.state.editor.editorsToOpen.then(editors => openEditors(editors, editorService));
		}).then(() => mark('didRestoreEditors')));

		// Restore Sidebar
		if (this.state.sideBar.viewletToRestore) {
			mark('willRestoreViewlet');
			restorePromises.push(viewletService.openViewlet(this.state.sideBar.viewletToRestore)
				.then(viewlet => {
					if (!viewlet) {
						return viewletService.openViewlet(viewletService.getDefaultViewletId()); // fallback to default viewlet as needed
					}

					return viewlet;
				})
				.then(() => mark('didRestoreViewlet')));
		}

		// Restore Panel
		if (this.state.panel.panelToRestore) {
			mark('willRestorePanel');
			panelService.openPanel(this.state.panel.panelToRestore);
			mark('didRestorePanel');
		}

		// Restore Zen Mode
		if (this.state.zenMode.restore) {
			this.toggleZenMode(true, true);
		}

		// Restore Editor Center Mode
		if (this.state.editor.restoreCentered) {
			this.centerEditorLayout(true);
		}

		// Emit a warning after 10s if restore does not complete
		const restoreTimeoutHandle = setTimeout(() => logService.warn('Workbench did not finish loading in 10 seconds, that might be a problem that should be reported.'), 10000);

		return Promise.all(restorePromises)
			.then(() => clearTimeout(restoreTimeoutHandle))
			.catch(error => onUnexpectedError(error))
			.finally(() => {

				// Set lifecycle phase to `Restored`
				lifecycleService.phase = LifecyclePhase.Restored;

				// Set lifecycle phase to `Eventually` after a short delay and when idle (min 2.5sec, max 5sec)
				setTimeout(() => {
					this._register(runWhenIdle(() => {
						lifecycleService.phase = LifecyclePhase.Eventually;
					}, 2500));
				}, 2500);

				// Telemetry: startup metrics
				mark('didStartWorkbench');
			});
	}
}
