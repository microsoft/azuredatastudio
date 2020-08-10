/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import {
	IConnectionManagementService, INewConnectionParams,
	ConnectionType, IConnectableInput, IConnectionCompletionOptions, IConnectionCallbacks,
	IConnectionParams, IConnectionResult, RunQueryOnConnectionMode
} from 'sql/platform/connection/common/connectionManagement';
import { ConnectionStore } from 'sql/platform/connection/common/connectionStore';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import * as Utils from 'sql/platform/connection/common/utils';
import * as Constants from 'sql/platform/connection/common/constants';
import { ICapabilitiesService, ConnectionProviderProperties, ProviderFeatures } from 'sql/platform/capabilities/common/capabilitiesService';
import * as ConnectionContracts from 'sql/workbench/services/connection/browser/connection';
import { ConnectionStatusManager } from 'sql/platform/connection/common/connectionStatusManager';
import { DashboardInput } from 'sql/workbench/browser/editor/profiler/dashboardInput';
import { ConnectionGlobalStatus } from 'sql/workbench/services/connection/browser/connectionGlobalStatus';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { IAngularEventingService, AngularEventType } from 'sql/platform/angularEventing/browser/angularEventingService';
import { Deferred } from 'sql/base/common/promise';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IAccountManagementService, AzureResource } from 'sql/platform/accounts/common/interfaces';

import * as azdata from 'azdata';

import * as nls from 'vs/nls';
import * as errors from 'vs/base/common/errors';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { Event, Emitter } from 'vs/base/common/event';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService } from 'vs/platform/log/common/log';
import * as interfaces from 'sql/platform/connection/common/interfaces';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { Memento } from 'vs/workbench/common/memento';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { entries } from 'sql/base/common/collections';
import { find } from 'vs/base/common/arrays';
import { values } from 'vs/base/common/collections';
import { assign } from 'vs/base/common/objects';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';

export class ConnectionManagementService extends Disposable implements IConnectionManagementService {

	_serviceBrand: undefined;

	private _providers = new Map<string, { onReady: Promise<azdata.ConnectionProvider>, properties: ConnectionProviderProperties }>();
	private _providerNameToDisplayNameMap: { [providerDisplayName: string]: string } = {};
	private _iconProviders = new Map<string, azdata.IconProvider>();
	private _uriToProvider: { [uri: string]: string; } = Object.create(null);
	private _onAddConnectionProfile = new Emitter<interfaces.IConnectionProfile>();
	private _onDeleteConnectionProfile = new Emitter<void>();
	private _onConnect = new Emitter<IConnectionParams>();
	private _onDisconnect = new Emitter<IConnectionParams>();
	private _onConnectRequestSent = new Emitter<void>();
	private _onConnectionChanged = new Emitter<IConnectionParams>();
	private _onLanguageFlavorChanged = new Emitter<azdata.DidChangeLanguageFlavorParams>();
	private _connectionGlobalStatus = new ConnectionGlobalStatus(this._notificationService);

	private _mementoContext: Memento;
	private _mementoObj: any;
	private static readonly CONNECTION_MEMENTO = 'ConnectionManagement';
	private static readonly _azureResources: AzureResource[] =
		[AzureResource.ResourceManagement, AzureResource.Sql, AzureResource.OssRdbms];

	constructor(
		private _connectionStore: ConnectionStore,
		private _connectionStatusManager: ConnectionStatusManager,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@INotificationService private _notificationService: INotificationService,
		@IResourceProviderService private _resourceProviderService: IResourceProviderService,
		@IAngularEventingService private _angularEventing: IAngularEventingService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@ILogService private _logService: ILogService,
		@IStorageService private _storageService: IStorageService,
		@IEnvironmentService private _environmentService: IEnvironmentService,
		@IExtensionService private readonly extensionService: IExtensionService
	) {
		super();

		if (!this._connectionStore) {
			this._connectionStore = _instantiationService.createInstance(ConnectionStore);
		}
		if (!this._connectionStatusManager) {
			this._connectionStatusManager = new ConnectionStatusManager(this._capabilitiesService, this._logService, this._environmentService, this._notificationService);
		}

		if (this._storageService) {
			this._mementoContext = new Memento(ConnectionManagementService.CONNECTION_MEMENTO, this._storageService);
			this._mementoObj = this._mementoContext.getMemento(StorageScope.GLOBAL);
		}

		this.initializeConnectionProvidersMap();

		let providerRegistration = (p: { id: string, features: ProviderFeatures }) => {
			let provider = {
				onReady: new Deferred<azdata.ConnectionProvider>(),
				properties: p.features.connection
			};
			this._providers.set(p.id, provider);
		};

		this._capabilitiesService.onCapabilitiesRegistered(providerRegistration, this);
		entries(this._capabilitiesService.providers).map(v => {
			providerRegistration({ id: v[0], features: v[1] });
		});

		this._register(this._onAddConnectionProfile);
		this._register(this._onDeleteConnectionProfile);
	}

	/**
	 * Set the initial value for the connection provider map and listen to the provider change event
	 */
	private initializeConnectionProvidersMap() {
		this.updateConnectionProvidersMap();
		if (this._capabilitiesService) {
			this._capabilitiesService.onCapabilitiesRegistered(() => {
				this.updateConnectionProvidersMap();
			});
		}
	}

	/**
	 * Update the map using the values from capabilities service
	 */
	private updateConnectionProvidersMap() {
		if (this._capabilitiesService) {
			this._providerNameToDisplayNameMap = {};
			entries(this._capabilitiesService.providers).forEach(p => {
				this._providerNameToDisplayNameMap[p[0]] = p[1].connection.displayName;
			});
		}
	}

	public providerRegistered(providerId: string): boolean {
		return !!this._providers.get(providerId);
	}

	// Event Emitters
	public get onAddConnectionProfile(): Event<interfaces.IConnectionProfile> {
		return this._onAddConnectionProfile.event;
	}

	public get onDeleteConnectionProfile(): Event<void> {
		return this._onDeleteConnectionProfile.event;
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

	public get onConnectionRequestSent(): Event<void> {
		return this._onConnectRequestSent.event;
	}

	public get onLanguageFlavorChanged(): Event<azdata.DidChangeLanguageFlavorParams> {
		return this._onLanguageFlavorChanged.event;
	}

	public get providerNameToDisplayNameMap(): { readonly [providerDisplayName: string]: string } {
		return this._providerNameToDisplayNameMap;
	}

	// Connection Provider Registration
	public registerProvider(providerId: string, provider: azdata.ConnectionProvider): void {
		if (!this._providers.has(providerId)) {
			this._logService.warn('Provider', providerId, 'attempted to register but has no metadata');
			let providerType = {
				onReady: new Deferred<azdata.ConnectionProvider>(),
				properties: undefined
			};
			this._providers.set(providerId, providerType);
		}

		// we know this is a deferred promise because we made it
		(this._providers.get(providerId).onReady as Deferred<azdata.ConnectionProvider>).resolve(provider);
	}

	public registerIconProvider(providerId: string, iconProvider: azdata.IconProvider): void {
		this._iconProviders.set(providerId, iconProvider);
	}

	/**
	 * Opens the connection dialog
	 * @param params Include the uri, type of connection
	 * @param model the existing connection profile to create a new one from
	 */
	public showConnectionDialog(params?: INewConnectionParams, options?: IConnectionCompletionOptions, model?: interfaces.IConnectionProfile, connectionResult?: IConnectionResult): Promise<void> {
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

	/**
	 * Opens the edit connection dialog
	 * @param model the existing connection profile to edit on.
	 */
	public async showEditConnectionDialog(model: interfaces.IConnectionProfile): Promise<void> {
		if (!model) {
			throw new Error('Connection Profile is undefined');
		}
		let params = {
			connectionType: ConnectionType.default,
			isEditConnection: true,
			oldProfileId: model.id
		};

		try {
			return await this._connectionDialogService.showDialog(this, params, model);
		} catch (dialogError) {
			this._logService.warn('failed to open the connection dialog. error: ' + dialogError);
		}
	}

	/**
	 * Load the password for the profile
	 * @param connectionProfile Connection Profile
	 */
	public async addSavedPassword(connectionProfile: interfaces.IConnectionProfile): Promise<interfaces.IConnectionProfile> {
		await this.fillInOrClearAzureToken(connectionProfile);
		return this._connectionStore.addSavedPassword(connectionProfile).then(result => result.profile);
	}

	/**
	 * Get the connections provider ID from an connection URI
	 */
	public getProviderIdFromUri(ownerUri: string): string {
		let providerId = this._uriToProvider[ownerUri];
		if (!providerId) {
			providerId = this._connectionStatusManager.getProviderIdFromUri(ownerUri);
		}

		return providerId;
	}

	/**
	 * Get the connection providers map and filter out CMS.
	 */
	public getUniqueConnectionProvidersByNameMap(providerNameToDisplayNameMap: { [providerDisplayName: string]: string }): { [providerDisplayName: string]: string } {
		let uniqueProvidersMap = {};
		let providerNames = entries(providerNameToDisplayNameMap);
		providerNames.forEach(p => {
			// Only add CMS provider if explicitly called from CMS extension
			// otherwise avoid duplicate listing in dropdown
			if (p[0] !== Constants.cmsProviderName) {
				uniqueProvidersMap[p[0]] = p[1];
			} else {
				if (providerNames.length === 1) {
					uniqueProvidersMap[p[0]] = p[1];
				}
			}
		});

		return uniqueProvidersMap;
	}

	/**
	 * Loads the  password and try to connect. If fails, shows the dialog so user can change the connection
	 * @param Connection Profile
	 * @param owner of the connection. Can be the editors
	 * @param options to use after the connection is complete
	 */
	private tryConnect(connection: interfaces.IConnectionProfile, owner: IConnectableInput, options?: IConnectionCompletionOptions): Promise<IConnectionResult> {
		// Load the password if it's not already loaded
		return this._connectionStore.addSavedPassword(connection).then(async result => {
			let newConnection = result.profile;
			let foundPassword = result.savedCred;

			// If there is no password, try to load it from an existing connection
			if (!foundPassword && this._connectionStore.isPasswordRequired(newConnection)) {
				let existingConnection = this._connectionStatusManager.findConnectionProfile(connection);
				if (existingConnection && existingConnection.connectionProfile) {
					newConnection.password = existingConnection.connectionProfile.password;
					foundPassword = true;
				}
			}

			// Fill in the Azure account token if needed and open the connection dialog if it fails
			let tokenFillSuccess = await this.fillInOrClearAzureToken(newConnection);

			// If the password is required and still not loaded show the dialog
			if ((!foundPassword && this._connectionStore.isPasswordRequired(newConnection) && !newConnection.password) || !tokenFillSuccess) {
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

	/**
	 * If showing the dialog on error is set to true in the options, shows the dialog with the error
	 * otherwise does nothing
	 */
	private showConnectionDialogOnError(
		connection: interfaces.IConnectionProfile,
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

	/**
	 * Load the password and opens a new connection
	 * @param Connection Profile
	 * @param uri assigned to the profile (used only when connecting from an editor)
	 * @param options to be used after the connection is completed
	 * @param callbacks to call after the connection is completed
	 */
	public connect(connection: interfaces.IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		if (!uri) {
			uri = Utils.generateUri(connection);
		}
		let input: IConnectableInput = options && options.params ? options.params.input : undefined;
		if (!input) {
			input = {
				onConnectReject: callbacks ? callbacks.onConnectReject : undefined,
				onConnectStart: callbacks ? callbacks.onConnectStart : undefined,
				onConnectSuccess: callbacks ? callbacks.onConnectSuccess : undefined,
				onDisconnect: callbacks ? callbacks.onDisconnect : undefined,
				onConnectCanceled: callbacks ? callbacks.onConnectCanceled : undefined,
				uri: uri
			};
		}


		if (uri !== input.uri) {
			//TODO: this should never happen. If the input is already passed, it should have the uri
			this._logService.warn(`the given uri is different that the input uri. ${uri}|${input.uri}`);
		}
		return this.tryConnect(connection, input, options);
	}

	/**
	 * If there's already a connection for given profile and purpose, returns the ownerUri for the connection
	 * otherwise tries to make a connection and returns the owner uri when connection is complete
	 * The purpose is connection by default
	 */
	public connectIfNotConnected(connection: interfaces.IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection' | 'notebook', saveConnection: boolean = false): Promise<string> {
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

	/**
	 * Opens a new connection and saves the profile in the settings.
	 * This method doesn't load the password because it only gets called from the
	 * connection dialog and password should be already in the profile
	 */
	public connectAndSaveProfile(connection: interfaces.IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks):
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

	private async connectWithOptions(connection: interfaces.IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		connection.options['groupId'] = connection.groupId;
		connection.options['databaseDisplayName'] = connection.databaseName;

		let isEdit = options?.params?.isEditConnection ?? false;

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
				if (options.saveTheConnection || isEdit) {
					let matcher: interfaces.ProfileMatcher;
					if (isEdit) {
						matcher = (a: interfaces.IConnectionProfile, b: interfaces.IConnectionProfile) => {
							return a.id === b.id;
						};
					}

					await this.saveToSettings(uri, connection, matcher).then(value => {
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

	private handleConnectionError(connection: interfaces.IConnectionProfile, uri: string, options: IConnectionCompletionOptions, callbacks: IConnectionCallbacks, connectionResult: IConnectionResult) {
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

	private handleFirewallRuleError(connection: interfaces.IConnectionProfile, connectionResult: IConnectionResult): Promise<boolean> {
		return this._resourceProviderService.handleFirewallRule(connectionResult.errorCode, connectionResult.errorMessage, connection.providerName).then(response => {
			if (response.canHandleFirewallRule) {
				connectionResult.errorHandled = true;
				return this._resourceProviderService.showFirewallRuleDialog(connection, response.ipAddress, response.resourceProviderId);
			} else {
				return false;
			}
		});
	}

	private doActionsAfterConnectionComplete(uri: string, options: IConnectionCompletionOptions): void {
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
			let profile: interfaces.IConnectionProfile = connectionProfile.toIConnectionProfile();
			iconProvider.getConnectionIconId(profile, serverInfo).then(iconId => {
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

	public showDashboard(connection: interfaces.IConnectionProfile): Thenable<boolean> {
		return this.showDashboardForConnectionManagementInfo(connection);
	}

	private showDashboardForConnectionManagementInfo(connectionProfile: interfaces.IConnectionProfile): Thenable<boolean> {
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

	private focusDashboard(profile: interfaces.IConnectionProfile): boolean {
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

	public getConnectionGroups(providers?: string[]): ConnectionProfileGroup[] {
		return this._connectionStore.getConnectionProfileGroups(false, providers);
	}

	public getRecentConnections(providers?: string[]): ConnectionProfile[] {
		return this._connectionStore.getRecentlyUsedConnections(providers);
	}


	public clearRecentConnectionsList(): void {
		return this._connectionStore.clearRecentlyUsed();
	}

	public clearRecentConnection(connectionProfile: interfaces.IConnectionProfile): void {
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
		this._telemetryService.sendActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.AddServerGroup);
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
		const groups: ConnectionProfileGroup[] = this.getConnectionGroups();
		const hasRegisteredServers: boolean = this.doHasRegisteredServers(groups);
		groups.forEach(cpg => cpg.dispose());
		return hasRegisteredServers;
	}

	private doHasRegisteredServers(root: ConnectionProfileGroup[]): boolean {

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

	public getConnectionUri(connectionProfile: interfaces.IConnectionProfile): string {
		return this._connectionStatusManager.getOriginalOwnerUri(Utils.generateUri(connectionProfile));
	}

	/**
	 * Returns a formatted URI in case the database field is empty for the original
	 * URI, which happens when the connected database is master or the default database
	 */
	public getFormattedUri(uri: string, connectionProfile: interfaces.IConnectionProfile): string {
		if (this._connectionStatusManager.isDefaultTypeUri(uri)) {
			return this.getConnectionUri(connectionProfile);
		} else {
			return uri;
		}
	}

	/**
	 * Sends a notification that the language flavor for a given URI has changed.
	 * For SQL, this would be the specific SQL implementation being used.
	 *
	 * @param uri the URI of the resource whose language has changed
	 * @param language the base language
	 * @param flavor the specific language flavor that's been set
	 * @throws {Error} if the provider is not in the list of registered providers
	 */
	public doChangeLanguageFlavor(uri: string, language: string, provider: string): void {
		if (this._providers.has(provider)) {
			this._uriToProvider[uri] = provider;
			this._onLanguageFlavorChanged.fire({
				uri: uri,
				language: language,
				flavor: provider
			});
		} else {
			throw new Error(`provider "${provider}" is not registered`);
		}
	}

	/**
	 * Ensures that a default language flavor is set for a URI, if none has already been defined.
	 * @param uri document identifier
	 */
	public ensureDefaultLanguageFlavor(uri: string): void {
		if (this.getProviderIdFromUri(uri) === '') {
			// Lookup the default settings and use this
			let defaultProvider = this.getDefaultProviderId();
			if (defaultProvider) {
				this.doChangeLanguageFlavor(uri, 'sql', defaultProvider);
			}
		}
	}

	public getDefaultProviderId(): string {
		let defaultProvider = WorkbenchUtils.getSqlConfigValue<string>(this._configurationService, Constants.defaultEngine);
		return defaultProvider && this._providers.has(defaultProvider) ? defaultProvider : undefined;
	}

	/**
	 * Previously, the only resource available for AAD access tokens was for Azure SQL / SQL Server.
	 * Use that as a default if the provider extension does not configure a different one. If one is
	 * configured, then use it.
	 * @param connection The connection to fill in or update
	 */
	private getAzureResourceForConnection(connection: interfaces.IConnectionProfile): azdata.AzureResource {
		let provider = this._providers.get(connection.providerName);
		if (!provider || !provider.properties || !provider.properties.azureResource) {
			return AzureResource.Sql;
		}

		let result = find(ConnectionManagementService._azureResources, r => AzureResource[r] === provider.properties.azureResource);
		return result ? result : AzureResource.Sql;
	}

	/**
	 * Fills in the Azure account token if it's needed for this connection and doesn't already have one
	 * and clears it if it isn't.
	 * @param connection The connection to fill in or update
	 */
	private async fillInOrClearAzureToken(connection: interfaces.IConnectionProfile): Promise<boolean> {
		if (connection.authenticationType !== Constants.azureMFA && connection.authenticationType !== Constants.azureMFAAndUser) {
			connection.options['azureAccountToken'] = undefined;
			return true;
		}
		let azureResource = this.getAzureResourceForConnection(connection);
		const accounts = await this._accountManagementService.getAccounts();
		const azureAccounts = accounts.filter(a => a.key.providerId.startsWith('azure'));
		if (azureAccounts && azureAccounts.length > 0) {
			let accountId = (connection.authenticationType === Constants.azureMFA || connection.authenticationType === Constants.azureMFAAndUser) ? connection.azureAccount : connection.userName;
			let account = find(azureAccounts, account => account.key.accountId === accountId);
			if (account) {
				this._logService.debug(`Getting security token for Azure account ${account.key.accountId}`);
				if (account.isStale) {
					this._logService.debug(`Account is stale - refreshing`);
					try {
						account = await this._accountManagementService.refreshAccount(account);
					} catch (err) {
						this._logService.info(`Exception refreshing stale account : ${toErrorMessage(err, true)}`);
						// refreshAccount throws an error if the user cancels the dialog
						return false;
					}
				}
				const tenantId = connection.azureTenantId;
				const token = await this._accountManagementService.getAccountSecurityToken(account, tenantId, azureResource);
				this._logService.debug(`Got token for tenant ${token}`);
				if (!token) {
					this._logService.info(`No security tokens found for account`);
				}
				connection.options['azureAccountToken'] = token.token;
				connection.options['password'] = '';
				return true;
			} else {
				this._logService.info(`Could not find Azure account with name ${accountId}`);
			}
		} else {
			this._logService.info(`Could not find any Azure accounts from accounts : [${accounts.map(a => `${a.key.accountId} (${a.key.providerId})`).join(',')}]`);
		}
		return false;
	}

	// Request Senders
	private async sendConnectRequest(connection: interfaces.IConnectionProfile, uri: string): Promise<boolean> {
		let connectionInfo = assign({}, {
			options: connection.options
		});

		await this.extensionService.activateByEvent(`onConnect:${connection.providerName}`);

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


	private async saveToSettings(id: string, connection: interfaces.IConnectionProfile, matcher?: interfaces.ProfileMatcher): Promise<string> {
		const savedProfile = await this._connectionStore.saveProfile(connection, undefined, matcher);
		return this._connectionStatusManager.updateConnectionProfile(savedProfile, id);
	}

	/**
	 * Add a connection to the active connections list.
	 */
	private tryAddActiveConnection(connectionManagementInfo: ConnectionManagementInfo, newConnection: interfaces.IConnectionProfile, addToMru: boolean): void {
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
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.DatabaseConnected)
			.withAdditionalProperties({
				connectionType: connection.serverInfo ? (connection.serverInfo.isCloud ? 'Azure' : 'Standalone') : '',
				provider: connection.connectionProfile.providerName,
				serverVersion: connection.serverInfo ? connection.serverInfo.serverVersion : '',
				serverEdition: connection.serverInfo ? connection.serverInfo.serverEdition : '',
				serverEngineEdition: connection.serverInfo ? connection.serverInfo.engineEditionId : '',
				isBigDataCluster: connection.serverInfo?.options?.isBigDataCluster ?? false,
				extensionConnectionTime: connection.extensionTimer.elapsed() - connection.serviceTimer.elapsed(),
				serviceConnectionTime: connection.serviceTimer.elapsed()
			})
			.send();
	}

	private addTelemetryForConnectionDisconnected(connection: interfaces.IConnectionProfile): void {
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.DatabaseDisconnected)
			.withAdditionalProperties({
				provider: connection.providerName
			})
			.send();
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
		let profile: interfaces.IConnectionProfile = this._connectionStatusManager.onConnectionChanged(changedConnInfo);
		this._notifyConnectionChanged(profile, changedConnInfo.connectionUri);
	}

	private _notifyConnectionChanged(profile: interfaces.IConnectionProfile, connectionUri: string): void {
		if (profile) {
			this._onConnectionChanged.fire(<IConnectionParams>{
				connectionProfile: profile,
				connectionUri: connectionUri
			});
		}
	}

	public onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
	}

	public changeGroupIdForConnectionGroup(source: ConnectionProfileGroup, target: ConnectionProfileGroup): Promise<void> {
		this._telemetryService.sendActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.MoveServerConnection);
		return this._connectionStore.changeGroupIdForConnectionGroup(source, target);
	}

	public changeGroupIdForConnection(source: ConnectionProfile, targetGroupId: string): Promise<void> {
		let id = Utils.generateUri(source);
		this._telemetryService.sendActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.MoveServerGroup);
		return this._connectionStore.changeGroupIdForConnection(source, targetGroupId).then(result => {
			if (id && targetGroupId) {
				source.groupId = targetGroupId;
			}
		});
	}

	/**
	 * Returns true if the connection can be moved to another group
	 */
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

	/**
	 * Functions to handle the connecting life cycle
	 */

	// Connect an open URI to a connection profile
	private createNewConnection(uri: string, connection: interfaces.IConnectionProfile): Promise<IConnectionResult> {
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
						if (connectionMngInfo.serverInfo) {
							connection.options.isCloud = connectionMngInfo.serverInfo.isCloud;
						}
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

	private doDisconnect(fileUri: string, connection?: interfaces.IConnectionProfile): Promise<boolean> {
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

	public disconnect(connection: interfaces.IConnectionProfile): Promise<void>;
	public disconnect(ownerUri: string): Promise<void>;
	public disconnect(input: string | interfaces.IConnectionProfile): Promise<void> {
		let uri: string;
		let profile: interfaces.IConnectionProfile;
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

	public cancelConnection(connection: interfaces.IConnectionProfile): Thenable<boolean> {
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

	/**
	 * Finds existing connection for given profile and purpose is any exists.
	 * The purpose is connection by default
	 */
	public findExistingConnection(connection: interfaces.IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection' | 'notebook'): ConnectionProfile {
		let connectionUri = Utils.generateUri(connection, purpose);
		let existingConnection = this._connectionStatusManager.findConnection(connectionUri);
		if (existingConnection && this._connectionStatusManager.isConnected(connectionUri)) {
			return existingConnection.connectionProfile;
		} else {
			return undefined;
		}
	}

	public isProfileConnected(connectionProfile: interfaces.IConnectionProfile): boolean {
		let connectionManagement = this._connectionStatusManager.findConnectionProfile(connectionProfile);
		return connectionManagement && !connectionManagement.connecting;
	}

	public isProfileConnecting(connectionProfile: interfaces.IConnectionProfile): boolean {
		let connectionManagement = this._connectionStatusManager.findConnectionProfile(connectionProfile);
		return connectionManagement && connectionManagement.connecting;
	}

	private isConnecting(fileUri: string): boolean {
		return this._connectionStatusManager.isConnecting(fileUri);
	}

	public getConnectionProfile(fileUri: string): interfaces.IConnectionProfile {
		return this._connectionStatusManager.isConnected(fileUri) ? this._connectionStatusManager.getConnectionProfile(fileUri) : undefined;
	}

	public getConnectionInfo(fileUri: string): ConnectionManagementInfo {
		return this._connectionStatusManager.isConnected(fileUri) ? this._connectionStatusManager.findConnection(fileUri) : undefined;
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

	public editGroup(group: ConnectionProfileGroup): Promise<void> {
		return this._connectionStore.editGroup(group).then(groupId => {
			this._onAddConnectionProfile.fire(undefined);
		});
	}

	/**
	 * Deletes a connection from registered servers.
	 * Disconnects a connection before removing from settings.
	 */
	public deleteConnection(connection: ConnectionProfile): Promise<boolean> {
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.DeleteConnection)
			.withAdditionalProperties({
				provider: connection.providerName
			}).send();
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

	/**
	 * Deletes a group with all its children groups and connections from registered servers.
	 * Disconnects a connection before removing from config. If disconnect fails, settings is not modified.
	 */
	public deleteConnectionGroup(group: ConnectionProfileGroup): Promise<boolean> {
		this._telemetryService.sendActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.DeleteServerGroup);
		// Get all connections for this group
		let connections = ConnectionProfileGroup.getConnectionsInGroup(group);

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

	private _notifyDisconnected(connectionProfile: interfaces.IConnectionProfile, connectionUri: string): void {
		this._onDisconnect.fire(<IConnectionParams>{
			connectionUri: connectionUri,
			connectionProfile: connectionProfile
		});
	}

	/**
	 * Rebuild the IntelliSense cache for the connection with the given URI
	 */
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
		if (this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').tabColorMode === 'off') {
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

	public removeConnectionProfileCredentials(originalProfile: interfaces.IConnectionProfile): interfaces.IConnectionProfile {
		return this._connectionStore.getProfileWithoutPassword(originalProfile);
	}

	public async getConnectionCredentials(profileId: string): Promise<{ [name: string]: string }> {
		let profile = find(this.getActiveConnections(), connectionProfile => connectionProfile.id === profileId);
		if (!profile) {
			// Couldn't find an active profile so try all profiles now - fetching the password if we found one
			profile = find(this.getConnections(), connectionProfile => connectionProfile.id === profileId);
			if (!profile) {
				return undefined;
			}
			await this.addSavedPassword(profile);
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

	public getConnectionProfileById(profileId: string): interfaces.IConnectionProfile {
		let profile = this._connectionStatusManager.findConnectionByProfileId(profileId);
		if (!profile) {
			return undefined;
		}
		return profile.connectionProfile;
	}

	/**
	 * Get the connection string for the provided connection ID
	 */
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

	/**
	 * Serialize connection with options provider
	 * TODO this could be a map reduce operation
	 */
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

	/**
	 * Get known connection profiles including active connections, recent connections and saved connections.
	 * @param activeConnectionsOnly Indicates whether only get the active connections, default value is false.
	 * @returns array of connections
	 **/
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

	private getConnectionsInGroup(group: ConnectionProfileGroup): ConnectionProfile[] {
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
	}
}
