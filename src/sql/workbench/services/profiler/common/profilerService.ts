/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import {
	ProfilerSessionID, IProfilerSession, IProfilerService, IProfilerViewTemplate, IProfilerSessionTemplate,
	PROFILER_SETTINGS, IProfilerSettings
} from './interfaces';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { ProfilerColumnEditorDialog } from 'sql/parts/profiler/dialog/profilerColumnEditorDialog';

import * as sqlops from 'sqlops';

import { TPromise } from 'vs/base/common/winjs.base';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { Memento } from 'vs/workbench/common/memento';
import { ProfilerFilterDialog } from 'sql/parts/profiler/dialog/profilerFilterDialog';

class TwoWayMap<T, K> {
	private forwardMap: Map<T, K>;
	private reverseMap: Map<K, T>;

	constructor() {
		this.forwardMap = new Map<T, K>();
		this.reverseMap = new Map<K, T>();
	}

	get(input: T): K {
		return this.forwardMap.get(input);
	}

	reverseGet(input: K): T {
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
	public _serviceBrand: any;
	private _providers = new Map<string, sqlops.ProfilerProvider>();
	private _idMap = new TwoWayMap<ProfilerSessionID, string>();
	private _sessionMap = new Map<ProfilerSessionID, IProfilerSession>();
	private _connectionMap = new Map<ProfilerSessionID, IConnectionProfile>();
	private _editColumnDialog: ProfilerColumnEditorDialog;
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
		this._memento = this._context.getMemento(StorageScope.GLOBAL);
	}

	public registerProvider(providerId: string, provider: sqlops.ProfilerProvider): void {
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
		return TPromise.wrap(uri);
	}

	public onMoreRows(params: sqlops.ProfilerSessionEvents): void {
		this._sessionMap.get(this._idMap.reverseGet(params.sessionId)).onMoreRows(params);
	}

	public onSessionStopped(params: sqlops.ProfilerSessionStoppedParams): void {
		this._sessionMap.get(this._idMap.reverseGet(params.ownerUri)).onSessionStopped(params);
	}

	public onProfilerSessionCreated(params: sqlops.ProfilerSessionCreatedParams): void {
		this._sessionMap.get(this._idMap.reverseGet(params.ownerUri)).onProfilerSessionCreated(params);
		this.updateMemento(params.ownerUri, { previousSessionName: params.sessionName });
	}

	public connectSession(id: ProfilerSessionID): Thenable<boolean> {
		return this._runAction(id, provider => provider.connectSession(this._idMap.get(id)));
	}

	public disconnectSession(id: ProfilerSessionID): Thenable<boolean> {
		return this._runAction(id, provider => provider.disconnectSession(this._idMap.get(id)));
	}

	public createSession(id: string, createStatement: string, template: sqlops.ProfilerSessionTemplate): Thenable<boolean> {
		return this._runAction(id, provider => provider.createSession(this._idMap.get(id), createStatement, template)).then(() => {
			this._sessionMap.get(this._idMap.reverseGet(id)).onSessionStateChanged({ isRunning: true, isStopped: false, isPaused: false });
			return true;
		}, (reason) => {
			this._notificationService.error(reason.message);
		});
	}

	public startSession(id: ProfilerSessionID, sessionName: string): Thenable<boolean> {
		this.updateMemento(id, { previousSessionName: sessionName });
		return this._runAction(id, provider => provider.startSession(this._idMap.get(id), sessionName)).then(() => {
			this._sessionMap.get(this._idMap.reverseGet(id)).onSessionStateChanged({ isRunning: true, isStopped: false, isPaused: false });
			return true;
		}, (reason) => {
			this._notificationService.error(reason.message);
		});
	}

	public pauseSession(id: ProfilerSessionID): Thenable<boolean> {
		return this._runAction(id, provider => provider.pauseSession(this._idMap.get(id)));
	}

	public stopSession(id: ProfilerSessionID): Thenable<boolean> {
		return this._runAction(id, provider => provider.stopSession(this._idMap.get(id))).then(() => {
			this._sessionMap.get(this._idMap.reverseGet(id)).onSessionStateChanged({ isStopped: true, isPaused: false, isRunning: false });
			return true;
		}, (reason) => {
			// The error won't be actionable to the user, so only log it to console.
			// In case of error, the state of the UI is not usable, makes more sense to
			// set it to stopped so that user can restart it or pick a different session
			this._sessionMap.get(this._idMap.reverseGet(id)).onSessionStateChanged({ isStopped: true, isPaused: false, isRunning: false });
		});
	}

	public getXEventSessions(id: ProfilerSessionID): Thenable<string[]> {
		return this._runAction(id, provider => provider.getXEventSessions(this._idMap.get(id))).then((r) => {
			return r;
		}, (reason) => {
			this._notificationService.error(reason.message);
		});
	}

	private _runAction<T>(id: ProfilerSessionID, action: (handler: sqlops.ProfilerProvider) => Thenable<T>): Thenable<T> {
		// let providerId = this._connectionService.getProviderIdFromUri(this._idMap.get(id));
		let providerId = 'MSSQL';

		if (!providerId) {
			return TPromise.wrapError(new Error('Connection is required in order to interact with queries'));
		}
		let handler = this._providers.get(providerId);
		if (handler) {
			return action(handler);
		} else {
			return TPromise.wrapError(new Error('No Handler Registered'));
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

	private getMementoKey(ownerUri: string): string {
		let mementoKey = undefined;
		let connectionProfile: IConnectionProfile = this._connectionMap.get(ownerUri);
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
		return TPromise.as(null);
	}

	public launchCreateSessionDialog(input?: ProfilerInput): Thenable<void> {
		return this._commandService.executeCommand('profiler.openCreateSessionDialog', input.id, input.providerType, this.getSessionTemplates());
	}

	public launchFilterSessionDialog(input: ProfilerInput): void {
		let dialog = this._instantiationService.createInstance(ProfilerFilterDialog);
		dialog.open(input);
	}
}
