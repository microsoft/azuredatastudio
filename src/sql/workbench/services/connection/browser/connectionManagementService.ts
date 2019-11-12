/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { IConnectionManagementService, IConnection, ConnectOptions, IConnectionProvider } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';
import { Deferred } from 'sql/base/common/promise';
import { IConnectionProviderRegistry, Extensions as ConnectionProviderExtensions } from 'sql/workbench/parts/connection/common/connectionProviderExtension';

import * as errors from 'vs/base/common/errors';
import { Disposable } from 'vs/base/common/lifecycle';
import * as platform from 'vs/platform/registry/common/platform';
import { entries } from 'sql/base/common/collections';
import { assign } from 'vs/base/common/objects';
import { ILogService } from 'vs/platform/log/common/log';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ConnectionStatusManager } from 'sql/platform/connection/common/connectionStatusManager';
import { Connection, ConnectionState } from 'sql/base/common/connection';

const defaultConnectOptions: ConnectOptions = {
	saveToConfig: false,
	useExisting: false
};

interface InternalConnectOptions extends ConnectOptions {
	saveToConfig: boolean;
	useExisting: boolean;
}

export class ConnectionManagementService extends Disposable implements IConnectionManagementService {

	_serviceBrand: undefined;

	private _providers = new Map<string, { readonly onReady: Promise<IConnectionProvider>, readonly properties: ConnectionProviderProperties }>();
	private connectionStatusManager = this.instantiationService.createInstance(ConnectionStatusManager);

	constructor(
		@ILogService private readonly logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		const registry = platform.Registry.as<IConnectionProviderRegistry>(ConnectionProviderExtensions.ConnectionProviderContributions);

		const providerRegistration = (p: { id: string, properties: ConnectionProviderProperties }) => {
			const provider = Object.freeze({
				onReady: new Deferred<IConnectionProvider>(),
				properties: p.properties
			});
			this._providers.set(p.id, provider);
		};

		registry.onNewProvider(providerRegistration, this);
		entries(registry.providers).map(v => {
			providerRegistration({ id: v[0], properties: v[1] });
		});
	}

	public async connect(connection: ConnectionProfile | IConnection, options: ConnectOptions = {}): Promise<IConnection> {
		if (options.useExisting && connection instanceof ConnectionProfile) {
			const existing = this.findExistingConnection(connection);
			if (existing) {
				return existing;
			}
		} else if (connection instanceof Connection && connection.state !== ConnectionState.disconnected) {
			return connection;
		}
		return this.tryConnect(connection, assign(options, defaultConnectOptions) as InternalConnectOptions);
	}

	public findExistingConnection(profile: ConnectionProfile): IConnection | undefined {
		return this.connectionStatusManager.findConnectionWithProfile(profile);
	}

	private async tryConnect(connection: ConnectionProfile | IConnection, options: InternalConnectOptions): Promise<IConnection> {
		throw new errors.NotImplementedError();
	}

	public registerProvider(providerId: string, provider: IConnectionProvider): void {
		if (!this._providers.has(providerId)) {
			this.logService.warn('Provider', providerId, 'attempted to register but has no metadata');
			const providerType = Object.freeze({
				onReady: new Deferred<IConnectionProvider>(),
				properties: undefined
			});
			this._providers.set(providerId, providerType);
		}

		// we know this is a deferred promise because we made it
		(this._providers.get(providerId).onReady as Deferred<IConnectionProvider>).resolve(provider);
	}

	/*
	public providerRegistered(providerId: string): boolean {
		return !!this._providers.get(providerId);
	}

	public get onConnect(): Event<IConnectionParams> {
		return this._onConnect.event;
	}

	public get onDisconnect(): Event<IConnectionParams> {
		return this._onDisconnect.event;
	}

	public get onConnectionChanged(): Event<IConnectionParams> {
		return this._onConnectionChanged.event;
	}

	public get onLanguageFlavorChanged(): Event<azdata.DidChangeLanguageFlavorParams> {
		return this._onLanguageFlavorChanged.event;
	}

	// Connection Provider Registration

	public registerIconProvider(providerId: string, iconProvider: azdata.IconProvider): void {
		this._iconProviders.set(providerId, iconProvider);
	}

	public showConnectionDialog(params?: INewConnectionParams, options?: IConnectionCompletionOptions, model?: ConnectionProfile, connectionResult?: IConnectionResult): Promise<void> {
		if (!params) {
			params = { connectionType: ConnectionType.default };
		}
		if (!model && params.input && params.input.uri) {
			model = this._connectionStatusManager.getConnectionProfile(params.input.uri);
		}
		return this._connectionDialogService.showDialog(this, params, model, connectionResult, options).catch(dialogError => {
			this._logService.warn('failed to open the connection dialog. error: ' + dialogError);
			throw dialogError;
		});
	}

	public async addSavedPassword(connectionProfile: ConnectionProfile): Promise<ConnectionProfile> {
		await this.fillInOrClearAzureToken(connectionProfile);
		return this._connectionStore.addSavedPassword(connectionProfile).then(result => result.profile);
	}

	public getProviderIdFromUri(ownerUri: string): string {
		let providerId = this._uriToProvider[ownerUri];
		if (!providerId) {
			providerId = this._connectionStatusManager.getProviderIdFromUri(ownerUri);
		}

		return providerId;
	}

	private tryConnect(connection: ConnectionProfile, options: InternalConnectOptions): Promise<IConnection> {
		// Load the password if it's not already loaded
		return this._connectionStore.addSavedPassword(connection).then(async result => {
			let newConnection = result.profile;
			let foundPassword = result.savedCred;

			// If there is no password, try to load it from an existing connection
			if (!foundPassword && newConnection.isPasswordRequired) {
				let existingConnection = this._connectionStatusManager.findConnectionProfile(connection);
				if (existingConnection && existingConnection.connectionProfile) {
					newConnection.password = existingConnection.connectionProfile.password;
					foundPassword = true;
				}
			}

			// Fill in the Azure account token if needed and open the connection dialog if it fails
			let tokenFillSuccess = await this.fillInOrClearAzureToken(newConnection);

			// If the password is required and still not loaded show the dialog
			if ((!foundPassword && newConnection.isPasswordRequired && !newConnection.password) || !tokenFillSuccess) {
				return this.showConnectionDialogOnError(connection, owner, { connected: false, errorMessage: undefined, callStack: undefined, errorCode: undefined }, options);
			} else {
				// Try to connect
				return this.connectWithOptions(newConnection, owner.uri, options, owner).then(connectionResult => {
					if (!connectionResult.connected && !connectionResult.errorHandled) {
						// If connection fails show the dialog
						return this.showConnectionDialogOnError(connection, owner, connectionResult, options);
					} else if (!connectionResult.connected && connectionResult.errorHandled) {
						// Cancelled firewall dialog
						return undefined;
					} else {
						//Resolve with the connection result
						return connectionResult;
					}
				});
			}
		});
	}

	private showConnectionDialogOnError(
		connection: ConnectionProfile,
		owner: IConnectableInput,
		connectionResult: IConnectionResult,
		options?: IConnectionCompletionOptions): Promise<IConnectionResult> {
		if (options && options.showConnectionDialogOnError) {
			let params: INewConnectionParams = options && options.params ? options.params : {
				connectionType: this._connectionStatusManager.isDefaultTypeUri(owner.uri) ? ConnectionType.default : ConnectionType.editor,
				input: owner,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				showDashboard: options.showDashboard
			};
			return this.showConnectionDialog(params, options, connection, connectionResult).then(() => {
				return connectionResult;
			});
		} else {
			return Promise.resolve(connectionResult);
		}
	}

	public connectIfNotConnected(connection: ConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection' | 'notebook', saveConnection: boolean = false): Promise<string> {
		let ownerUri: string = Utils.generateUri(connection, purpose);
		if (this._connectionStatusManager.isConnected(ownerUri)) {
			return Promise.resolve(this._connectionStatusManager.getOriginalOwnerUri(ownerUri));
		} else {
			const options: IConnectionCompletionOptions = {
				saveTheConnection: saveConnection,
				showConnectionDialogOnError: true,
				showDashboard: purpose === 'dashboard',
				params: undefined,
				showFirewallRuleOnError: true,
			};
			return this.connect(connection, ownerUri, options).then(connectionResult => {
				if (connectionResult && connectionResult.connected) {
					return this._connectionStatusManager.getOriginalOwnerUri(ownerUri);
				} else {
					throw connectionResult.errorMessage;
				}
			});
		}
	}

	public connectAndSaveProfile(connection: ConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks):
		Promise<IConnectionResult> {
		if (!options) {
			options = {
				saveTheConnection: true,
				showDashboard: false,
				params: undefined,
				showConnectionDialogOnError: false,
				showFirewallRuleOnError: true
			};
		}

		// Do not override options.saveTheConnection as this is for saving to the server groups, not the MRU.
		// MRU save always happens through a different path using tryAddActiveConnection
		return this.connectWithOptions(connection, uri, options, callbacks);
	}

	private async connectWithOptions(connection: ConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		connection.options['groupId'] = connection.groupId;
		connection.options['databaseDisplayName'] = connection.databaseName;

		if (!uri) {
			uri = Utils.generateUri(connection);
		}
		uri = this._connectionStatusManager.getOriginalOwnerUri(uri);
		if (!callbacks) {
			callbacks = {
				onConnectReject: () => { },
				onConnectStart: () => { },
				onConnectSuccess: () => { },
				onDisconnect: () => { },
				onConnectCanceled: () => { }
			};
		}
		if (!options) {
			options = {
				saveTheConnection: false,
				showDashboard: false,
				params: undefined,
				showConnectionDialogOnError: false,
				showFirewallRuleOnError: true
			};
		}
		if (callbacks.onConnectStart) {
			callbacks.onConnectStart();
		}
		let tokenFillSuccess = await this.fillInOrClearAzureToken(connection);
		if (!tokenFillSuccess) {
			throw new Error(nls.localize('connection.noAzureAccount', "Failed to get Azure account token for connection"));
		}
		return this.createNewConnection(uri, connection).then(async connectionResult => {
			if (connectionResult && connectionResult.connected) {
				// The connected succeeded so add it to our active connections now, optionally adding it to the MRU based on
				// the options.saveTheConnection setting
				let connectionMgmtInfo = this._connectionStatusManager.findConnection(uri);
				this.tryAddActiveConnection(connectionMgmtInfo, connection, options.saveTheConnection);

				if (callbacks.onConnectSuccess) {
					callbacks.onConnectSuccess(options.params, connectionResult.connectionProfile);
				}
				if (options.saveTheConnection) {
					await this.saveToSettings(uri, connection).then(value => {
						this._onAddConnectionProfile.fire(connection);
						this.doActionsAfterConnectionComplete(value, options);
					});
				} else {
					connection.saveProfile = false;
					this.doActionsAfterConnectionComplete(uri, options);
				}
				if (connection.savePassword) {
					return this._connectionStore.savePassword(connection).then(() => {
						return connectionResult;
					});
				} else {
					return connectionResult;
				}
			} else if (connectionResult && connectionResult.errorMessage) {
				return this.handleConnectionError(connection, uri, options, callbacks, connectionResult).catch(handleConnectionError => {
					if (callbacks.onConnectReject) {
						callbacks.onConnectReject(handleConnectionError);
					}
					throw handleConnectionError;
				});
			} else {
				if (callbacks.onConnectReject) {
					callbacks.onConnectReject(nls.localize('connectionNotAcceptedError', "Connection Not Accepted"));
				}
				return connectionResult;
			}
		}).catch(err => {
			if (callbacks.onConnectReject) {
				callbacks.onConnectReject(err);
			}
			throw err;
		});
	}

	private handleConnectionError(connection: ConnectionProfile, uri: string, options: IConnectionCompletionOptions, callbacks: IConnectionCallbacks, connectionResult: IConnectionResult) {
		let connectionNotAcceptedError = nls.localize('connectionNotAcceptedError', "Connection Not Accepted");
		if (options.showFirewallRuleOnError && connectionResult.errorCode) {
			return this.handleFirewallRuleError(connection, connectionResult).then(success => {
				if (success) {
					options.showFirewallRuleOnError = false;
					return this.connectWithOptions(connection, uri, options, callbacks);
				} else {
					if (callbacks.onConnectReject) {
						callbacks.onConnectReject(connectionNotAcceptedError);
					}
					return connectionResult;
				}
			});
		} else {
			if (callbacks.onConnectReject) {
				callbacks.onConnectReject(connectionNotAcceptedError);
			}
			return Promise.resolve(connectionResult);
		}
	}

	private handleFirewallRuleError(connection: ConnectionProfile, connectionResult: IConnectionResult): Promise<boolean> {
		return this._resourceProviderService.handleFirewallRule(connectionResult.errorCode, connectionResult.errorMessage, connection.providerName).then(response => {
			if (response.canHandleFirewallRule) {
				connectionResult.errorHandled = true;
				return this._resourceProviderService.showFirewallRuleDialog(connection, response.ipAddress, response.resourceProviderId);
			} else {
				return false;
			}
		});
	}

	private doActionsAfterConnectionComplete(uri: string, options: IConnectionCompletionOptions, ) {
		let connectionManagementInfo = this._connectionStatusManager.findConnection(uri);
		if (options.showDashboard) {
			this.showDashboardForConnectionManagementInfo(connectionManagementInfo.connectionProfile);
		}

		let connectionProfile = connectionManagementInfo.connectionProfile;
		this._onConnect.fire(<IConnectionParams>{
			connectionUri: uri,
			connectionProfile: connectionProfile
		});

		let iconProvider = this._iconProviders.get(connectionManagementInfo.providerId);
		if (iconProvider) {
			let serverInfo: azdata.ServerInfo = this.getServerInfo(connectionProfile.id);
			iconProvider.getConnectionIconId(connectionProfile, serverInfo).then(iconId => {
				if (iconId && this._mementoObj && this._mementoContext) {
					if (!this._mementoObj.CONNECTION_ICON_ID) {
						this._mementoObj.CONNECTION_ICON_ID = <any>{};
					}
					if (this._mementoObj.CONNECTION_ICON_ID[connectionProfile.id] !== iconId) {
						this._mementoObj.CONNECTION_ICON_ID[connectionProfile.id] = iconId;
						this._mementoContext.saveMemento();
					}
				}
			});
		}
	}

	public getConnectionIconId(connectionId: string): string {
		if (!connectionId || !this._mementoObj || !this._mementoObj.CONNECTION_ICON_ID) {
			return undefined;
		}
		return this._mementoObj.CONNECTION_ICON_ID[connectionId];
	}

	public showDashboard(connection: ConnectionProfile): Thenable<boolean> {
		return this.showDashboardForConnectionManagementInfo(connection);
	}

	private showDashboardForConnectionManagementInfo(connectionProfile: ConnectionProfile): Thenable<boolean> {
		// if dashboard profile is already open, focus on that tab
		if (!this.focusDashboard(connectionProfile)) {
			let dashboardInput: DashboardInput = this._instantiationService ? this._instantiationService.createInstance(DashboardInput, connectionProfile) : undefined;
			return dashboardInput.initializedPromise.then(() => {
				return this._editorService.openEditor(dashboardInput, { pinned: true }, ACTIVE_GROUP);
			}).then(() => true);
		} else {
			return Promise.resolve(true);
		}
	}

	private focusDashboard(profile: ConnectionProfile): boolean {
		let found: boolean = false;

		this._editorService.editors.map(editor => {
			if (editor instanceof DashboardInput) {
				if (DashboardInput.profileMatches(profile, editor.connectionProfile)) {
					editor.connectionProfile.connectionName = profile.connectionName;
					editor.connectionProfile.databaseName = profile.databaseName;
					this._editorService.openEditor(editor)
						.then(() => {
							if (!profile.databaseName || Utils.isMaster(profile)) {
								this._angularEventing.sendAngularEvent(editor.uri, AngularEventType.NAV_SERVER);
							} else {
								this._angularEventing.sendAngularEvent(editor.uri, AngularEventType.NAV_DATABASE);
							}
							found = true;
						}, errors.onUnexpectedError);
				}
			}
		});

		return found;
	}

	public closeDashboard(uri: string): void {

	}

	public getConnectionGroups(providers?: string[]): ConnectionGroup[] {
		return this._connectionStore.getConnectionProfileGroups(false, providers);
	}

	public getRecentConnections(providers?: string[]): ConnectionProfile[] {
		return this._connectionStore.getRecentlyUsedConnections(providers);
	}


	public clearRecentConnectionsList(): void {
		return this._connectionStore.clearRecentlyUsed();
	}

	public clearRecentConnection(connectionProfile: ConnectionProfile): void {
		this._connectionStore.removeRecentConnection(connectionProfile);
	}

	public getActiveConnections(providers?: string[]): ConnectionProfile[] {
		return this._connectionStatusManager.getActiveConnectionProfiles(providers);
	}

	public getConnectionUriFromId(connectionId: string): string {
		let connectionInfo = this._connectionStatusManager.findConnectionByProfileId(connectionId);
		if (connectionInfo) {
			return connectionInfo.ownerUri;
		} else {
			return undefined;
		}
	}

	public saveProfileGroup(profile: IConnectionProfileGroup): Promise<string> {
		TelemetryUtils.addTelemetry(this._telemetryService, this._logService, TelemetryKeys.AddServerGroup).catch((e) => this._logService.error(e));
		return this._connectionStore.saveProfileGroup(profile).then(groupId => {
			this._onAddConnectionProfile.fire(undefined);
			return groupId;
		});
	}

	public getAdvancedProperties(): azdata.ConnectionOption[] {

		let providers = this._capabilitiesService.providers;
		if (providers) {
			// just grab the first registered provider for now, this needs to change
			// to lookup based on currently select provider
			let providerCapabilities = values(providers)[0];
			if (!!providerCapabilities.connection) {
				return providerCapabilities.connection.connectionOptions;
			}
		}

		return undefined;
	}

	public hasRegisteredServers(): boolean {
		const groups: ConnectionGroup[] = this.getConnectionGroups();
		const hasRegisteredServers: boolean = this.doHasRegisteredServers(groups);
		groups.forEach(cpg => cpg.dispose());
		return hasRegisteredServers;
	}

	private doHasRegisteredServers(root: ConnectionGroup[]): boolean {

		if (!root || root.length === 0) {
			return false;
		}

		for (let i = 0; root.length; ++i) {
			let item = root[i];

			if (!item) {
				return false;
			}

			if (item.connections && item.connections.length > 0) {
				return true;
			}

			if (this.doHasRegisteredServers(item.children)) {
				return true;
			}
		}

		return false;
	}

	public getConnectionUri(connectionProfile: ConnectionProfile): string {
		return this._connectionStatusManager.getOriginalOwnerUri(Utils.generateUri(connectionProfile));
	}

	public getFormattedUri(uri: string, connectionProfile: ConnectionProfile): string {
		if (this._connectionStatusManager.isDefaultTypeUri(uri)) {
			return this.getConnectionUri(connectionProfile);
		} else {
			return uri;
		}
	}

	public doChangeLanguageFlavor(uri: string, language: string, provider: string): void {
		if (this._providers.has(provider)) {
			this._onLanguageFlavorChanged.fire({
				uri: uri,
				language: language,
				flavor: provider
			});
		} else {
			throw new Error(`provider "${provider}" is not registered`);
		}
	}

	public ensureDefaultLanguageFlavor(uri: string): void {
		if (!this.getProviderIdFromUri(uri)) {
			// Lookup the default settings and use this
			let defaultProvider = WorkbenchUtils.getSqlConfigValue<string>(this._configurationService, Constants.defaultEngine);
			if (defaultProvider && this._providers.has(defaultProvider)) {
				// Only set a default if it's in the list of registered providers
				this.doChangeLanguageFlavor(uri, 'sql', defaultProvider);
			}
		}
	}

	private async fillInOrClearAzureToken(connection: ConnectionProfile): Promise<boolean> {
		if (connection.authenticationType !== Constants.azureMFA) {
			connection.options['azureAccountToken'] = undefined;
			return true;
		}
		if (connection.options['azureAccountToken']) {
			return true;
		}
		let accounts = await this._accountManagementService.getAccountsForProvider('azurePublicCloud');
		if (accounts && accounts.length > 0) {
			let account = find(accounts, account => account.key.accountId === connection.userName);
			if (account) {
				if (account.isStale) {
					try {
						account = await this._accountManagementService.refreshAccount(account);
					} catch {
						// refreshAccount throws an error if the user cancels the dialog
						return false;
					}
				}
				let tokensByTenant = await this._accountManagementService.getSecurityToken(account, AzureResource.Sql);
				let token: string;
				let tenantId = connection.azureTenantId;
				if (tenantId && tokensByTenant[tenantId]) {
					token = tokensByTenant[tenantId].token;
				} else {
					let tokens = values(tokensByTenant);
					if (tokens.length === 0) {
						return false;
					}
					token = values(tokensByTenant)[0].token;
				}
				connection.options['azureAccountToken'] = token;
				connection.options['password'] = '';
				return true;
			}
		}
		return false;
	}

	// Request Senders
	private async sendConnectRequest(connection: ConnectionProfile, uri: string): Promise<boolean> {
		let connectionInfo = assign({}, {
			options: connection.options
		});

		// setup URI to provider ID map for connection
		this._uriToProvider[uri] = connection.providerName;

		return this._providers.get(connection.providerName).onReady.then((provider) => {
			provider.connect(uri, connectionInfo);
			this._onConnectRequestSent.fire();

			// TODO make this generic enough to handle non-SQL languages too
			this.doChangeLanguageFlavor(uri, 'sql', connection.providerName);
			return true;
		});
	}

	private sendDisconnectRequest(uri: string): Promise<boolean> {
		let providerId: string = this.getProviderIdFromUri(uri);
		if (!providerId) {
			return Promise.resolve(false);
		}

		return this._providers.get(providerId).onReady.then(provider => {
			provider.disconnect(uri);
			return true;
		});
	}

	private sendCancelRequest(uri: string): Promise<boolean> {
		let providerId: string = this.getProviderIdFromUri(uri);
		if (!providerId) {
			return Promise.resolve(false);
		}

		return this._providers.get(providerId).onReady.then(provider => {
			provider.cancelConnect(uri);
			return true;
		});
	}

	private sendListDatabasesRequest(uri: string): Thenable<azdata.ListDatabasesResult> {
		let providerId: string = this.getProviderIdFromUri(uri);
		if (!providerId) {
			return Promise.resolve(undefined);
		}

		return this._providers.get(providerId).onReady.then(provider => {
			return provider.listDatabases(uri).then(result => {
				if (result && result.databaseNames) {
					result.databaseNames.sort();
				}
				return result;
			});
		});
	}

	private saveToSettings(id: string, connection: ConnectionProfile): Promise<string> {
		return this._connectionStore.saveProfile(connection).then(savedProfile => {
			let newId = this._connectionStatusManager.updateConnectionProfile(savedProfile, id);
			return newId;
		});
	}

	private tryAddActiveConnection(connectionManagementInfo: ConnectionManagementInfo, newConnection: ConnectionProfile, addToMru: boolean): void {
		if (newConnection && addToMru) {
			this._connectionStore.addRecentConnection(newConnection)
				.then(() => {
					connectionManagementInfo.connectHandler(true);
				}, err => {
					connectionManagementInfo.connectHandler(false, err);
				});
		} else {
			connectionManagementInfo.connectHandler(false);
		}
	}

	private addTelemetryForConnection(connection: ConnectionManagementInfo): void {
		TelemetryUtils.addTelemetry(this._telemetryService, this._logService, TelemetryKeys.DatabaseConnected, {
			connectionType: connection.serverInfo ? (connection.serverInfo.isCloud ? 'Azure' : 'Standalone') : '',
			provider: connection.connectionProfile.providerName,
			serverVersion: connection.serverInfo ? connection.serverInfo.serverVersion : '',
			serverEdition: connection.serverInfo ? connection.serverInfo.serverEdition : '',

			extensionConnectionTime: connection.extensionTimer.elapsed() - connection.serviceTimer.elapsed(),
			serviceConnectionTime: connection.serviceTimer.elapsed()
		}).catch((e) => this._logService.error(e));
	}

	private addTelemetryForConnectionDisconnected(connection: ConnectionProfile): void {
		TelemetryUtils.addTelemetry(this._telemetryService, this._logService, TelemetryKeys.DatabaseDisconnected, {
			provider: connection.providerName
		}).catch((e) => this._logService.error(e));
	}

	public onConnectionComplete(handle: number, info: azdata.ConnectionInfoSummary): void {
		let connection = this._connectionStatusManager.onConnectionComplete(info);

		if (info.connectionId) {
			if (info.connectionSummary && info.connectionSummary.databaseName) {
				this._connectionStatusManager.updateDatabaseName(info);
			}
			connection.serverInfo = info.serverInfo;
			connection.extensionTimer.stop();

			connection.connectHandler(true);
			this.addTelemetryForConnection(connection);

			if (this._connectionStatusManager.isDefaultTypeUri(info.ownerUri)) {
				this._connectionGlobalStatus.setStatusToConnected(info.connectionSummary);
			}
		} else {
			connection.connectHandler(false, info.errorMessage, info.errorNumber, info.messages);
		}
	}

	public onConnectionChangedNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void {
		let profile = this._connectionStatusManager.onConnectionChanged(changedConnInfo);
		this._notifyConnectionChanged(profile, changedConnInfo.connectionUri);
	}

	private _notifyConnectionChanged(profile: ConnectionProfile, connectionUri: string): void {
		if (profile) {
			this._onConnectionChanged.fire(<IConnectionParams>{
				connectionProfile: profile,
				connectionUri: connectionUri
			});
		}
	}

	public onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
	}

	public changeGroupIdForConnectionGroup(source: ConnectionGroup, target: ConnectionGroup): Promise<void> {
		TelemetryUtils.addTelemetry(this._telemetryService, this._logService, TelemetryKeys.MoveServerConnection).catch((e) => this._logService.error(e));
		return this._connectionStore.changeGroupIdForConnectionGroup(source, target);
	}

	public changeGroupIdForConnection(source: ConnectionProfile, targetGroupId: string): Promise<void> {
		let id = Utils.generateUri(source);
		TelemetryUtils.addTelemetry(this._telemetryService, this._logService, TelemetryKeys.MoveServerGroup).catch((e) => this._logService.error(e));
		return this._connectionStore.changeGroupIdForConnection(source, targetGroupId).then(result => {
			if (id && targetGroupId) {
				source.groupId = targetGroupId;
			}
		});
	}

	public canChangeConnectionConfig(profile: ConnectionProfile, newGroupID: string): boolean {
		return this._connectionStore.canChangeConnectionConfig(profile, newGroupID);
	}

	public isRecent(connectionProfile: ConnectionProfile): boolean {
		let recentConnections = this._connectionStore.getRecentlyUsedConnections();
		recentConnections = recentConnections.filter(con => {
			return connectionProfile.id === con.id;
		});
		return (recentConnections.length >= 1);
	}

	// Disconnect a URI from its current connection
	// The default editor implementation does not perform UI updates
	// The default force implementation is set to false
	public disconnectEditor(owner: IConnectableInput, force: boolean = false): Promise<boolean> {
		// If the URI is connected, disconnect it and the editor
		if (this.isConnected(owner.uri)) {
			let connection = this.getConnectionProfile(owner.uri);
			owner.onDisconnect();
			return this.doDisconnect(owner.uri, connection);

			// If the URI is connecting, prompt the user to cancel connecting
		} else if (this.isConnecting(owner.uri)) {
			if (!force) {
				return this.shouldCancelConnect(owner.uri).then((result) => {
					// If the user wants to cancel, then disconnect
					if (result) {
						owner.onDisconnect();
						return this.cancelEditorConnection(owner);
					}
					// If the user does not want to cancel, then ignore
					return false;
				});
			} else {
				owner.onDisconnect();
				return this.cancelEditorConnection(owner);
			}
		}
		// If the URI is disconnected, ensure the UI state is consistent and resolve true
		owner.onDisconnect();
		return Promise.resolve(true);
	}

	// Connect an open URI to a connection profile
	private createNewConnection(uri: string, connection: ConnectionProfile): Promise<IConnectionResult> {
		const self = this;
		this._logService.info(`Creating new connection ${uri}`);
		return new Promise<IConnectionResult>((resolve, reject) => {
			let connectionInfo = this._connectionStatusManager.addConnection(connection, uri);
			// Setup the handler for the connection complete notification to call
			connectionInfo.connectHandler = ((connectResult, errorMessage, errorCode, callStack) => {
				let connectionMngInfo = this._connectionStatusManager.findConnection(uri);
				if (connectionMngInfo && connectionMngInfo.deleted) {
					this._connectionStatusManager.deleteConnection(uri);
					resolve({ connected: connectResult, errorMessage: undefined, errorCode: undefined, callStack: undefined, errorHandled: true, connectionProfile: connection });
				} else {
					if (errorMessage) {
						// Connection to the server failed
						this._connectionStatusManager.deleteConnection(uri);
						resolve({ connected: connectResult, errorMessage: errorMessage, errorCode: errorCode, callStack: callStack, connectionProfile: connection });
					} else {
						resolve({ connected: connectResult, errorMessage: errorMessage, errorCode: errorCode, callStack: callStack, connectionProfile: connection });
					}
				}
			});

			// send connection request
			self.sendConnectRequest(connection, uri).catch((e) => this._logService.error(e));
		});
	}

	// Ask user if they are sure they want to cancel connection request
	private shouldCancelConnect(fileUri: string): Promise<boolean> {
		// Double check if the user actually wants to cancel their connection request
		// Setup our cancellation choices
		let choices: { key, value }[] = [
			{ key: nls.localize('connectionService.yes', "Yes"), value: true },
			{ key: nls.localize('connectionService.no', "No"), value: false }
		];

		return this._quickInputService.pick(choices.map(x => x.key), { placeHolder: nls.localize('cancelConnectionConfirmation', "Are you sure you want to cancel this connection?"), ignoreFocusLost: true }).then((choice) => {
			let confirm = find(choices, x => x.key === choice);
			return confirm && confirm.value;
		});
	}

	private doDisconnect(fileUri: string, connection?: ConnectionProfile): Promise<boolean> {
		let disconnectParams = new ConnectionContracts.DisconnectParams();
		disconnectParams.ownerUri = fileUri;

		// Send a disconnection request for the input URI
		return this.sendDisconnectRequest(fileUri).then((result) => {
			// If the request was sent
			if (result) {
				this._connectionStatusManager.deleteConnection(fileUri);
				if (connection) {
					this._notifyDisconnected(connection, fileUri);
				}

				if (this._connectionStatusManager.isDefaultTypeUri(fileUri)) {
					this._connectionGlobalStatus.setStatusToDisconnected(fileUri);
				}

				// TODO: send telemetry events
				// Telemetry.sendTelemetryEvent('DatabaseDisconnected');
			}

			return result;
		});
	}

	public disconnect(connection: ConnectionProfile): Promise<void>;
	public disconnect(ownerUri: string): Promise<void>;
	public disconnect(input: string | ConnectionProfile): Promise<void> {
		let uri: string;
		let profile: ConnectionProfile;
		if (typeof input === 'object') {
			uri = Utils.generateUri(input);
			profile = input;
		} else if (typeof input === 'string') {
			profile = this.getConnectionProfile(input);
			uri = input;
		}
		return this.doDisconnect(uri, profile).then(result => {
			if (result) {
				this.addTelemetryForConnectionDisconnected(profile);
				this._connectionStatusManager.removeConnection(uri);
			} else {
				throw result;
			}
		});
	}

	public cancelConnection(connection: ConnectionProfile): Thenable<boolean> {
		let fileUri = Utils.generateUri(connection);
		return this.cancelConnectionForUri(fileUri);
	}

	public cancelConnectionForUri(fileUri: string): Promise<boolean> {
		// Create a new set of cancel connection params with our file URI
		let cancelParams: ConnectionContracts.CancelConnectParams = new ConnectionContracts.CancelConnectParams();
		cancelParams.ownerUri = fileUri;

		this._connectionStatusManager.deleteConnection(fileUri);
		// Send connection cancellation request
		return this.sendCancelRequest(fileUri);
	}

	public cancelEditorConnection(owner: IConnectableInput): Promise<boolean> {
		let fileUri = owner.uri;
		if (this.isConnecting(fileUri)) {
			return this.cancelConnectionForUri(fileUri);
		} else {
			// If the editor is connected then there is nothing to cancel
			return Promise.resolve(false);
		}
	}
	// Is a certain file URI connected?
	public isConnected(fileUri: string, connectionProfile?: ConnectionProfile): boolean {
		if (connectionProfile) {
			fileUri = Utils.generateUri(connectionProfile);
		}
		return this._connectionStatusManager.isConnected(fileUri);
	}

	public listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult> {
		const self = this;
		if (self.isConnected(connectionUri)) {
			return self.sendListDatabasesRequest(connectionUri);
		}
		return Promise.resolve(undefined);
	}

	public changeDatabase(connectionUri: string, databaseName: string): Thenable<boolean> {
		if (this.isConnected(connectionUri)) {
			let providerId: string = this.getProviderIdFromUri(connectionUri);
			if (!providerId) {
				return Promise.resolve(false);
			}

			return this._providers.get(providerId).onReady.then(provider => {
				return provider.changeDatabase(connectionUri, databaseName).then(result => {
					if (result) {
						this.getConnectionProfile(connectionUri).databaseName = databaseName;
					}
					return result;
				});
			});
		}
		return Promise.resolve(false);
	}

	public editGroup(group: ConnectionGroup): Promise<void> {
		return this._connectionStore.editGroup(group).then(groupId => {
			this._onAddConnectionProfile.fire(undefined);
		});
	}

	public deleteConnection(connection: ConnectionProfile): Promise<boolean> {

		TelemetryUtils.addTelemetry(this._telemetryService, this._logService, TelemetryKeys.DeleteConnection, {}, connection).catch((e) => this._logService.error(e));
		// Disconnect if connected
		let uri = Utils.generateUri(connection);
		if (this.isConnected(uri) || this.isConnecting(uri)) {
			return this.doDisconnect(uri, connection).then((result) => {
				if (result) {
					// Remove profile from configuration
					return this._connectionStore.deleteConnectionFromConfiguration(connection).then(() => {
						this._onDeleteConnectionProfile.fire();
						return true;
					});

				} else {
					return false;
				}
			});
		} else {
			// Remove disconnected profile from settings
			return this._connectionStore.deleteConnectionFromConfiguration(connection).then(() => {
				this._onDeleteConnectionProfile.fire();
				return true;
			});
		}
	}

	public deleteConnectionGroup(group: ConnectionGroup): Promise<boolean> {
		TelemetryUtils.addTelemetry(this._telemetryService, this._logService, TelemetryKeys.DeleteServerGroup).catch((e) => this._logService.error(e));
		// Get all connections for this group
		let connections = ConnectionGroup.getConnectionsInGroup(group);

		// Disconnect all these connections
		let disconnected = [];
		connections.forEach((con) => {
			let uri = Utils.generateUri(con);
			if (this.isConnected(uri)) {
				disconnected.push(this.doDisconnect(uri, con));
			}
		});

		// When all the disconnect promises resolve, remove profiles from config
		return Promise.all(disconnected).then(() => {
			// Remove profiles and groups from config
			return this._connectionStore.deleteGroupFromConfiguration(group).then(() => {
				this._onDeleteConnectionProfile.fire();
				return true;
			});
		}).catch(() => false);
	}

	private _notifyDisconnected(connectionProfile: ConnectionProfile, connectionUri: string): void {
		this._onDisconnect.fire(<IConnectionParams>{
			connectionUri: connectionUri,
			connectionProfile: connectionProfile
		});
	}

	public rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
		if (this.isConnected(connectionUri)) {
			let providerId: string = this.getProviderIdFromUri(connectionUri);
			if (!providerId) {
				return Promise.reject('No provider corresponding to the given URI');
			}

			return this._providers.get(providerId).onReady.then(provider => provider.rebuildIntelliSenseCache(connectionUri));
		}
		return Promise.reject('The given URI is not currently connected');
	}

	public getTabColorForUri(uri: string): string {
		if (WorkbenchUtils.getSqlConfigValue<string>(this._configurationService, 'tabColorMode') === QueryConstants.tabColorModeOff) {
			return undefined;
		}
		let connectionProfile = this.getConnectionProfile(uri);
		if (!connectionProfile) {
			return undefined;
		}
		let matchingGroup = this._connectionStore.getGroupFromId(connectionProfile.groupId);
		if (!matchingGroup) {
			return undefined;
		}
		return matchingGroup.color;
	}

	public getActiveConnectionCredentials(profileId: string): { [name: string]: string } {
		let profile = find(this.getActiveConnections(), connectionProfile => connectionProfile.id === profileId);
		if (!profile) {
			return undefined;
		}

		// Find the password option for the connection provider
		let passwordOption = find(this._capabilitiesService.getCapabilities(profile.providerName).connection.connectionOptions,
			option => option.specialValueType === ConnectionOptionSpecialType.password);
		if (!passwordOption) {
			return undefined;
		}

		let credentials = {};
		credentials[passwordOption.name] = profile.options[passwordOption.name];
		return credentials;
	}

	public getServerInfo(profileId: string): azdata.ServerInfo {
		let profile = this._connectionStatusManager.findConnectionByProfileId(profileId);
		if (!profile) {
			return undefined;
		}

		let serverInfo = profile.serverInfo;

		return serverInfo;
	}

	public getConnectionProfileById(profileId: string): ConnectionProfile {
		let profile = this._connectionStatusManager.findConnectionByProfileId(profileId);
		if (!profile) {
			return undefined;
		}
		return profile.connectionProfile;
	}

	public getConnectionString(connectionId: string, includePassword: boolean = false): Thenable<string> {
		let ownerUri = this.getConnectionUriFromId(connectionId);

		if (!ownerUri) {
			return Promise.resolve(undefined);
		}

		let providerId = this.getProviderIdFromUri(ownerUri);
		if (!providerId) {
			return Promise.resolve(undefined);
		}

		return this._providers.get(providerId).onReady.then(provider => {
			return provider.getConnectionString(ownerUri, includePassword).then(connectionString => {
				return connectionString;
			});
		});
	}

	public buildConnectionInfo(connectionString: string, provider: string): Thenable<azdata.ConnectionInfo> {
		let connectionProvider = this._providers.get(provider);
		if (connectionProvider) {
			return connectionProvider.onReady.then(e => {
				return e.buildConnectionInfo(connectionString);
			});
		}
		return Promise.resolve(undefined);
	}

	public getProviderProperties(providerName: string): ConnectionProviderProperties {
		let connectionProvider = this._providers.get(providerName);
		return connectionProvider && connectionProvider.properties;
	}

	public getConnections(activeConnectionsOnly?: boolean): ConnectionProfile[] {
		// 1. Active Connections
		const connections = this.getActiveConnections();

		const connectionExists: (conn: ConnectionProfile) => boolean = (conn) => {
			return find(connections, existingConnection => existingConnection.id === conn.id) !== undefined;
		};

		if (!activeConnectionsOnly) {
			// 2. Recent Connections
			this.getRecentConnections().forEach(connection => {
				if (!connectionExists(connection)) {
					connections.push(connection);
				}
			});

			// 3. Saved Connections
			const groups = this.getConnectionGroups();
			if (groups && groups.length > 0) {
				groups.forEach(group => {
					this.getConnectionsInGroup(group).forEach(savedConnection => {
						if (!connectionExists(savedConnection)) {
							connections.push(savedConnection);
						}
					});
				});
			}
		}
		return connections;
	}

	public getConnection(uri: string): ConnectionProfile {
		const connections = this.getActiveConnections();
		if (connections) {
			for (let connection of connections) {
				let connectionUri = this.getConnectionUriFromId(connection.id);
				if (connectionUri === uri) {
					return connection;
				}
			}
		}

		return undefined;
	}

	private getConnectionsInGroup(group: ConnectionGroup): ConnectionProfile[] {
		const connections = [];
		if (group) {
			if (group.connections && group.connections.length > 0) {
				connections.push(...group.connections);
			}
			if (group.children && group.children.length > 0) {
				group.children.forEach(child => connections.push(...this.getConnectionsInGroup(child)));
			}
		}
		return connections;
	}*/
}
