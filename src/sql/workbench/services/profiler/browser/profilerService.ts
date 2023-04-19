/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { ProfilerSessionID, IProfilerSession, IProfilerService, IProfilerViewTemplate, IProfilerSessionTemplate, PROFILER_SETTINGS, IProfilerSettings, EngineType, ProfilerFilter, PROFILER_FILTER_SETTINGS } from './interfaces';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ProfilerInput } from 'sql/workbench/browser/editor/profiler/profilerInput';
import { ProfilerColumnEditorDialog } from 'sql/workbench/services/profiler/browser/profilerColumnEditorDialog';

import * as azdata from 'azdata';

import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { Memento } from 'vs/workbench/common/memento';
import { ProfilerFilterDialog } from 'sql/workbench/services/profiler/browser/profilerFilterDialog';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

class TwoWayMap<T, K> {
	private forwardMap: Map<T, K>;
	private reverseMap: Map<K, T>;

	constructor() {
		this.forwardMap = new Map<T, K>();
		this.reverseMap = new Map<K, T>();
	}

	has(input: T): boolean {
		return this.forwardMap.has(input);
	}

	reverseHas(input: K): boolean {
		return this.reverseMap.has(input);
	}

	get(input: T): K | undefined {
		return this.forwardMap.get(input);
	}

	reverseGet(input: K): T | undefined {
		return this.reverseMap.get(input);
	}

	set(input: T, input2: K): TwoWayMap<T, K> {
		this.forwardMap.set(input, input2);
		this.reverseMap.set(input2, input);
		return this;
	}
}

export class ProfilerService implements IProfilerService {
	private static readonly PROFILER_SERVICE_UI_STATE_STORAGE_KEY = 'profileservice.uiState';
	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.ProfilerProvider>();
	private _idMap = new TwoWayMap<ProfilerSessionID, string>();
	private _sessionMap = new Map<ProfilerSessionID, IProfilerSession>();
	private _connectionMap = new Map<ProfilerSessionID, IConnectionProfile>();
	private _editColumnDialog?: ProfilerColumnEditorDialog;
	private _memento: any;
	private _context: Memento;

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@IConfigurationService public _configurationService: IConfigurationService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@INotificationService private _notificationService: INotificationService,
		@ICommandService private _commandService: ICommandService,
		@IStorageService private _storageService: IStorageService
	) {
		this._context = new Memento('ProfilerEditor', this._storageService);
		this._memento = this._context.getMemento(StorageScope.GLOBAL, StorageTarget.MACHINE);
	}

	public registerProvider(providerId: string, provider: azdata.ProfilerProvider): void {
		this._providers.set(providerId, provider);
	}

	public async registerSession(uri: string, connectionProfile: IConnectionProfile, session: IProfilerSession): Promise<ProfilerSessionID> {
		let options: IConnectionCompletionOptions = {
			params: { connectionType: ConnectionType.default, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: undefined },
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};
		try {
			await this._connectionService.connect(connectionProfile, uri, options);
		} catch (connectionError) {

		}
		this._sessionMap.set(uri, session);
		this._connectionMap.set(uri, connectionProfile);
		this._idMap.set(uri, uri);
		return Promise.resolve(uri);
	}

	public onMoreRows(params: azdata.ProfilerSessionEvents): void {
		if (this._idMap.reverseHas(params.sessionId)) {
			this._sessionMap.get(this._idMap.reverseGet(params.sessionId)!)!.onMoreRows(params);
		}
	}

	public onSessionStopped(params: azdata.ProfilerSessionStoppedParams): void {
		if (this._idMap.reverseHas(params.ownerUri)) {
			this._sessionMap.get(this._idMap.reverseGet(params.ownerUri)!)!.onSessionStopped(params);
		}
	}

	public onProfilerSessionCreated(params: azdata.ProfilerSessionCreatedParams): void {
		if (this._idMap.reverseHas(params.ownerUri)) {
			this._sessionMap.get(this._idMap.reverseGet(params.ownerUri)!)!.onProfilerSessionCreated(params);
			this.updateMemento(params.ownerUri, { previousSessionName: params.sessionName });
		}
	}

	public async connectSession(id: ProfilerSessionID): Promise<boolean> {
		if (this._idMap.has(id)) {
			return this._runAction(id, provider => provider.connectSession(this._idMap.get(id)!));
		}
		return false;
	}

	public async disconnectSession(id: ProfilerSessionID): Promise<boolean> {
		if (this._idMap.has(id)) {
			return this._runAction(id, provider => provider.disconnectSession(this._idMap.get(id)!));
		}
		return false;
	}

	public async createSession(id: string, createStatement: string, template: azdata.ProfilerSessionTemplate): Promise<boolean> {
		if (this._idMap.has(id)) {
			try {
				await this._runAction(id, provider => provider.createSession(this._idMap.get(id)!, createStatement, template));
				this._sessionMap.get(this._idMap.reverseGet(id)!)!.onSessionStateChanged({ isRunning: true, isStopped: false, isPaused: false });
				return true;
			} catch (reason) {
				this._notificationService.error(reason.message);
				return false;
			}
		}
		return false;
	}

	public async startSession(id: ProfilerSessionID, sessionName: string): Promise<boolean> {
		if (this._idMap.has(id)) {
			this.updateMemento(id, { previousSessionName: sessionName });
			try {
				await this._runAction(id, provider => provider.startSession(this._idMap.get(id)!, sessionName));
				this._sessionMap.get(this._idMap.reverseGet(id)!)!.onSessionStateChanged({ isRunning: true, isStopped: false, isPaused: false });
				return true;
			} catch (reason) {
				this._notificationService.error(reason.message);
				return false;
			}
		}
		return false;
	}

	public async pauseSession(id: ProfilerSessionID): Promise<boolean> {
		if (this._idMap.has(id)) {
			return this._runAction(id, provider => provider.pauseSession(this._idMap.get(id)!));
		} else {
			return false;
		}
	}

	public async stopSession(id: ProfilerSessionID): Promise<boolean> {
		if (this._idMap.has(id)) {
			try {
				await this._runAction(id, provider => provider.stopSession(this._idMap.get(id)!));
				this._sessionMap.get(this._idMap.reverseGet(id)!)!.onSessionStateChanged({ isStopped: true, isPaused: false, isRunning: false });
				return true;
			} catch (e) {
				this._sessionMap.get(this._idMap.reverseGet(id)!)!.onSessionStateChanged({ isStopped: true, isPaused: false, isRunning: false });
				return false;
			}
		} else {
			return false;
		}
	}

	public async getXEventSessions(id: ProfilerSessionID): Promise<string[] | undefined> {
		if (this._idMap.get(id)) {
			return this._runAction(id, provider => provider.getXEventSessions(this._idMap.get(id)!)).then((r) => {
				return r;
			}, (reason) => {
				this._notificationService.error(reason.message);
				return undefined;
			});
		}
		return undefined;
	}

	private _runAction<T>(id: ProfilerSessionID, action: (handler: azdata.ProfilerProvider) => Thenable<T>): Thenable<T> {
		let handler = this._providers.get(mssqlProviderName);
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error('No Handler Registered'));
		}
	}

	public getViewTemplates(provider?: string): Array<IProfilerViewTemplate> {
		let config = <IProfilerSettings>this._configurationService.getValue(PROFILER_SETTINGS);

		if (provider) {
			return config.viewTemplates;
		} else {
			return config.viewTemplates;
		}
	}

	public getSessionTemplates(provider?: string): Array<IProfilerSessionTemplate> {
		let config = <IProfilerSettings>this._configurationService.getValue(PROFILER_SETTINGS);

		if (provider) {
			return config.sessionTemplates;
		} else {
			return config.sessionTemplates;
		}
	}

	public getSessionViewState(ownerUri: string): any {
		let mementoKey = this.getMementoKey(ownerUri);
		let uiStateMap = this._memento[ProfilerService.PROFILER_SERVICE_UI_STATE_STORAGE_KEY];
		if (uiStateMap && mementoKey) {
			return uiStateMap[mementoKey];
		}
		return undefined;
	}

	private getMementoKey(ownerUri: string): string | undefined {
		let mementoKey = undefined;
		let connectionProfile = this._connectionMap.get(ownerUri);
		if (connectionProfile) {
			mementoKey = connectionProfile.serverName;
		}
		return mementoKey;
	}

	private updateMemento(ownerUri: string, uiState: any) {
		// update persisted session state
		let mementoKey = this.getMementoKey(ownerUri);
		let uiStateMap = this._memento[ProfilerService.PROFILER_SERVICE_UI_STATE_STORAGE_KEY];
		if (uiStateMap && mementoKey) {
			uiStateMap[mementoKey] = uiState;
			this._memento[ProfilerService.PROFILER_SERVICE_UI_STATE_STORAGE_KEY] = uiStateMap;
			this._context.saveMemento();
		}
	}

	public launchColumnEditor(input?: ProfilerInput): Thenable<void> {
		if (!this._editColumnDialog) {
			this._editColumnDialog = this._instantiationService.createInstance(ProfilerColumnEditorDialog);
			this._editColumnDialog.render();
		}

		this._editColumnDialog.open(input);
		return Promise.resolve();
	}

	public launchCreateSessionDialog(input: ProfilerInput): Thenable<void> {
		const serverInfo = this._connectionService.getConnectionInfo(input.id).serverInfo;
		let templates = this.getSessionTemplates();
		if (serverInfo) {
			const engineType = serverInfo.isCloud ? EngineType.AzureSQLDB : EngineType.Standalone;
			// only use the templates that matches the following criteria:
			// 1. the template doesn't have any engine types specified - for backward compatibility (user with custom templates) or the templates applicable to both AzureSQLDB and standalone server
			// 2. the template supports the current engine type
			templates = templates.filter(template => !template.engineTypes || template.engineTypes.length === 0 || template.engineTypes.some(x => x === engineType));
		}
		return this._commandService.executeCommand('profiler.openCreateSessionDialog', input.id, input.providerType, templates);
	}

	public launchFilterSessionDialog(input: ProfilerInput): void {
		let dialog = this._instantiationService.createInstance(ProfilerFilterDialog);
		dialog.open(input);
	}

	public getFilters(): ProfilerFilter[] {
		const config = <ProfilerFilter[]>this._configurationService.getValue(PROFILER_FILTER_SETTINGS);
		return config;
	}

	public async saveFilter(filter: ProfilerFilter): Promise<void> {
		const config = [filter];
		await this._configurationService.updateValue(PROFILER_FILTER_SETTINGS, config, ConfigurationTarget.USER);
	}
}
