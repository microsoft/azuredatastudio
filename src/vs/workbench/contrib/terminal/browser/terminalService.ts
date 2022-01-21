/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { AutoOpenBarrier, timeout } from 'vs/base/common/async';
import { Codicon, iconRegistry } from 'vs/base/common/codicons';
import { debounce, throttle } from 'vs/base/common/decorators';
import { Emitter, Event } from 'vs/base/common/event';
import { dispose, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { equals } from 'vs/base/common/objects';
import { isMacintosh, isWeb, isWindows, OperatingSystem, OS } from 'vs/base/common/platform';
import { URI } from 'vs/base/common/uri';
import { FindReplaceState } from 'vs/editor/contrib/find/findState';
import * as nls from 'vs/nls';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IInstantiationService, optional } from 'vs/platform/instantiation/common/instantiation';
import { ILabelService } from 'vs/platform/label/common/label';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IKeyMods, IPickOptions, IQuickInputButton, IQuickInputService, IQuickPickItem, IQuickPickSeparator } from 'vs/platform/quickinput/common/quickInput';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ICreateContributedTerminalProfileOptions, IExtensionTerminalProfile, IShellLaunchConfig, ITerminalLaunchError, ITerminalProfile, ITerminalProfileObject, ITerminalProfileType, ITerminalsLayoutInfo, ITerminalsLayoutInfoById, TerminalLocation, TerminalLocationString, TerminalSettingId, TerminalSettingPrefix } from 'vs/platform/terminal/common/terminal';
import { registerTerminalDefaultProfileConfiguration } from 'vs/platform/terminal/common/terminalPlatformConfiguration';
import { iconForeground } from 'vs/platform/theme/common/colorRegistry';
import { IconDefinition } from 'vs/platform/theme/common/iconRegistry';
import { ColorScheme } from 'vs/platform/theme/common/theme';
import { IThemeService, Themable, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { VirtualWorkspaceContext } from 'vs/workbench/browser/contextkeys';
import { IEditableData, IViewsService } from 'vs/workbench/common/views';
import { ICreateTerminalOptions, IRemoteTerminalService, IRequestAddInstanceToGroupEvent, ITerminalEditorService, ITerminalExternalLinkProvider, ITerminalFindHost, ITerminalGroup, ITerminalGroupService, ITerminalInstance, ITerminalInstanceHost, ITerminalInstanceService, ITerminalLocationOptions, ITerminalProfileProvider, ITerminalService, TerminalConnectionState, TerminalEditorLocation } from 'vs/workbench/contrib/terminal/browser/terminal';
import { refreshTerminalActions } from 'vs/workbench/contrib/terminal/browser/terminalActions';
import { TerminalConfigHelper } from 'vs/workbench/contrib/terminal/browser/terminalConfigHelper';
import { TerminalEditor } from 'vs/workbench/contrib/terminal/browser/terminalEditor';
import { getColorClass, getUriClasses } from 'vs/workbench/contrib/terminal/browser/terminalIcon';
import { configureTerminalProfileIcon } from 'vs/workbench/contrib/terminal/browser/terminalIcons';
import { getInstanceFromResource, getTerminalUri, parseTerminalUri } from 'vs/workbench/contrib/terminal/browser/terminalUri';
import { TerminalViewPane } from 'vs/workbench/contrib/terminal/browser/terminalView';
import { ILocalTerminalService, IOffProcessTerminalService, IRemoteTerminalAttachTarget, IStartExtensionTerminalRequest, ITerminalConfigHelper, ITerminalProcessExtHostProxy, TERMINAL_VIEW_ID } from 'vs/workbench/contrib/terminal/common/terminal';
import { TerminalContextKeys } from 'vs/workbench/contrib/terminal/common/terminalContextKey';
import { ITerminalContributionService } from 'vs/workbench/contrib/terminal/common/terminalExtensionPoints';
import { formatMessageForTerminal, terminalStrings } from 'vs/workbench/contrib/terminal/common/terminalStrings';
import { IEditorResolverService, RegisteredEditorPriority } from 'vs/workbench/services/editor/common/editorResolverService';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ILifecycleService, ShutdownReason, WillShutdownEvent } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';

export class TerminalService implements ITerminalService {
	declare _serviceBrand: undefined;

	private _hostActiveTerminals: Map<ITerminalInstanceHost, ITerminalInstance | undefined> = new Map();

	private _isShuttingDown: boolean;
	private _backgroundedTerminalInstances: ITerminalInstance[] = [];
	private _backgroundedTerminalDisposables: Map<number, IDisposable[]> = new Map();
	private _findState: FindReplaceState;
	private readonly _profileProviders: Map</*ext id*/string, Map</*provider id*/string, ITerminalProfileProvider>> = new Map();
	private _linkProviders: Set<ITerminalExternalLinkProvider> = new Set();
	private _linkProviderDisposables: Map<ITerminalExternalLinkProvider, IDisposable[]> = new Map();
	private _processSupportContextKey: IContextKey<boolean>;
	private readonly _localTerminalService?: ILocalTerminalService;
	private readonly _primaryOffProcessTerminalService?: IOffProcessTerminalService;
	private _defaultProfileName?: string;
	private _profilesReadyBarrier: AutoOpenBarrier;
	private _availableProfiles: ITerminalProfile[] | undefined;
	private _contributedProfiles: IExtensionTerminalProfile[] | undefined;
	private _configHelper: TerminalConfigHelper;
	private _remoteTerminalsInitPromise: Promise<void> | undefined;
	private _localTerminalsInitPromise: Promise<void> | undefined;
	private _connectionState: TerminalConnectionState;

	private _editable: { instance: ITerminalInstance, data: IEditableData } | undefined;

	get isProcessSupportRegistered(): boolean { return !!this._processSupportContextKey.get(); }
	get connectionState(): TerminalConnectionState { return this._connectionState; }
	get profilesReady(): Promise<void> { return this._profilesReadyBarrier.wait().then(() => { }); }
	get availableProfiles(): ITerminalProfile[] {
		this._refreshAvailableProfiles();
		return this._availableProfiles || [];
	}
	get allProfiles(): ITerminalProfileType[] | undefined {
		if (this._availableProfiles) {
			const profiles: ITerminalProfileType[] = [];
			profiles.concat(this._availableProfiles);
			profiles.concat(this._terminalContributionService.terminalProfiles);
			return profiles;
		}
		return undefined;
	}
	get configHelper(): ITerminalConfigHelper { return this._configHelper; }
	get instances(): ITerminalInstance[] {
		return this._terminalGroupService.instances.concat(this._terminalEditorService.instances);
	}

	get defaultLocation(): TerminalLocation { return this.configHelper.config.defaultLocation === TerminalLocationString.Editor ? TerminalLocation.Editor : TerminalLocation.Panel; }

	private _activeInstance: ITerminalInstance | undefined;
	get activeInstance(): ITerminalInstance | undefined {
		// Check if either an editor or panel terminal has focus and return that, regardless of the
		// value of _activeInstance. This avoids terminals created in the panel for example stealing
		// the active status even when it's not focused.
		for (const activeHostTerminal of this._hostActiveTerminals.values()) {
			if (activeHostTerminal?.hasFocus) {
				return activeHostTerminal;
			}
		}
		// Fallback to the last recorded active terminal if neither have focus
		return this._activeInstance;
	}

	private readonly _onDidChangeActiveGroup = new Emitter<ITerminalGroup | undefined>();
	get onDidChangeActiveGroup(): Event<ITerminalGroup | undefined> { return this._onDidChangeActiveGroup.event; }
	private readonly _onDidCreateInstance = new Emitter<ITerminalInstance>();
	get onDidCreateInstance(): Event<ITerminalInstance> { return this._onDidCreateInstance.event; }
	private readonly _onDidDisposeInstance = new Emitter<ITerminalInstance>();
	get onDidDisposeInstance(): Event<ITerminalInstance> { return this._onDidDisposeInstance.event; }
	private readonly _onDidFocusInstance = new Emitter<ITerminalInstance>();
	get onDidFocusInstance(): Event<ITerminalInstance> { return this._onDidFocusInstance.event; }
	private readonly _onDidReceiveProcessId = new Emitter<ITerminalInstance>();
	get onDidReceiveProcessId(): Event<ITerminalInstance> { return this._onDidReceiveProcessId.event; }
	private readonly _onDidReceiveInstanceLinks = new Emitter<ITerminalInstance>();
	get onDidReceiveInstanceLinks(): Event<ITerminalInstance> { return this._onDidReceiveInstanceLinks.event; }
	private readonly _onDidRequestStartExtensionTerminal = new Emitter<IStartExtensionTerminalRequest>();
	get onDidRequestStartExtensionTerminal(): Event<IStartExtensionTerminalRequest> { return this._onDidRequestStartExtensionTerminal.event; }
	private readonly _onDidChangeInstanceDimensions = new Emitter<ITerminalInstance>();
	get onDidChangeInstanceDimensions(): Event<ITerminalInstance> { return this._onDidChangeInstanceDimensions.event; }
	private readonly _onDidMaxiumumDimensionsChange = new Emitter<ITerminalInstance>();
	get onDidMaximumDimensionsChange(): Event<ITerminalInstance> { return this._onDidMaxiumumDimensionsChange.event; }
	private readonly _onDidChangeInstances = new Emitter<void>();
	get onDidChangeInstances(): Event<void> { return this._onDidChangeInstances.event; }
	private readonly _onDidChangeInstanceTitle = new Emitter<ITerminalInstance | undefined>();
	get onDidChangeInstanceTitle(): Event<ITerminalInstance | undefined> { return this._onDidChangeInstanceTitle.event; }
	private readonly _onDidChangeInstanceIcon = new Emitter<ITerminalInstance | undefined>();
	get onDidChangeInstanceIcon(): Event<ITerminalInstance | undefined> { return this._onDidChangeInstanceIcon.event; }
	private readonly _onDidChangeInstanceColor = new Emitter<ITerminalInstance | undefined>();
	get onDidChangeInstanceColor(): Event<ITerminalInstance | undefined> { return this._onDidChangeInstanceColor.event; }
	private readonly _onDidChangeActiveInstance = new Emitter<ITerminalInstance | undefined>();
	get onDidChangeActiveInstance(): Event<ITerminalInstance | undefined> { return this._onDidChangeActiveInstance.event; }
	private readonly _onDidChangeInstancePrimaryStatus = new Emitter<ITerminalInstance>();
	get onDidChangeInstancePrimaryStatus(): Event<ITerminalInstance> { return this._onDidChangeInstancePrimaryStatus.event; }
	private readonly _onDidInputInstanceData = new Emitter<ITerminalInstance>();
	get onDidInputInstanceData(): Event<ITerminalInstance> { return this._onDidInputInstanceData.event; }
	private readonly _onDidDisposeGroup = new Emitter<ITerminalGroup>();
	get onDidDisposeGroup(): Event<ITerminalGroup> { return this._onDidDisposeGroup.event; }
	private readonly _onDidChangeGroups = new Emitter<void>();
	get onDidChangeGroups(): Event<void> { return this._onDidChangeGroups.event; }
	private readonly _onDidRegisterProcessSupport = new Emitter<void>();
	get onDidRegisterProcessSupport(): Event<void> { return this._onDidRegisterProcessSupport.event; }
	private readonly _onDidChangeConnectionState = new Emitter<void>();
	get onDidChangeConnectionState(): Event<void> { return this._onDidChangeConnectionState.event; }
	private readonly _onDidChangeAvailableProfiles = new Emitter<ITerminalProfile[]>();
	get onDidChangeAvailableProfiles(): Event<ITerminalProfile[]> { return this._onDidChangeAvailableProfiles.event; }

	constructor(
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@ILabelService labelService: ILabelService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IDialogService private _dialogService: IDialogService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IRemoteAgentService private _remoteAgentService: IRemoteAgentService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IViewsService private _viewsService: IViewsService,
		@IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
		@IRemoteTerminalService private readonly _remoteTerminalService: IRemoteTerminalService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@ITerminalContributionService private readonly _terminalContributionService: ITerminalContributionService,
		@ITerminalEditorService private readonly _terminalEditorService: ITerminalEditorService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@ITerminalInstanceService private readonly _terminalInstanceService: ITerminalInstanceService,
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IThemeService private readonly _themeService: IThemeService,
		@optional(ILocalTerminalService) localTerminalService: ILocalTerminalService
	) {
		this._localTerminalService = localTerminalService;
		this._isShuttingDown = false;
		this._findState = new FindReplaceState();
		this._configHelper = _instantiationService.createInstance(TerminalConfigHelper);

		editorResolverService.registerEditor(
			`${Schemas.vscodeTerminal}:/**`,
			{
				id: TerminalEditor.ID,
				label: terminalStrings.terminal,
				priority: RegisteredEditorPriority.exclusive
			},
			{
				canHandleDiff: false,
				canSupportResource: uri => uri.scheme === Schemas.vscodeTerminal,
				singlePerResource: true
			},
			({ resource, options }) => {
				let instance = this.getInstanceFromResource(resource);
				if (instance) {
					const sourceGroup = this._terminalGroupService.getGroupForInstance(instance);
					if (sourceGroup) {
						sourceGroup.removeInstance(instance);
					}
				}
				const resolvedResource = this._terminalEditorService.resolveResource(instance || resource);
				const editor = this._terminalEditorService.getInputFromResource(resolvedResource) || { editor: resolvedResource };
				return {
					editor,
					options: {
						...options,
						pinned: true,
						forceReload: true,
						override: TerminalEditor.ID
					}
				} as any; // {{SQL CARBON EDIT}} Cast to avoid compile error due to strictNullChecks being false
			});

		this._forwardInstanceHostEvents(this._terminalGroupService);
		this._forwardInstanceHostEvents(this._terminalEditorService);
		this._terminalGroupService.onDidChangeActiveGroup(this._onDidChangeActiveGroup.fire, this._onDidChangeActiveGroup);
		_terminalInstanceService.onDidCreateInstance(instance => {
			this._initInstanceListeners(instance);
			this._onDidCreateInstance.fire(instance);
		});

		// the below avoids having to poll routinely.
		// we update detected profiles when an instance is created so that,
		// for example, we detect if you've installed a pwsh
		this.onDidCreateInstance(() => this._refreshAvailableProfiles());
		this.onDidReceiveInstanceLinks(instance => this._setInstanceLinkProviders(instance));

		// Hide the panel if there are no more instances, provided that VS Code is not shutting
		// down. When shutting down the panel is locked in place so that it is restored upon next
		// launch.
		this._terminalGroupService.onDidChangeActiveInstance(instance => {
			if (!instance && !this._isShuttingDown) {
				this._terminalGroupService.hidePanel();
			}
		});

		this._handleInstanceContextKeys();
		this._processSupportContextKey = TerminalContextKeys.processSupported.bindTo(this._contextKeyService);
		this._processSupportContextKey.set(!isWeb || this._remoteAgentService.getConnection() !== null);

		lifecycleService.onBeforeShutdown(async e => e.veto(this._onBeforeShutdown(e.reason), 'veto.terminal'));
		lifecycleService.onWillShutdown(e => this._onWillShutdown(e));

		this._configurationService.onDidChangeConfiguration(async e => {
			const platformKey = await this._getPlatformKey();
			if (e.affectsConfiguration(TerminalSettingPrefix.DefaultProfile + platformKey) ||
				e.affectsConfiguration(TerminalSettingPrefix.Profiles + platformKey) ||
				e.affectsConfiguration(TerminalSettingId.UseWslProfiles)) {
				this._refreshAvailableProfiles();
			}
		});

		// Register a resource formatter for terminal URIs
		labelService.registerFormatter({
			scheme: Schemas.vscodeTerminal,
			formatting: {
				label: '${path}',
				separator: ''
			}
		});

		const enableTerminalReconnection = this.configHelper.config.enablePersistentSessions;

		// Connect to the extension host if it's there, set the connection state to connected when
		// it's done. This should happen even when there is no extension host.
		this._connectionState = TerminalConnectionState.Connecting;

		const isPersistentRemote = !!this._environmentService.remoteAuthority && enableTerminalReconnection;
		let initPromise: Promise<any> = isPersistentRemote
			? this._remoteTerminalsInitPromise = this._reconnectToRemoteTerminals()
			: enableTerminalReconnection
				? this._localTerminalsInitPromise = this._reconnectToLocalTerminals()
				: Promise.resolve();
		this._primaryOffProcessTerminalService = !!this._environmentService.remoteAuthority ? this._remoteTerminalService : (this._localTerminalService || this._remoteTerminalService);
		this._primaryOffProcessTerminalService.onDidRequestDetach(async (e) => {
			const instanceToDetach = this.getInstanceFromResource(getTerminalUri(e.workspaceId, e.instanceId));
			if (instanceToDetach) {
				const persistentProcessId = instanceToDetach?.persistentProcessId;
				if (persistentProcessId && !instanceToDetach.shellLaunchConfig.isFeatureTerminal && !instanceToDetach.shellLaunchConfig.customPtyImplementation) {
					this._terminalEditorService.detachInstance(instanceToDetach);
					await instanceToDetach.detachFromProcess();
					await this._primaryOffProcessTerminalService?.acceptDetachInstanceReply(e.requestId, persistentProcessId);
				} else {
					// will get rejected without a persistentProcessId to attach to
					await this._primaryOffProcessTerminalService?.acceptDetachInstanceReply(e.requestId, undefined);
				}
			}
		});

		initPromise.then(() => this._setConnected());

		// Wait up to 5 seconds for profiles to be ready so it's assured that we know the actual
		// default terminal before launching the first terminal. This isn't expected to ever take
		// this long.
		this._profilesReadyBarrier = new AutoOpenBarrier(5000);
		this._refreshAvailableProfiles();

		// Create async as the class depends on `this`
		timeout(0).then(() => this._instantiationService.createInstance(TerminalEditorStyle, document.head));
	}

	getOffProcessTerminalService(): IOffProcessTerminalService | undefined {
		return this._primaryOffProcessTerminalService;
	}

	private _forwardInstanceHostEvents(host: ITerminalInstanceHost) {
		host.onDidChangeInstances(this._onDidChangeInstances.fire, this._onDidChangeInstances);
		host.onDidDisposeInstance(this._onDidDisposeInstance.fire, this._onDidDisposeInstance);
		host.onDidChangeActiveInstance(instance => this._evaluateActiveInstance(host, instance));
		host.onDidFocusInstance(instance => {
			this._onDidFocusInstance.fire(instance);
			this._evaluateActiveInstance(host, instance);
		});
		this._hostActiveTerminals.set(host, undefined);
	}

	private _evaluateActiveInstance(host: ITerminalInstanceHost, instance: ITerminalInstance | undefined) {
		// Track the latest active terminal for each host so that when one becomes undefined, the
		// TerminalService's active terminal is set to the last active terminal from the other host.
		// This means if the last terminal editor is closed such that it becomes undefined, the last
		// active group's terminal will be used as the active terminal if available.
		this._hostActiveTerminals.set(host, instance);
		if (instance === undefined) {
			for (const active of this._hostActiveTerminals.values()) {
				if (active) {
					instance = active;
				}
			}
		}
		this._activeInstance = instance;
		this._onDidChangeActiveInstance.fire(instance);
	}

	setActiveInstance(value: ITerminalInstance) {
		// If this was a hideFromUser terminal created by the API this was triggered by show,
		// in which case we need to create the terminal group
		if (value.shellLaunchConfig.hideFromUser) {
			this._showBackgroundTerminal(value);
		}
		if (value.target === TerminalLocation.Editor) {
			this._terminalEditorService.setActiveInstance(value);
		} else {
			this._terminalGroupService.setActiveInstance(value);
		}
	}

	async safeDisposeTerminal(instance: ITerminalInstance): Promise<void> {
		// Confirm on kill in the editor is handled by the editor input
		if (instance.target !== TerminalLocation.Editor &&
			instance.hasChildProcesses &&
			(this.configHelper.config.confirmOnKill === 'panel' || this.configHelper.config.confirmOnKill === 'always')) {

			const notConfirmed = await this._showTerminalCloseConfirmation(true);
			if (notConfirmed) {
				return;
			}
		}
		instance.dispose();
	}

	private _setConnected() {
		this._connectionState = TerminalConnectionState.Connected;
		this._onDidChangeConnectionState.fire();
	}

	private async _reconnectToRemoteTerminals(): Promise<void> {
		const layoutInfo = await this._remoteTerminalService.getTerminalLayoutInfo();
		this._remoteTerminalService.reduceConnectionGraceTime();
		const reconnectCounter = this._recreateTerminalGroups(layoutInfo);
		/* __GDPR__
			"terminalReconnection" : {
				"count" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
			}
		 */
		const data = {
			count: reconnectCounter
		};
		this._telemetryService.publicLog('terminalReconnection', data);
		// now that terminals have been restored,
		// attach listeners to update remote when terminals are changed
		this._attachProcessLayoutListeners();
	}

	private async _reconnectToLocalTerminals(): Promise<void> {
		if (!this._localTerminalService) {
			return;
		}
		const layoutInfo = await this._localTerminalService.getTerminalLayoutInfo();
		if (layoutInfo && layoutInfo.tabs.length > 0) {
			this._recreateTerminalGroups(layoutInfo);
		}
		// now that terminals have been restored,
		// attach listeners to update local state when terminals are changed
		this._attachProcessLayoutListeners();
	}

	private async _recreateTerminalGroups(layoutInfo?: ITerminalsLayoutInfo): Promise<number> {
		let reconnectCounter = 0;
		let activeGroup: ITerminalGroup | undefined;
		if (layoutInfo) {
			for (const groupLayout of layoutInfo.tabs) {
				const terminalLayouts = groupLayout.terminals.filter(t => t.terminal && t.terminal.isOrphan);
				if (terminalLayouts.length) {
					reconnectCounter += terminalLayouts.length;
					let terminalInstance: ITerminalInstance | undefined;
					let group: ITerminalGroup | undefined;
					for (const terminalLayout of terminalLayouts) {
						if (!terminalInstance) {
							// create group and terminal
							terminalInstance = await this.createTerminal({
								config: { attachPersistentProcess: terminalLayout.terminal! },
								location: TerminalLocation.Panel
							});
							group = this._terminalGroupService.getGroupForInstance(terminalInstance);
							if (groupLayout.isActive) {
								activeGroup = group;
							}
						} else {
							// add split terminals to this group
							await this.createTerminal({ config: { attachPersistentProcess: terminalLayout.terminal! }, location: { parentTerminal: terminalInstance } });
						}
					}
					const activeInstance = this.instances.find(t => {
						return t.shellLaunchConfig.attachPersistentProcess?.id === groupLayout.activePersistentProcessId;
					});
					if (activeInstance) {
						this.setActiveInstance(activeInstance);
					}
					group?.resizePanes(groupLayout.terminals.map(terminal => terminal.relativeSize));
				}
			}
			if (layoutInfo.tabs.length) {
				this._terminalGroupService.activeGroup = activeGroup;
			}
		}
		return reconnectCounter;
	}

	private _attachProcessLayoutListeners(): void {
		this.onDidChangeActiveGroup(() => this._saveState());
		this.onDidChangeActiveInstance(() => this._saveState());
		this.onDidChangeInstances(() => this._saveState());
		// The state must be updated when the terminal is relaunched, otherwise the persistent
		// terminal ID will be stale and the process will be leaked.
		this.onDidReceiveProcessId(() => this._saveState());
		this.onDidChangeInstanceTitle(instance => this._updateTitle(instance));
		this.onDidChangeInstanceIcon(instance => this._updateIcon(instance));
	}

	private _handleInstanceContextKeys(): void {
		const terminalIsOpenContext = TerminalContextKeys.isOpen.bindTo(this._contextKeyService);
		const updateTerminalContextKeys = () => {
			terminalIsOpenContext.set(this.instances.length > 0);
		};
		this.onDidChangeInstances(() => updateTerminalContextKeys());
	}

	async getActiveOrCreateInstance(): Promise<ITerminalInstance> {
		return this.activeInstance || this.createTerminal();
	}

	async setEditable(instance: ITerminalInstance, data?: IEditableData | null): Promise<void> {
		if (!data) {
			this._editable = undefined;
		} else {
			this._editable = { instance: instance, data };
		}
		const pane = this._viewsService.getActiveViewWithId<TerminalViewPane>(TERMINAL_VIEW_ID);
		const isEditing = this._isEditable(instance);
		pane?.terminalTabbedView?.setEditable(isEditing);
	}

	private _isEditable(instance: ITerminalInstance | undefined): boolean {
		return !!this._editable && (this._editable.instance === instance || !instance);
	}

	getEditableData(instance: ITerminalInstance): IEditableData | undefined {
		return this._editable && this._editable.instance === instance ? this._editable.data : undefined;
	}

	requestStartExtensionTerminal(proxy: ITerminalProcessExtHostProxy, cols: number, rows: number): Promise<ITerminalLaunchError | undefined> {
		// The initial request came from the extension host, no need to wait for it
		return new Promise<ITerminalLaunchError | undefined>(callback => {
			this._onDidRequestStartExtensionTerminal.fire({ proxy, cols, rows, callback });
		});
	}

	@throttle(2000)
	private async _refreshAvailableProfiles(): Promise<void> {
		const result = await this._detectProfiles();
		const profilesChanged = !equals(result, this._availableProfiles);
		const contributedProfilesChanged = !equals(this._terminalContributionService.terminalProfiles, this._contributedProfiles);
		if (profilesChanged || contributedProfilesChanged) {
			this._availableProfiles = result;
			this._contributedProfiles = Array.from(this._terminalContributionService.terminalProfiles);
			this._onDidChangeAvailableProfiles.fire(this._availableProfiles);
			this._profilesReadyBarrier.open();
			await this._refreshPlatformConfig(result);
		}
	}

	private async _refreshPlatformConfig(profiles: ITerminalProfile[]) {
		const env = await this._remoteAgentService.getEnvironment();
		registerTerminalDefaultProfileConfiguration({ os: env?.os || OS, profiles }, this._terminalContributionService.terminalProfiles);
		refreshTerminalActions(profiles);
	}

	private async _detectProfiles(includeDetectedProfiles?: boolean): Promise<ITerminalProfile[]> {
		if (!this._primaryOffProcessTerminalService) {
			return this._availableProfiles || [];
		}
		const platform = await this._getPlatformKey();
		this._defaultProfileName = this._configurationService.getValue(`${TerminalSettingPrefix.DefaultProfile}${platform}`);
		return this._primaryOffProcessTerminalService?.getProfiles(this._configurationService.getValue(`${TerminalSettingPrefix.Profiles}${platform}`), this._defaultProfileName, includeDetectedProfiles);
	}

	getDefaultProfileName(): string {
		if (!this._defaultProfileName) {
			throw new Error('no default profile');
		}
		return this._defaultProfileName;
	}

	private _onBeforeShutdown(reason: ShutdownReason): boolean | Promise<boolean> {
		if (this.instances.length === 0) {
			// No terminal instances, don't veto
			return false;
		}

		const shouldPersistTerminals = this._configHelper.config.enablePersistentSessions && reason === ShutdownReason.RELOAD;
		if (!shouldPersistTerminals) {
			const hasDirtyInstances = (
				(this.configHelper.config.confirmOnExit === 'always' && this.instances.length > 0) ||
				(this.configHelper.config.confirmOnExit === 'hasChildProcesses' && this.instances.some(e => e.hasChildProcesses))
			);
			if (hasDirtyInstances) {
				return this._onBeforeShutdownAsync();
			}
		}

		this._isShuttingDown = true;

		return false;
	}

	private async _onBeforeShutdownAsync(): Promise<boolean> {
		// veto if configured to show confirmation and the user chose not to exit
		const veto = await this._showTerminalCloseConfirmation();
		if (!veto) {
			this._isShuttingDown = true;
		}
		return veto;
	}

	private _onWillShutdown(e: WillShutdownEvent): void {
		// Don't touch processes if the shutdown was a result of reload as they will be reattached
		const shouldPersistTerminals = this._configHelper.config.enablePersistentSessions && e.reason === ShutdownReason.RELOAD;
		if (shouldPersistTerminals) {
			this.instances.forEach(instance => instance.detachFromProcess());
			return;
		}

		// Force dispose of all terminal instances
		this.instances.forEach(instance => instance.dispose(true));

		this._localTerminalService?.setTerminalLayoutInfo(undefined);
	}

	getFindState(): FindReplaceState {
		return this._findState;
	}

	@debounce(500)
	private _saveState(): void {
		if (!this.configHelper.config.enablePersistentSessions) {
			return;
		}
		const tabs = this._terminalGroupService.groups.map(g => g.getLayoutInfo(g === this._terminalGroupService.activeGroup));
		const state: ITerminalsLayoutInfoById = { tabs };
		this._primaryOffProcessTerminalService?.setTerminalLayoutInfo(state);
	}

	@debounce(500)
	private _updateTitle(instance?: ITerminalInstance): void {
		if (!this.configHelper.config.enablePersistentSessions || !instance || !instance.persistentProcessId || !instance.title) {
			return;
		}
		this._primaryOffProcessTerminalService?.updateTitle(instance.persistentProcessId, instance.title, instance.titleSource);
	}

	@debounce(500)
	private _updateIcon(instance?: ITerminalInstance): void {
		if (!this.configHelper.config.enablePersistentSessions || !instance || !instance.persistentProcessId || !instance.icon) {
			return;
		}
		this._primaryOffProcessTerminalService?.updateIcon(instance.persistentProcessId, instance.icon, instance.color);
	}

	refreshActiveGroup(): void {
		this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
	}

	doWithActiveInstance<T>(callback: (terminal: ITerminalInstance) => T): T | void {
		const instance = this.activeInstance;
		if (instance) {
			return callback(instance);
		}
	}

	getInstanceFromId(terminalId: number): ITerminalInstance | undefined {
		let bgIndex = -1;
		this._backgroundedTerminalInstances.forEach((terminalInstance, i) => {
			if (terminalInstance.instanceId === terminalId) {
				bgIndex = i;
			}
		});
		if (bgIndex !== -1) {
			return this._backgroundedTerminalInstances[bgIndex];
		}
		try {
			return this.instances[this._getIndexFromId(terminalId)];
		} catch {
			return undefined;
		}
	}

	getInstanceFromIndex(terminalIndex: number): ITerminalInstance {
		return this.instances[terminalIndex];
	}

	getInstanceFromResource(resource: URI | undefined): ITerminalInstance | undefined {
		return getInstanceFromResource(this.instances, resource);
	}

	isAttachedToTerminal(remoteTerm: IRemoteTerminalAttachTarget): boolean {
		return this.instances.some(term => term.processId === remoteTerm.pid);
	}

	async initializeTerminals(): Promise<void> {
		if (this._remoteTerminalsInitPromise) {
			await this._remoteTerminalsInitPromise;
		} else if (this._localTerminalsInitPromise) {
			await this._localTerminalsInitPromise;
		}
		if (this._terminalGroupService.groups.length === 0 && this.isProcessSupportRegistered) {
			this.createTerminal({ location: TerminalLocation.Panel });
		}
	}

	moveToEditor(source: ITerminalInstance): void {
		if (source.target === TerminalLocation.Editor) {
			return;
		}
		const sourceGroup = this._terminalGroupService.getGroupForInstance(source);
		if (!sourceGroup) {
			return;
		}
		sourceGroup.removeInstance(source);
		this._terminalEditorService.openEditor(source);
	}

	async moveToTerminalView(source?: ITerminalInstance, target?: ITerminalInstance, side?: 'before' | 'after'): Promise<void> {
		if (URI.isUri(source)) {
			source = this.getInstanceFromResource(source);
		}

		if (source) {
			this._terminalEditorService.detachInstance(source);
		} else {
			source = this._terminalEditorService.detachActiveEditorInstance();
			if (!source) {
				return;
			}
		}

		if (source.target !== TerminalLocation.Editor) {
			return;
		}
		source.target = TerminalLocation.Panel;

		let group: ITerminalGroup | undefined;
		if (target) {
			group = this._terminalGroupService.getGroupForInstance(target);
		}

		if (!group) {
			group = this._terminalGroupService.createGroup();
		}

		group.addInstance(source);
		this.setActiveInstance(source);
		await this._terminalGroupService.showPanel(true);
		// TODO: Shouldn't this happen automatically?
		source.setVisible(true);

		if (target && side) {
			const index = group.terminalInstances.indexOf(target) + (side === 'after' ? 1 : 0);
			group.moveInstance(source, index);
		}

		// Fire events
		this._onDidChangeInstances.fire();
		this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
		this._terminalGroupService.showPanel(true);
	}

	protected _initInstanceListeners(instance: ITerminalInstance): void {
		instance.addDisposable(instance.onTitleChanged(this._onDidChangeInstanceTitle.fire, this._onDidChangeInstanceTitle));
		instance.addDisposable(instance.onIconChanged(this._onDidChangeInstanceIcon.fire, this._onDidChangeInstanceIcon));
		instance.addDisposable(instance.onIconChanged(this._onDidChangeInstanceColor.fire, this._onDidChangeInstanceColor));
		instance.addDisposable(instance.onProcessIdReady(this._onDidReceiveProcessId.fire, this._onDidReceiveProcessId));
		instance.addDisposable(instance.statusList.onDidChangePrimaryStatus(() => this._onDidChangeInstancePrimaryStatus.fire(instance)));
		instance.addDisposable(instance.onLinksReady(this._onDidReceiveInstanceLinks.fire, this._onDidReceiveInstanceLinks));
		instance.addDisposable(instance.onDimensionsChanged(() => {
			this._onDidChangeInstanceDimensions.fire(instance);
			if (this.configHelper.config.enablePersistentSessions && this.isProcessSupportRegistered) {
				this._saveState();
			}
		}));
		instance.addDisposable(instance.onMaximumDimensionsChanged(() => this._onDidMaxiumumDimensionsChange.fire(instance)));
		instance.addDisposable(instance.onDidInputData(this._onDidInputInstanceData.fire, this._onDidInputInstanceData));
		instance.addDisposable(instance.onDidFocus(this._onDidChangeActiveInstance.fire, this._onDidChangeActiveInstance));
		instance.addDisposable(instance.onRequestAddInstanceToGroup(async e => await this._addInstanceToGroup(instance, e)));
	}

	private async _addInstanceToGroup(instance: ITerminalInstance, e: IRequestAddInstanceToGroupEvent): Promise<void> {
		const terminalIdentifier = parseTerminalUri(e.uri);
		if (terminalIdentifier.instanceId === undefined) {
			return;
		}

		let sourceInstance: ITerminalInstance | undefined = this.getInstanceFromResource(e.uri);

		// Terminal from a different window
		if (!sourceInstance) {
			const attachPersistentProcess = await this._primaryOffProcessTerminalService?.requestDetachInstance(terminalIdentifier.workspaceId, terminalIdentifier.instanceId);
			if (attachPersistentProcess) {
				sourceInstance = await this.createTerminal({ config: { attachPersistentProcess }, resource: e.uri });
				this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
				return;
			}
		}

		// View terminals
		sourceInstance = this._terminalGroupService.getInstanceFromResource(e.uri);
		if (sourceInstance) {
			this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
			return;
		}

		// Terminal editors
		sourceInstance = this._terminalEditorService.getInstanceFromResource(e.uri);
		if (sourceInstance) {
			this.moveToTerminalView(sourceInstance, instance, e.side);
			return;
		}
		return;
	}

	registerProcessSupport(isSupported: boolean): void {
		if (!isSupported) {
			return;
		}
		this._processSupportContextKey.set(isSupported);
		this._onDidRegisterProcessSupport.fire();
	}

	registerLinkProvider(linkProvider: ITerminalExternalLinkProvider): IDisposable {
		const disposables: IDisposable[] = [];
		this._linkProviders.add(linkProvider);
		for (const instance of this.instances) {
			if (instance.areLinksReady) {
				disposables.push(instance.registerLinkProvider(linkProvider));
			}
		}
		this._linkProviderDisposables.set(linkProvider, disposables);
		return {
			dispose: () => {
				const disposables = this._linkProviderDisposables.get(linkProvider) || [];
				for (const disposable of disposables) {
					disposable.dispose();
				}
				this._linkProviders.delete(linkProvider);
			}
		};
	}

	registerTerminalProfileProvider(extensionIdentifierenfifier: string, id: string, profileProvider: ITerminalProfileProvider): IDisposable {
		let extMap = this._profileProviders.get(extensionIdentifierenfifier);
		if (!extMap) {
			extMap = new Map();
			this._profileProviders.set(extensionIdentifierenfifier, extMap);
		}
		extMap.set(id, profileProvider);
		return toDisposable(() => this._profileProviders.delete(id));
	}

	private _setInstanceLinkProviders(instance: ITerminalInstance): void {
		for (const linkProvider of this._linkProviders) {
			const disposables = this._linkProviderDisposables.get(linkProvider);
			const provider = instance.registerLinkProvider(linkProvider);
			disposables?.push(provider);
		}
	}


	// TODO: Remove this, it should live in group/editor servioce
	private _getIndexFromId(terminalId: number): number {
		let terminalIndex = -1;
		this.instances.forEach((terminalInstance, i) => {
			if (terminalInstance.instanceId === terminalId) {
				terminalIndex = i;
			}
		});
		if (terminalIndex === -1) {
			throw new Error(`Terminal with ID ${terminalId} does not exist (has it already been disposed?)`);
		}
		return terminalIndex;
	}

	protected async _showTerminalCloseConfirmation(singleTerminal?: boolean): Promise<boolean> {
		let message: string;
		if (this.instances.length === 1 || singleTerminal) {
			message = nls.localize('terminalService.terminalCloseConfirmationSingular', "Do you want to terminate the active terminal session?");
		} else {
			message = nls.localize('terminalService.terminalCloseConfirmationPlural', "Do you want to terminal the {0} active terminal sessions?", this.instances.length);
		}
		const res = await this._dialogService.confirm({
			message,
			primaryButton: nls.localize('terminate', "Terminate"),
			type: 'warning',
		});
		return !res.confirmed;
	}

	private async _getPlatformKey(): Promise<string> {
		const env = await this._remoteAgentService.getEnvironment();
		if (env) {
			return env.os === OperatingSystem.Windows ? 'windows' : (env.os === OperatingSystem.Macintosh ? 'osx' : 'linux');
		}
		return isWindows ? 'windows' : (isMacintosh ? 'osx' : 'linux');
	}

	async showProfileQuickPick(type: 'setDefault' | 'createInstance', cwd?: string | URI): Promise<ITerminalInstance | undefined> {
		let keyMods: IKeyMods | undefined;
		const profiles = await this._detectProfiles(true);
		const platformKey = await this._getPlatformKey();
		const profilesKey = `${TerminalSettingPrefix.Profiles}${platformKey}`;
		const defaultProfileKey = `${TerminalSettingPrefix.DefaultProfile}${platformKey}`;

		const options: IPickOptions<IProfileQuickPickItem> = {
			placeHolder: type === 'createInstance' ? nls.localize('terminal.integrated.selectProfileToCreate', "Select the terminal profile to create") : nls.localize('terminal.integrated.chooseDefaultProfile', "Select your default terminal profile"),
			onDidTriggerItemButton: async (context) => {
				if ('command' in context.item.profile) {
					return;
				}
				if ('id' in context.item.profile) {
					return;
				}
				const configProfiles = this._configurationService.getValue<{ [key: string]: ITerminalProfileObject }>(profilesKey);
				const existingProfiles = configProfiles ? Object.keys(configProfiles) : [];
				const name = await this._quickInputService.input({
					prompt: nls.localize('enterTerminalProfileName', "Enter terminal profile name"),
					value: context.item.profile.profileName,
					validateInput: async input => {
						if (existingProfiles.includes(input)) {
							return nls.localize('terminalProfileAlreadyExists', "A terminal profile already exists with that name");
						}
						return undefined;
					}
				});
				if (!name) {
					return;
				}
				const newConfigValue: { [key: string]: ITerminalProfileObject } = { ...configProfiles } ?? {};
				newConfigValue[name] = {
					path: context.item.profile.path,
					args: context.item.profile.args
				};
				await this._configurationService.updateValue(profilesKey, newConfigValue, ConfigurationTarget.USER);
			},
			onKeyMods: mods => keyMods = mods
		};

		// Build quick pick items
		const quickPickItems: (IProfileQuickPickItem | IQuickPickSeparator)[] = [];
		const configProfiles = profiles.filter(e => !e.isAutoDetected);
		const autoDetectedProfiles = profiles.filter(e => e.isAutoDetected);
		if (configProfiles.length > 0) {
			quickPickItems.push({ type: 'separator', label: nls.localize('terminalProfiles', "profiles") });
			quickPickItems.push(...configProfiles.map(e => this._createProfileQuickPickItem(e)));
		}

		quickPickItems.push({ type: 'separator', label: nls.localize('ICreateContributedTerminalProfileOptions', "contributed") });
		for (const contributed of this._terminalContributionService.terminalProfiles) {
			if (typeof contributed.icon === 'string' && contributed.icon.startsWith('$(')) {
				contributed.icon = contributed.icon.substring(2, contributed.icon.length - 1);
			}
			const icon = contributed.icon && typeof contributed.icon === 'string' ? (iconRegistry.get(contributed.icon) || Codicon.terminal) : Codicon.terminal;
			const uriClasses = getUriClasses(contributed, this._themeService.getColorTheme().type, true);
			const colorClass = getColorClass(contributed);
			const iconClasses = [];
			if (uriClasses) {
				iconClasses.push(...uriClasses);
			}
			if (colorClass) {
				iconClasses.push(colorClass);
			}
			quickPickItems.push({
				label: `$(${icon.id}) ${contributed.title}`,
				profile: {
					extensionIdentifier: contributed.extensionIdentifier,
					title: contributed.title,
					icon: contributed.icon,
					id: contributed.id,
					color: contributed.color
				},
				iconClasses
			});
		}

		if (autoDetectedProfiles.length > 0) {
			quickPickItems.push({ type: 'separator', label: nls.localize('terminalProfiles.detected', "detected") });
			quickPickItems.push(...autoDetectedProfiles.map(e => this._createProfileQuickPickItem(e)));
		}

		const value = await this._quickInputService.pick(quickPickItems, options);
		if (!value) {
			return undefined; // {{SQL CARBON EDIT}} Strict nulls
		}
		if (type === 'createInstance') {
			const activeInstance = this.getDefaultInstanceHost().activeInstance;
			let instance;

			if ('id' in value.profile) {
				await this._createContributedTerminalProfile(value.profile.extensionIdentifier, value.profile.id, {
					splitActiveTerminal: !!(keyMods?.alt && activeInstance),
					icon: value.profile.icon,
					color: value.profile.color
				});
				return undefined; // {{SQL CARBON EDIT}} strict-nulls
			} else {
				if (keyMods?.alt && activeInstance) {
					// create split, only valid if there's an active instance
					instance = await this.createTerminal({ location: { parentTerminal: activeInstance }, config: value.profile });
				} else {
					instance = await this.createTerminal({ location: this.defaultLocation, config: value.profile, cwd });
				}
			}

			if (instance && this.defaultLocation !== TerminalLocation.Editor) {
				this._terminalGroupService.showPanel(true);
				this.setActiveInstance(instance);
				return instance;
			}
		} else { // setDefault
			if ('command' in value.profile) {
				return undefined; // Should never happen {{SQL CARBON EDIT}} Strict nulls
			} else if ('id' in value.profile) {
				// extension contributed profile
				await this._configurationService.updateValue(defaultProfileKey, value.profile.title, ConfigurationTarget.USER);

				this._registerContributedProfile(value.profile.extensionIdentifier, value.profile.id, value.profile.title, {
					color: value.profile.color,
					icon: value.profile.icon
				});
				return undefined; // {{SQL CARBON EDIT}} Strict nulls
			}
		}

		// Add the profile to settings if necessary
		if (value.profile.isAutoDetected) {
			const profilesConfig = await this._configurationService.getValue(profilesKey);
			if (typeof profilesConfig === 'object') {
				const newProfile: ITerminalProfileObject = {
					path: value.profile.path
				};
				if (value.profile.args) {
					newProfile.args = value.profile.args;
				}
				(profilesConfig as { [key: string]: ITerminalProfileObject })[value.profile.profileName] = newProfile;
			}
			await this._configurationService.updateValue(profilesKey, profilesConfig, ConfigurationTarget.USER);
		}
		// Set the default profile
		await this._configurationService.updateValue(defaultProfileKey, value.profile.profileName, ConfigurationTarget.USER);
		return undefined;
	}


	getDefaultInstanceHost(): ITerminalInstanceHost {
		if (this.defaultLocation === TerminalLocation.Editor) {
			return this._terminalEditorService;
		}
		return this._terminalGroupService;
	}

	getInstanceHost(location: ITerminalLocationOptions | undefined): ITerminalInstanceHost {
		if (location) {
			if (location === TerminalLocation.Editor) {
				return this._terminalEditorService;
			} else if (typeof location === 'object') {
				if ('viewColumn' in location) {
					return this._terminalEditorService;
				} else if ('parentTerminal' in location) {
					return location.parentTerminal.target === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
				}
			} else {
				return this._terminalGroupService;
			}
		}
		return this;
	}

	getFindHost(instance: ITerminalInstance | undefined = this.activeInstance): ITerminalFindHost {
		return instance?.target === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
	}

	private async _createContributedTerminalProfile(extensionIdentifier: string, id: string, options: ICreateContributedTerminalProfileOptions): Promise<void> {
		await this._extensionService.activateByEvent(`onTerminalProfile:${id}`);
		const extMap = this._profileProviders.get(extensionIdentifier);
		const profileProvider = extMap?.get(id);
		if (!profileProvider) {
			this._notificationService.error(`No terminal profile provider registered for id "${id}"`);
			return;
		}
		try {
			await profileProvider.createContributedTerminalProfile(options);
			this._terminalGroupService.setActiveInstanceByIndex(this.instances.length - 1);
			await this.activeInstance?.focusWhenReady();
		} catch (e) {
			this._notificationService.error(e.message);
		}
	}

	private async _registerContributedProfile(extensionIdentifier: string, id: string, title: string, options: ICreateContributedTerminalProfileOptions): Promise<void> {
		const platformKey = await this._getPlatformKey();
		const profilesConfig = await this._configurationService.getValue(`${TerminalSettingPrefix.Profiles}${platformKey}`);
		if (typeof profilesConfig === 'object') {
			const newProfile: IExtensionTerminalProfile = {
				extensionIdentifier: extensionIdentifier,
				icon: options.icon,
				id,
				title: title,
				color: options.color
			};

			(profilesConfig as { [key: string]: ITerminalProfileObject })[title] = newProfile;
		}
		await this._configurationService.updateValue(`${TerminalSettingPrefix.Profiles}${platformKey}`, profilesConfig, ConfigurationTarget.USER);
		return;
	}

	private _createProfileQuickPickItem(profile: ITerminalProfile): IProfileQuickPickItem {
		const buttons: IQuickInputButton[] = [{
			iconClass: ThemeIcon.asClassName(configureTerminalProfileIcon),
			tooltip: nls.localize('createQuickLaunchProfile', "Configure Terminal Profile")
		}];
		const icon = (profile.icon && ThemeIcon.isThemeIcon(profile.icon)) ? profile.icon : Codicon.terminal;
		const label = `$(${icon.id}) ${profile.profileName}`;
		if (profile.args) {
			if (typeof profile.args === 'string') {
				return { label, description: `${profile.path} ${profile.args}`, profile, buttons };
			}
			const argsString = profile.args.map(e => {
				if (e.includes(' ')) {
					return `"${e.replace('/"/g', '\\"')}"`;
				}
				return e;
			}).join(' ');
			return { label, description: `${profile.path} ${argsString}`, profile, buttons };
		}
		return { label, description: profile.path, profile, buttons };
	}

	private _convertProfileToShellLaunchConfig(shellLaunchConfigOrProfile?: IShellLaunchConfig | ITerminalProfile, cwd?: string | URI): IShellLaunchConfig {
		if (shellLaunchConfigOrProfile && 'profileName' in shellLaunchConfigOrProfile) {
			const profile = shellLaunchConfigOrProfile;
			if (!profile.path) {
				return shellLaunchConfigOrProfile;
			}
			return {
				executable: profile.path,
				args: profile.args,
				env: profile.env,
				icon: profile.icon,
				color: profile.color,
				name: profile.overrideName ? profile.profileName : undefined,
				cwd
			};
		}

		// A shell launch config was provided
		if (shellLaunchConfigOrProfile) {
			if (cwd) {
				(shellLaunchConfigOrProfile as IShellLaunchConfig).cwd = cwd; // {{SQL CARBON EDIT}} Fix compile
			}
			return shellLaunchConfigOrProfile;
		}

		// Return empty shell launch config
		return {};
	}

	private async _getContributedDefaultProfile(shellLaunchConfig: IShellLaunchConfig): Promise<IExtensionTerminalProfile | undefined> {
		// prevents recursion with the MainThreadTerminalService call to create terminal
		// and defers to the provided launch config when an executable is provided
		if (shellLaunchConfig && !shellLaunchConfig.extHostTerminalId && !('executable' in shellLaunchConfig)) {
			const key = await this._getPlatformKey();
			const defaultProfileName = this._configurationService.getValue(`${TerminalSettingPrefix.DefaultProfile}${key}`);
			const contributedDefaultProfile = this._terminalContributionService.terminalProfiles.find(p => p.title === defaultProfileName);
			return contributedDefaultProfile;
		}
		return undefined;
	}


	async createTerminal(options?: ICreateTerminalOptions): Promise<ITerminalInstance> {
		const config = options?.config || this._availableProfiles?.find(p => p.profileName === this._defaultProfileName);
		const shellLaunchConfig = config && 'extensionIdentifier' in config ? {} : this._convertProfileToShellLaunchConfig((config as IShellLaunchConfig | ITerminalProfile) || {}); // {{SQL CARBON EDIT}} Cast to avoid compile error

		// Get the contributed profile if it was provided
		let contributedProfile = config && 'extensionIdentifier' in config ? config : undefined;

		// Get the default profile as a contributed profile if it exists
		if (!contributedProfile && (!options || !options.config)) {
			contributedProfile = await this._getContributedDefaultProfile(shellLaunchConfig);
		}

		// Launch the contributed profile
		if (contributedProfile) {
			await this._createContributedTerminalProfile(contributedProfile.extensionIdentifier, contributedProfile.id, {
				icon: contributedProfile.icon,
				color: contributedProfile.color,
				splitActiveTerminal: typeof options?.location === 'object' && 'splitActiveTerminal' in options.location ? true : false
			});
			// TODO shouldn't the below use defaultLocation?
			const instanceHost = options?.location === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
			const instance = instanceHost.instances[instanceHost.instances.length - 1];
			await instance.focusWhenReady();
			return instance;
		}

		if (options?.cwd) {
			shellLaunchConfig.cwd = options.cwd;
		}

		if (!shellLaunchConfig.customPtyImplementation && !this.isProcessSupportRegistered) {
			throw new Error('Could not create terminal when process support is not registered');
		}
		if (shellLaunchConfig.hideFromUser) {
			const instance = this._terminalInstanceService.createInstance(shellLaunchConfig, undefined, options?.resource);
			this._backgroundedTerminalInstances.push(instance);
			this._backgroundedTerminalDisposables.set(instance.instanceId, [
				instance.onDisposed(this._onDidDisposeInstance.fire, this._onDidDisposeInstance)
			]);
			return instance;
		}

		this._evaluateLocalCwd(shellLaunchConfig);
		const location = this._resolveLocation(options?.location) || this.defaultLocation;
		const parent = this._getSplitParent(options?.location);

		if (parent) {
			return this._splitTerminal(shellLaunchConfig, location, parent);
		} else {
			return this._createTerminal(shellLaunchConfig, location, options);
		}
	}

	private _splitTerminal(shellLaunchConfig: IShellLaunchConfig, location: TerminalLocation, parent: ITerminalInstance): ITerminalInstance {
		let instance;
		// Use the URI from the base instance if it exists, this will correctly split local terminals
		if (typeof shellLaunchConfig.cwd !== 'object' && typeof parent.shellLaunchConfig.cwd === 'object') {
			shellLaunchConfig.cwd = URI.from({
				scheme: parent.shellLaunchConfig.cwd.scheme,
				authority: parent.shellLaunchConfig.cwd.authority,
				path: shellLaunchConfig.cwd || parent.shellLaunchConfig.cwd.path
			});
		}
		if (location === TerminalLocation.Editor || parent.target === TerminalLocation.Editor) {
			instance = this._terminalEditorService.splitInstance(parent, shellLaunchConfig);
		} else {
			const group = this._terminalGroupService.getGroupForInstance(parent);
			if (!group) {
				throw new Error(`Cannot split a terminal without a group ${parent}`);
			}
			instance = group.split(shellLaunchConfig);
			this._terminalGroupService.groups.forEach((g, i) => g.setVisible(i === this._terminalGroupService.activeGroupIndex));
		}
		return instance;
	}

	private _createTerminal(shellLaunchConfig: IShellLaunchConfig, location: TerminalLocation, options?: ICreateTerminalOptions): ITerminalInstance {
		let instance;
		const editorOptions = this._getEditorOptions(options?.location);
		if (location === TerminalLocation.Editor) {
			instance = this._terminalInstanceService.createInstance(shellLaunchConfig, undefined, options?.resource);
			instance.target = TerminalLocation.Editor;
			this._terminalEditorService.openEditor(instance, editorOptions);
		} else {
			// TODO: pass resource?
			const group = this._terminalGroupService.createGroup(shellLaunchConfig);
			instance = group.terminalInstances[0];
		}
		return instance;
	}

	private _resolveLocation(location?: ITerminalLocationOptions): TerminalLocation | undefined {
		if (!location) {
			return undefined; // {{SQL CARBON EDIT}} Return undefined directly to avoid compile error
		} else if (typeof location === 'object') {
			if ('parentTerminal' in location) {
				return location.parentTerminal.target;
			} else if ('viewColumn' in location) {
				return TerminalLocation.Editor;
			} else if ('splitActiveTerminal' in location) {
				return this._activeInstance?.target || this.defaultLocation;
			}
		}
		return location;
	}

	private _getSplitParent(location?: ITerminalLocationOptions): ITerminalInstance | undefined {
		if (location && typeof location === 'object' && 'parentTerminal' in location) {
			return location.parentTerminal;
		} else if (location && typeof location === 'object' && 'splitActiveTerminal' in location) {
			return this.activeInstance;
		}
		return undefined;
	}

	private _getEditorOptions(location?: ITerminalLocationOptions): TerminalEditorLocation | undefined {
		if (location && typeof location === 'object' && 'viewColumn' in location) {
			return location;
		}
		return undefined;
	}

	private _evaluateLocalCwd(shellLaunchConfig: IShellLaunchConfig) {
		// Add welcome message and title annotation for local terminals launched within remote or
		// virtual workspaces
		if (typeof shellLaunchConfig.cwd !== 'string' && shellLaunchConfig.cwd?.scheme === Schemas.file) {
			if (VirtualWorkspaceContext.getValue(this._contextKeyService)) {
				shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize('localTerminalVirtualWorkspace', "⚠ : This shell is open to a {0}local{1} folder, NOT to the virtual folder", '\x1b[3m', '\x1b[23m'), true);
				shellLaunchConfig.description = nls.localize('localTerminalDescription', "Local");
			} else if (this._remoteAgentService.getConnection()) {
				shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize('localTerminalRemote', "⚠ : This shell is running on your {0}local{1} machine, NOT on the connected remote machine", '\x1b[3m', '\x1b[23m'), true);
				shellLaunchConfig.description = nls.localize('localTerminalDescription', "Local");
			}
		}
	}

	protected _showBackgroundTerminal(instance: ITerminalInstance): void {
		this._backgroundedTerminalInstances.splice(this._backgroundedTerminalInstances.indexOf(instance), 1);
		const disposables = this._backgroundedTerminalDisposables.get(instance.instanceId);
		if (disposables) {
			dispose(disposables);
		}
		this._backgroundedTerminalDisposables.delete(instance.instanceId);
		instance.shellLaunchConfig.hideFromUser = false;
		this._terminalGroupService.createGroup(instance);

		// Make active automatically if it's the first instance
		if (this.instances.length === 1) {
			this._terminalGroupService.setActiveInstanceByIndex(0);
		}

		this._onDidChangeInstances.fire();
		this._onDidChangeGroups.fire();
	}

	async setContainers(panelContainer: HTMLElement, terminalContainer: HTMLElement): Promise<void> {
		this._configHelper.panelContainer = panelContainer;
		this._terminalGroupService.setContainer(terminalContainer);
	}
}

interface IProfileQuickPickItem extends IQuickPickItem {
	profile: ITerminalProfile | IExtensionTerminalProfile
}

class TerminalEditorStyle extends Themable {
	private _styleElement: HTMLElement;

	constructor(
		container: HTMLElement,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@IThemeService private readonly _themeService: IThemeService,
	) {
		super(_themeService);
		this._registerListeners();
		this._styleElement = document.createElement('style');
		container.appendChild(this._styleElement);
		this._register(toDisposable(() => container.removeChild(this._styleElement)));
		this.updateStyles();
	}

	private _registerListeners(): void {
		this._register(this._terminalService.onDidChangeInstanceIcon(() => this.updateStyles()));
		this._register(this._terminalService.onDidChangeInstanceColor(() => this.updateStyles()));
		this._register(this._terminalService.onDidChangeInstances(() => this.updateStyles()));
	}

	override updateStyles(): void {
		super.updateStyles();
		const colorTheme = this._themeService.getColorTheme();

		// TODO: add a rule collector to avoid duplication
		let css = '';

		// Add icons
		for (const instance of this._terminalService.instances) {
			const icon = instance.icon;
			if (!icon) {
				continue;
			}
			let uri = undefined;
			if (icon instanceof URI) {
				uri = icon;
			} else if (icon instanceof Object && 'light' in icon && 'dark' in icon) {
				uri = colorTheme.type === ColorScheme.LIGHT ? icon.light : icon.dark;
			}
			const iconClasses = getUriClasses(instance, colorTheme.type);
			if (uri instanceof URI && iconClasses && iconClasses.length > 1) {
				css += (
					`.monaco-workbench .terminal-tab.${iconClasses[0]}::before` +
					`{background-image: ${dom.asCSSUrl(uri)};}`
				);
			}
			if (ThemeIcon.isThemeIcon(icon)) {
				const codicon = iconRegistry.get(icon.id);
				if (codicon) {
					let def: Codicon | IconDefinition = codicon;
					while ('definition' in def) {
						def = def.definition;
					}
					css += (
						`.monaco-workbench .terminal-tab.codicon-${icon.id}::before` +
						`{content: '${def.fontCharacter}' !important;}`
					);
				}
			}
		}

		// Add colors
		const iconForegroundColor = colorTheme.getColor(iconForeground);
		if (iconForegroundColor) {
			css += `.monaco-workbench .show-file-icons .file-icon.terminal-tab::before { color: ${iconForegroundColor}; }`;
		}
		for (const instance of this._terminalService.instances) {
			const colorClass = getColorClass(instance);
			if (!colorClass || !instance.color) {
				continue;
			}
			const color = colorTheme.getColor(instance.color);
			if (color) {
				css += (
					`.monaco-workbench .show-file-icons .file-icon.terminal-tab.${colorClass}::before` +
					`{ color: ${color} !important; }`
				);
			}
		}

		this._styleElement.textContent = css;
	}
}
