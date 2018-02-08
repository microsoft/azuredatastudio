/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import {
	IConnectionManagementService, IConnectionDialogService, INewConnectionParams,
	ConnectionType, IConnectableInput, IConnectionCompletionOptions, IConnectionCallbacks,
	IConnectionParams, IConnectionResult, IServerGroupController, IServerGroupDialogCallbacks,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import { ConnectionStore } from 'sql/parts/connection/common/connectionStore';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import * as Utils from 'sql/parts/connection/common/utils';
import * as Constants from 'sql/parts/connection/common/constants';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { ICredentialsService } from 'sql/services/credentials/credentialsService';
import * as ConnectionContracts from 'sql/parts/connection/common/connection';
import { ConnectionStatusManager } from 'sql/parts/connection/common/connectionStatusManager';
import { DashboardInput } from 'sql/parts/dashboard/dashboardInput';
import { ConnectionGlobalStatus } from 'sql/parts/connection/common/connectionGlobalStatus';
import { ConnectionStatusbarItem } from 'sql/parts/connection/common/connectionStatus';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { warn } from 'sql/base/common/log';
import { IResourceProviderService } from 'sql/parts/accountManagement/common/interfaces';
import { IAngularEventingService, AngularEventType } from 'sql/services/angularEventing/angularEventingService';
import * as QueryConstants from 'sql/parts/query/common/constants';

import * as data from 'data';

import * as nls from 'vs/nls';
import * as errors from 'vs/base/common/errors';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as platform from 'vs/platform/registry/common/platform';
import { Memento } from 'vs/workbench/common/memento';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ConnectionProfileGroup, IConnectionProfileGroup } from './connectionProfileGroup';
import { ConfigurationEditingService } from 'vs/workbench/services/configuration/node/configurationEditingService';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { IQuickOpenService } from 'vs/platform/quickOpen/common/quickOpen';
import Event, { Emitter } from 'vs/base/common/event';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { EditorGroup } from 'vs/workbench/common/editor/editorStacksModel';
import { EditorPart } from 'vs/workbench/browser/parts/editor/editorPart';
import * as statusbar from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IStatusbarService } from 'vs/platform/statusbar/common/statusbar';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { Deferred } from 'sql/base/common/promise';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';

export class ConnectionManagementService implements IConnectionManagementService {

	_serviceBrand: any;

	private disposables: IDisposable[] = [];

	private _providers: { [handle: string]: data.ConnectionProvider; } = Object.create(null);

	private _uriToProvider: { [uri: string]: string; } = Object.create(null);

	private _connectionStatusManager: ConnectionStatusManager;

	private _onAddConnectionProfile: Emitter<IConnectionProfile>;
	private _onDeleteConnectionProfile: Emitter<void>;
	private _onConnect: Emitter<IConnectionParams>;
	private _onDisconnect: Emitter<IConnectionParams>;
	private _onConnectRequestSent: Emitter<void>;
	private _onConnectionChanged: Emitter<IConnectionParams>;
	private _onLanguageFlavorChanged: Emitter<data.DidChangeLanguageFlavorParams>;

	private _connectionGlobalStatus: ConnectionGlobalStatus;

	private _configurationEditService: ConfigurationEditingService;

	constructor(
		private _connectionMemento: Memento,
		private _connectionStore: ConnectionStore,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@IServerGroupController private _serverGroupController: IServerGroupController,
		@ICommandService private _commandService: ICommandService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService,
		@IWorkspaceContextService private _contextService: IWorkspaceContextService,
		@IStorageService private _storageService: IStorageService,
		@ITelemetryService private _telemetryService: ITelemetryService,
		@IWorkspaceConfigurationService private _workspaceConfigurationService: IWorkspaceConfigurationService,
		@ICredentialsService private _credentialsService: ICredentialsService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IQuickOpenService private _quickOpenService: IQuickOpenService,
		@IEditorGroupService private _editorGroupService: IEditorGroupService,
		@IStatusbarService private _statusBarService: IStatusbarService,
		@IResourceProviderService private _resourceProviderService: IResourceProviderService,
		@IViewletService private _viewletService: IViewletService,
		@IAngularEventingService private _angularEventing: IAngularEventingService
	) {
		if (this._instantiationService) {
			this._configurationEditService = this._instantiationService.createInstance(ConfigurationEditingService);
		}

		// _connectionMemento and _connectionStore are in constructor to enable this class to be more testable
		if (!this._connectionMemento) {
			this._connectionMemento = new Memento('ConnectionManagement');
		}
		if (!this._connectionStore) {
			this._connectionStore = new ConnectionStore(_storageService, this._connectionMemento,
				this._configurationEditService, this._workspaceConfigurationService, this._credentialsService, this._capabilitiesService);
		}

		this._connectionStatusManager = new ConnectionStatusManager(this._capabilitiesService);
		this._connectionGlobalStatus = new ConnectionGlobalStatus(this._statusBarService);

		// Setting up our event emitters
		this._onAddConnectionProfile = new Emitter<IConnectionProfile>();
		this._onDeleteConnectionProfile = new Emitter<void>();
		this._onConnect = new Emitter<IConnectionParams>();
		this._onDisconnect = new Emitter<IConnectionParams>();
		this._onConnectionChanged = new Emitter<IConnectionParams>();
		this._onConnectRequestSent = new Emitter<void>();
		this._onLanguageFlavorChanged = new Emitter<data.DidChangeLanguageFlavorParams>();

		this._onProvidersReady = new Deferred();

		// Register Statusbar item
		(<statusbar.IStatusbarRegistry>platform.Registry.as(statusbar.Extensions.Statusbar)).registerStatusbarItem(new statusbar.StatusbarItemDescriptor(
			ConnectionStatusbarItem,
			statusbar.StatusbarAlignment.RIGHT,
			100 /* High Priority */
		));

		if (_capabilitiesService && _capabilitiesService.onProviderRegisteredEvent) {
			_capabilitiesService.onProviderRegisteredEvent((capabilities => {
				if (capabilities.providerName === 'MSSQL') {
					if (!this.hasRegisteredServers()) {
						// prompt the user for a new connection on startup if no profiles are registered
						this.showConnectionDialog();
					}
				}
			}));
		}

		this.disposables.push(this._onAddConnectionProfile);
		this.disposables.push(this._onDeleteConnectionProfile);

		// Refresh editor titles when connections start/end/change to ensure tabs are colored correctly
		this.onConnectionChanged(() => this.refreshEditorTitles());
		this.onConnect(() => this.refreshEditorTitles());
		this.onDisconnect(() => this.refreshEditorTitles());
	}

	// Event Emitters
	public get onAddConnectionProfile(): Event<IConnectionProfile> {
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

	public get onLanguageFlavorChanged(): Event<data.DidChangeLanguageFlavorParams> {
		return this._onLanguageFlavorChanged.event;
	}

	private _onProvidersReady: Deferred<void>;

	private onProvidersReady(): Promise<void> {
		return this._onProvidersReady.promise;
	}

	private _providerCount: number = 0;

	// Connection Provider Registration
	public registerProvider(providerId: string, provider: data.ConnectionProvider): void {
		this._providers[providerId] = provider;

		// temporarily close splash screen when a connection provider has been registered
		// @todo remove this code once a proper initialization event is available (karlb 4/1/2017)
		++this._providerCount;

		this._onProvidersReady.resolve();

		if (this._providerCount === 1) {
			// show the Registered Server viewlet
			let startupConfig = this._workspaceConfigurationService.getValue('startup');
			if (startupConfig) {
				let showServerViewlet = <boolean>startupConfig['alwaysShowServersView'];
				if (showServerViewlet) {
					// only show the Servers viewlet if there isn't another active viewlet
					if (!this._viewletService.getActiveViewlet()) {
						this._commandService.executeCommand('workbench.view.connections', {});
					}
				}
			}
		}
	}

	/**
	 * Opens the connection dialog
	 * @param params Include the uri, type of connection
	 * @param model the existing connection profile to create a new one from
	 */
	public showConnectionDialog(params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult): Promise<void> {
		let self = this;
		return new Promise<void>((resolve, reject) => {
			if (!params) {
				params = { connectionType: ConnectionType.default };
			}
			if (!model && params.input && params.input.uri) {
				model = this._connectionStatusManager.getConnectionProfile(params.input.uri);
			}
			self._connectionDialogService.showDialog(self, params, model, connectionResult).then(() => {
				resolve();
			}, dialogError => {
				warn('failed to open the connection dialog. error: ' + dialogError);
				reject(dialogError);
			});
		});
	}

	/**
	 * Opens the add server group dialog
	 */
	public showCreateServerGroupDialog(callbacks?: IServerGroupDialogCallbacks): Promise<void> {
		let self = this;
		return new Promise<void>((resolve, reject) => {
			self._serverGroupController.showCreateGroupDialog(self, callbacks).then(() => {
				resolve();
			}, error => {
				reject();
			});
		});
	}

	/**
	 * Opens the edit server group dialog
	 */
	public showEditServerGroupDialog(group: ConnectionProfileGroup): Promise<void> {
		let self = this;
		return new Promise<void>((resolve, reject) => {
			self._serverGroupController.showEditGroupDialog(self, group).then(() => {
				resolve();
			}, error => {
				reject();
			});
		});
	}

	/**
	 * Load the password for the profile
	 * @param connectionProfile Connection Profile
	 */
	public addSavedPassword(connectionProfile: IConnectionProfile): Promise<IConnectionProfile> {
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
	 * Loads the  password and try to connect. If fails, shows the dialog so user can change the connection
	 * @param Connection Profile
	 * @param owner of the connection. Can be the editors
	 * @param options to use after the connection is complete
	 */
	private tryConnect(connection: IConnectionProfile, owner: IConnectableInput, options?: IConnectionCompletionOptions): Promise<IConnectionResult> {
		return new Promise<IConnectionResult>((resolve, reject) => {
			// Load the password if it's not already loaded
			this._connectionStore.addSavedPassword(connection).then(result => {
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
				// If the password is required and still not loaded show the dialog
				if (!foundPassword && this._connectionStore.isPasswordRequired(newConnection) && !newConnection.password) {
					resolve(this.showConnectionDialogOnError(connection, owner, { connected: false, errorMessage: undefined, callStack: undefined, errorCode: undefined }, options));
				} else {
					// Try to connect
					this.connectWithOptions(newConnection, owner.uri, options, owner).then(connectionResult => {
						if (!connectionResult.connected && !connectionResult.errorHandled) {
							// If connection fails show the dialog
							resolve(this.showConnectionDialogOnError(connection, owner, connectionResult, options));
						} else {
							//Resolve with the connection result
							resolve(connectionResult);
						}
					}).catch(connectionError => {
						reject(connectionError);
					});
				}
			}).catch(err => {
				reject(err);
			});
		});
	}

	/**
	 * If showing the dialog on error is set to true in the options, shows the dialog with the error
	 * otherwise does nothing
	 */
	private showConnectionDialogOnError(
		connection: IConnectionProfile,
		owner: IConnectableInput,
		connectionResult: IConnectionResult,
		options?: IConnectionCompletionOptions): Promise<IConnectionResult> {

		return new Promise<IConnectionResult>((resolve, reject) => {
			if (options && options.showConnectionDialogOnError) {
				let params: INewConnectionParams = options && options.params ? options.params : {
					connectionType: this._connectionStatusManager.isDefaultTypeUri(owner.uri) ? ConnectionType.default : ConnectionType.editor,
					input: owner,
					runQueryOnCompletion: RunQueryOnConnectionMode.none,
					showDashboard: options.showDashboard
				};
				this.showConnectionDialog(params, connection, connectionResult).then(() => {
					resolve(connectionResult);
				}).catch(err => {
					reject(err);
				});
			} else {
				resolve(connectionResult);
			}
		});
	}

	/**
	 * Load the password and opens a new connection
	 * @param Connection Profile
	 * @param uri assigned to the profile (used only when connecting from an editor)
	 * @param options to be used after the connection is completed
	 * @param callbacks to call after the connection is completed
	 */
	public connect(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
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
				uri: uri
			};
		}


		if (uri !== input.uri) {
			//TODO: this should never happen. If the input is already passed, it should have the uri
			warn(`the given uri is different that the input uri. ${uri}|${input.uri}`);
		}
		return this.tryConnect(connection, input, options);
	}

	/**
	 * If there's already a connection for given profile and purpose, returns the ownerUri for the connection
	 * otherwise tries to make a connection and returns the owner uri when connection is complete
	 * The purpose is connection by default
	 */
	public connectIfNotConnected(connection: IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection'): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let ownerUri: string = Utils.generateUri(connection, purpose);
			if (this._connectionStatusManager.isConnected(ownerUri)) {
				resolve(this._connectionStatusManager.getOriginalOwnerUri(ownerUri));
			} else {
				this.connect(connection, ownerUri).then(connectionResult => {
					if (connectionResult && connectionResult.connected) {
						resolve(this._connectionStatusManager.getOriginalOwnerUri(ownerUri));
					} else {
						reject(connectionResult.errorMessage);
					}
				}, error => {
					reject(error);
				});
			}
		});
	}

	/**
	 * Opens a new connection and saves the profile in the settings.
	 * This method doesn't load the password because it only gets called from the
	 * connection dialog and password should be already in the profile
	 */
	public connectAndSaveProfile(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks):
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

	private connectWithOptions(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks):
		Promise<IConnectionResult> {
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
				onDisconnect: () => { }
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
		return new Promise<IConnectionResult>((resolve, reject) => {
			if (callbacks.onConnectStart) {
				callbacks.onConnectStart();
			}
			this.createNewConnection(uri, connection).then(connectionResult => {
				if (connectionResult && connectionResult.connected) {
					if (callbacks.onConnectSuccess) {
						callbacks.onConnectSuccess(options.params);
					}
					if (options.saveTheConnection) {
						this.saveToSettings(uri, connection).then(value => {
							this._onAddConnectionProfile.fire(connection);
							this.doActionsAfterConnectionComplete(value, options);
						});
					} else {
						connection.saveProfile = false;
						this.doActionsAfterConnectionComplete(uri, options);
					}
					resolve(connectionResult);
				} else if (connectionResult && connectionResult.errorMessage) {
					this.handleConnectionError(connection, uri, options, callbacks, connectionResult).then(result => {
						resolve(result);
					}).catch(handleConnectionError => {
						if (callbacks.onConnectReject) {
							callbacks.onConnectReject(handleConnectionError);
						}
						reject(handleConnectionError);
					});
				} else {
					if (callbacks.onConnectReject) {
						callbacks.onConnectReject(nls.localize('connectionNotAcceptedError', 'Connection Not Accepted'));
					}
					resolve(connectionResult);
				}
			}).catch(err => {
				if (callbacks.onConnectReject) {
					callbacks.onConnectReject(err);
				}
				reject(err);
			});
		});
	}

	private handleConnectionError(connection: IConnectionProfile, uri: string, options: IConnectionCompletionOptions, callbacks: IConnectionCallbacks, connectionResult: IConnectionResult) {
		return new Promise<IConnectionResult>((resolve, reject) => {
			let connectionNotAcceptedError = nls.localize('connectionNotAcceptedError', 'Connection Not Accepted');
			if (options.showFirewallRuleOnError && connectionResult.errorCode) {
				this.handleFirewallRuleError(connection, connectionResult).then(success => {
					if (success) {
						options.showFirewallRuleOnError = false;
						this.connectWithOptions(connection, uri, options, callbacks).then((result) => {
							resolve(result);
						}).catch(connectionError => {
							reject(connectionError);
						});
					} else {
						if (callbacks.onConnectReject) {
							callbacks.onConnectReject(connectionNotAcceptedError);
						}
						resolve(connectionResult);
					}
				}).catch(handleFirewallRuleError => {
					reject(handleFirewallRuleError);
				});
			} else {
				if (callbacks.onConnectReject) {
					callbacks.onConnectReject(connectionNotAcceptedError);
				}
				resolve(connectionResult);
			}
		});
	}

	private handleFirewallRuleError(connection: IConnectionProfile, connectionResult: IConnectionResult): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this._resourceProviderService.handleFirewallRule(connectionResult.errorCode, connectionResult.errorMessage, connection.providerName).then(response => {
				if (response.canHandleFirewallRule) {
					connectionResult.errorHandled = true;
					this._resourceProviderService.showFirewallRuleDialog(connection, response.ipAddress, response.resourceProviderId).then(success => {
						resolve(success);
					}).catch(showFirewallRuleError => {
						reject(showFirewallRuleError);
					});
				} else {
					resolve(false);
				}
			}).catch(handleFirewallRuleError => {
				reject(handleFirewallRuleError);
			});
		});
	}

	private doActionsAfterConnectionComplete(uri: string, options: IConnectionCompletionOptions, ) {
		let connectionManagementInfo = this._connectionStatusManager.findConnection(uri);
		if (options.showDashboard) {
			this.showDashboardForConnectionManagementInfo(connectionManagementInfo.connectionProfile);
		}
		this._onConnect.fire(<IConnectionParams>{
			connectionUri: uri,
			connectionProfile: connectionManagementInfo.connectionProfile
		});
	}

	public showDashboard(connection: ConnectionProfile): Thenable<boolean> {
		return this.showDashboardForConnectionManagementInfo(connection);
	}

	private showDashboardForConnectionManagementInfo(connectionProfile: IConnectionProfile): Thenable<boolean> {
		// if dashboard profile is already open, focus on that tab
		if (!this.focusDashboard(connectionProfile)) {
			let dashboardInput: DashboardInput = this._instantiationService ? this._instantiationService.createInstance(DashboardInput, connectionProfile) : undefined;
			return dashboardInput.initializedPromise.then(() => {
				this._editorService.openEditor(dashboardInput, { pinned: true }, false);
			}).then(() => true);
		} else {
			return Promise.resolve(true);
		}
	}

	private focusDashboard(profile: IConnectionProfile): boolean {
		let found: boolean = false;
		let options = {
			preserveFocus: false,
			revealIfVisible: true,
			revealInCenterIfOutsideViewport: true,
			pinned: true
		};
		let model = this._editorGroupService.getStacksModel();
		// check if editor is already present
		if (model) {
			model.groups.map(group => {
				if (group instanceof EditorGroup) {
					group.getEditors().map(editor => {
						if (editor instanceof DashboardInput) {
							if (DashboardInput.profileMatches(profile, editor.connectionProfile)) {
								editor.connectionProfile.databaseName = profile.databaseName;
								// change focus to the matched editor
								let position = model.positionOfGroup(group);
								this._editorGroupService.activateGroup(model.groupAt(position));
								this._editorService.openEditor(editor, options, position)
									.done(() => {
										this._editorGroupService.activateGroup(model.groupAt(position));
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
				}
			});
		}
		return found;
	}

	public closeDashboard(uri: string): void {
		let model = this._editorGroupService.getStacksModel();
		if (model) {
			model.groups.map(group => {
				if (group instanceof EditorGroup) {
					group.getEditors().map(editor => {
						if (editor instanceof DashboardInput) {
							if (editor.uri === uri && this._editorGroupService instanceof EditorPart) {
								// close matched editor
								let position = model.positionOfGroup(group);
								this._editorGroupService.closeEditor(position, editor);
							}
						}
					});
				}
			});
		}
	}

	public getConnectionGroups(): ConnectionProfileGroup[] {
		return this._connectionStore.getConnectionProfileGroups();
	}

	public getRecentConnections(): ConnectionProfile[] {
		return this._connectionStore.getRecentlyUsedConnections();
	}


	public clearRecentConnectionsList(): void {
		return this._connectionStore.clearRecentlyUsed();
	}

	public clearRecentConnection(connectionProfile: IConnectionProfile) : void {
		this._connectionStore.removeConnectionToMemento(connectionProfile, Constants.recentConnections);
	}

	public getActiveConnections(): ConnectionProfile[] {
		return this._connectionStatusManager.getActiveConnectionProfiles();
	}

	public saveProfileGroup(profile: IConnectionProfileGroup): Promise<string> {
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.AddServerGroup);
		return new Promise<string>((resolve, reject) => {
			this._connectionStore.saveProfileGroup(profile).then(groupId => {
				this._onAddConnectionProfile.fire();
				resolve(groupId);
			}).catch(err => {
				reject(err);
			});
		});
	}

	public getProviderNames(): string[] {
		return Object.keys(this._providers);
	}

	public getCapabilities(providerName: string): data.DataProtocolServerCapabilities {
		let capabilities = this._capabilitiesService.getCapabilities();
		if (capabilities !== undefined && capabilities.length > 0) {
			return capabilities.find(c => c.providerName === providerName);
		}
		return undefined;
	}

	public getAdvancedProperties(): data.ConnectionOption[] {

		let capabilities = this._capabilitiesService.getCapabilities();
		if (capabilities !== undefined && capabilities.length > 0) {
			// just grab the first registered provider for now, this needs to change
			// to lookup based on currently select provider
			let providerCapabilities = capabilities[0];
			if (!!providerCapabilities.connectionProvider) {
				return providerCapabilities.connectionProvider.options;
			}
		}

		return undefined;
	}

	public hasRegisteredServers(): boolean {
		return this.doHasRegisteredServers(this.getConnectionGroups());
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

	public getConnectionId(connectionProfile: IConnectionProfile): string {
		return this._connectionStatusManager.getOriginalOwnerUri(Utils.generateUri(connectionProfile));
	}

	/**
	 * Returns a formatted URI in case the database field is empty for the original
	 * URI, which happens when the connected database is master or the default database
	 * @param uri
	 * @param connectionProfile
	 */
	public getFormattedUri(uri: string, connectionProfile: IConnectionProfile): string {
		if (this._connectionStatusManager.isDefaultTypeUri(uri)) {
			return this.getConnectionId(connectionProfile);
		} else {
			return uri;
		}
	}

	/**
	 * Sends a notification that the language flavor for a given URI has changed.
	 * For SQL, this would be the specific SQL implementation being used.
	 *
	 * @param {string} uri the URI of the resource whose language has changed
	 * @param {string} language the base language
	 * @param {string} flavor the specific language flavor that's been set
	 * @throws {Error} if the provider is not in the list of registered providers
	 * @memberof ConnectionManagementService
	 */
	public doChangeLanguageFlavor(uri: string, language: string, provider: string): void {
		if (provider in this._providers) {
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
	 * @param {string} uri document identifier
	 * @memberof ConnectionManagementService
	 */
	public ensureDefaultLanguageFlavor(uri: string): void {
		if (!this.getProviderIdFromUri(uri)) {
			// Lookup the default settings and use this
			let defaultProvider = WorkbenchUtils.getSqlConfigValue<string>(this._workspaceConfigurationService, Constants.defaultEngine);
			if (defaultProvider && defaultProvider in this._providers) {
				// Only set a default if it's in the list of registered providers
				this.doChangeLanguageFlavor(uri, 'sql', defaultProvider);
			}
		}
	}

	// Request Senders
	private sendConnectRequest(connection: IConnectionProfile, uri: string): Thenable<boolean> {
		let connectionInfo = Object.assign({}, {
			options: connection.options
		});

		// setup URI to provider ID map for connection
		this._uriToProvider[uri] = connection.providerName;

		return new Promise<boolean>((resolve, reject) => {
			this.onProvidersReady().then(() => {
				this._providers[connection.providerName].connect(uri, connectionInfo);
				this._onConnectRequestSent.fire();

				// TODO make this generic enough to handle non-SQL languages too
				this.doChangeLanguageFlavor(uri, 'sql', connection.providerName);
				resolve(true);
			});
		});
	}

	private sendDisconnectRequest(uri: string): Thenable<boolean> {
		let providerId: string = this.getProviderIdFromUri(uri);
		if (!providerId) {
			return Promise.resolve(false);
		}

		return new Promise<boolean>((resolve, reject) => {
			this._providers[providerId].disconnect(uri);
			resolve(true);
		});
	}

	private sendCancelRequest(uri: string): Thenable<boolean> {
		let providerId: string = this.getProviderIdFromUri(uri);
		if (!providerId) {
			return Promise.resolve(false);
		}

		return new Promise<boolean>((resolve, reject) => {
			this._providers[providerId].cancelConnect(uri);
			resolve(true);
		});
	}

	private sendListDatabasesRequest(uri: string): Thenable<data.ListDatabasesResult> {
		let providerId: string = this.getProviderIdFromUri(uri);
		if (!providerId) {
			return Promise.resolve(undefined);
		}

		return new Promise<data.ListDatabasesResult>((resolve, reject) => {
			let provider = this._providers[providerId];
			provider.listDatabases(uri).then(result => {
				if (result && result.databaseNames) {
					result.databaseNames.sort();
				}
				resolve(result);
			}, error => {
				reject(error);
			});
		});
	}

	private saveToSettings(id: string, connection: IConnectionProfile): Promise<string> {

		return new Promise<string>((resolve, reject) => {
			this._connectionStore.saveProfile(connection).then(savedProfile => {
				let newId = this._connectionStatusManager.updateConnectionProfile(savedProfile, id);
				return resolve(newId);
			});
		});
	}

	/**
	 * Add a connection to the active connections list.
	 */
	private tryAddActiveConnection(connectionManagementInfo: ConnectionManagementInfo, newConnection: IConnectionProfile, isConnectionToDefaultDb: boolean): void {
		if (newConnection) {
			this._connectionStore.addActiveConnection(newConnection, isConnectionToDefaultDb)
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
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.DatabaseConnected, {
			connectionType: connection.serverInfo ? (connection.serverInfo.isCloud ? 'Azure' : 'Standalone') : '',
			provider: connection.connectionProfile.providerName,
			serverVersion: connection.serverInfo ? connection.serverInfo.serverVersion : '',
			serverEdition: connection.serverInfo ? connection.serverInfo.serverEdition : '',

			extensionConnectionTime: connection.extensionTimer.elapsed() - connection.serviceTimer.elapsed(),
			serviceConnectionTime: connection.serviceTimer.elapsed()
		});
	}

	private addTelemetryForConnectionDisconnected(connection: IConnectionProfile): void {
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.DatabaseDisconnected, {
			provider: connection.providerName
		});
	}

	public onConnectionComplete(handle: number, info: data.ConnectionInfoSummary): void {
		const self = this;
		let connection = this._connectionStatusManager.onConnectionComplete(info);

		if (info.connectionId) {
			let isConnectionToDefaultDb = false;
			if (connection.connectionProfile && (!connection.connectionProfile.databaseName || connection.connectionProfile.databaseName.trim() === '')) {
				isConnectionToDefaultDb = true;
			}
			if (info.connectionSummary && info.connectionSummary.databaseName) {
				this._connectionStatusManager.updateDatabaseName(info);
			}
			connection.serverInfo = info.serverInfo;
			connection.extensionTimer.stop();

			connection.connectHandler(true);
			let activeConnection = connection.connectionProfile;
			self.tryAddActiveConnection(connection, activeConnection, isConnectionToDefaultDb);
			self.addTelemetryForConnection(connection);

			if (self._connectionStatusManager.isDefaultTypeUri(info.ownerUri)) {
				self._connectionGlobalStatus.setStatusToConnected(info.connectionSummary);
			}
		} else {
			connection.connectHandler(false, info.errorMessage, info.errorNumber, info.messages);
		}
	}

	public onConnectionChangedNotification(handle: number, changedConnInfo: data.ChangedConnectionInfo): void {
		let profile: IConnectionProfile = this._connectionStatusManager.onConnectionChanged(changedConnInfo);
		this._notifyConnectionChanged(profile, changedConnInfo.connectionUri);
	}

	private _notifyConnectionChanged(profile: IConnectionProfile, connectionUri: string): void {
		if (profile) {
			this._onConnectionChanged.fire(<IConnectionParams>{
				connectionProfile: profile,
				connectionUri: connectionUri
			});
		}
	}

	public onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
	}

	public shutdown(): void {
		this._connectionStore.clearActiveConnections();
		this._connectionMemento.saveMemento();
	}

	public changeGroupIdForConnectionGroup(source: ConnectionProfileGroup, target: ConnectionProfileGroup): Promise<void> {
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.MoveServerConnection);
		return this._connectionStore.changeGroupIdForConnectionGroup(source, target);
	}

	public changeGroupIdForConnection(source: ConnectionProfile, targetGroupId: string): Promise<void> {
		let id = Utils.generateUri(source);
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.MoveServerGroup);
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
		const self = this;

		return new Promise<boolean>((resolve, reject) => {
			// If the URI is connected, disconnect it and the editor
			if (self.isConnected(owner.uri)) {
				var connection = self.getConnectionProfile(owner.uri);
				owner.onDisconnect();
				resolve(self.doDisconnect(owner.uri, connection));

				// If the URI is connecting, prompt the user to cancel connecting
			} else if (self.isConnecting(owner.uri)) {
				if (!force) {
					self.shouldCancelConnect(owner.uri).then((result) => {
						// If the user wants to cancel, then disconnect
						if (result) {
							owner.onDisconnect();
							resolve(self.cancelEditorConnection(owner));
						}
						// If the user does not want to cancel, then ignore
						resolve(false);
					});
				} else {
					owner.onDisconnect();
					resolve(self.cancelEditorConnection(owner));
				}
			}
			// If the URI is disconnected, ensure the UI state is consistent and resolve true
			owner.onDisconnect();
			resolve(true);
		});
	}

	/**
	 * Functions to handle the connecting life cycle
	 */

	// Connect an open URI to a connection profile
	private createNewConnection(uri: string, connection: IConnectionProfile): Promise<IConnectionResult> {
		const self = this;

		return new Promise<IConnectionResult>((resolve, reject) => {
			this._capabilitiesService.onCapabilitiesReady().then(() => {
				let connectionInfo = this._connectionStatusManager.addConnection(connection, uri);
				// Setup the handler for the connection complete notification to call
				connectionInfo.connectHandler = ((connectResult, errorMessage, errorCode, callStack) => {
					let connectionMngInfo = this._connectionStatusManager.findConnection(uri);
					if (connectionMngInfo && connectionMngInfo.deleted) {
						this._connectionStatusManager.deleteConnection(uri);
						resolve({ connected: connectResult, errorMessage: undefined, errorCode: undefined, callStack: undefined, errorHandled: true });
					} else {
						if (errorMessage) {
							// Connection to the server failed
							this._connectionStatusManager.deleteConnection(uri);
							resolve({ connected: connectResult, errorMessage: errorMessage, errorCode: errorCode, callStack: callStack });
						} else {
							resolve({ connected: connectResult, errorMessage: errorMessage, errorCode: errorCode, callStack: callStack });
						}
					}
				});

				// send connection request
				self.sendConnectRequest(connection, uri);
			});
		});
	}

	// Ask user if they are sure they want to cancel connection request
	private shouldCancelConnect(fileUri: string): Thenable<boolean> {
		const self = this;

		// Double check if the user actually wants to cancel their connection request
		return new Promise<boolean>((resolve, reject) => {
			// Setup our cancellation choices
			let choices: { key, value }[] = [
				{ key: nls.localize('yes', 'Yes'), value: true },
				{ key: nls.localize('no', 'No'), value: false }
			];

			self._quickOpenService.pick(choices.map(x => x.key), { placeHolder: nls.localize('cancelConnectionConfirmation', 'Are you sure you want to cancel this connection?'), ignoreFocusLost: true }).then((choice) => {
				let confirm = choices.find(x => x.key === choice);
				resolve(confirm && confirm.value);
			});
		});
	}

	private doDisconnect(fileUri: string, connection?: IConnectionProfile): Promise<boolean> {
		const self = this;

		return new Promise<boolean>((resolve, reject) => {
			let disconnectParams = new ConnectionContracts.DisconnectParams();
			disconnectParams.ownerUri = fileUri;

			// Send a disconnection request for the input URI
			self.sendDisconnectRequest(fileUri).then((result) => {
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

				resolve(result);
			});
		});
	}

	public disconnect(connection: IConnectionProfile): Promise<void>;
	public disconnect(ownerUri: string): Promise<void>;
	public disconnect(input: any): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let uri: string;
			let profile: IConnectionProfile;
			if (typeof input === 'object') {
				uri = Utils.generateUri(input);
				profile = input;
			} else if (typeof input === 'string') {
				profile = this.getConnectionProfile(input);
				uri = input;
			}
			this.doDisconnect(uri, profile).then(result => {
				if (result) {
					this.addTelemetryForConnectionDisconnected(input);
					this._connectionStore.removeActiveConnection(input);
					this._connectionStatusManager.removeConnection(uri);
					resolve();
				} else {
					reject(result);
				}
			});
		});
	}

	public cancelConnection(connection: IConnectionProfile): Thenable<boolean> {
		let fileUri = Utils.generateUri(connection);
		return this.cancelConnectionForUri(fileUri);
	}

	public cancelConnectionForUri(fileUri: string): Thenable<boolean> {
		const self = this;
		return new Promise<boolean>((resolve, reject) => {
			// Create a new set of cancel connection params with our file URI
			let cancelParams: ConnectionContracts.CancelConnectParams = new ConnectionContracts.CancelConnectParams();
			cancelParams.ownerUri = fileUri;

			this._connectionStatusManager.deleteConnection(fileUri);
			// Send connection cancellation request
			resolve(self.sendCancelRequest(fileUri));
		});
	}

	public cancelEditorConnection(owner: IConnectableInput): Thenable<boolean> {
		const self = this;
		let fileUri: string = owner.uri;
		return new Promise<boolean>((resolve, reject) => {
			if (self.isConnecting(fileUri)) {
				this.cancelConnectionForUri(fileUri).then(result => {
					resolve(result);
				});
			} else {
				resolve(self.disconnectEditor(owner));
			}
		});
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
	public findExistingConnection(connection: IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection'): ConnectionProfile {
		let connectionUri = Utils.generateUri(connection, purpose);
		let existingConnection = this._connectionStatusManager.findConnection(connectionUri);
		if (existingConnection && this._connectionStatusManager.isConnected(connectionUri)) {
			return existingConnection.connectionProfile;
		} else {
			return undefined;
		}
	}

	public isProfileConnected(connectionProfile: IConnectionProfile): boolean {
		let connectionManagement = this._connectionStatusManager.findConnectionProfile(connectionProfile);
		return connectionManagement && !connectionManagement.connecting;
	}

	public isProfileConnecting(connectionProfile: IConnectionProfile): boolean {
		let connectionManagement = this._connectionStatusManager.findConnectionProfile(connectionProfile);
		return connectionManagement && connectionManagement.connecting;
	}

	private isConnecting(fileUri: string): boolean {
		return this._connectionStatusManager.isConnecting(fileUri);
	}

	public getConnectionProfile(fileUri: string): IConnectionProfile {
		return this._connectionStatusManager.isConnected(fileUri) ? this._connectionStatusManager.getConnectionProfile(fileUri) : undefined;
	}

	public getConnectionInfo(fileUri: string): ConnectionManagementInfo {
		return this._connectionStatusManager.isConnected(fileUri) ? this._connectionStatusManager.findConnection(fileUri) : undefined;
	}

	public listDatabases(connectionUri: string): Thenable<data.ListDatabasesResult> {
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

			let provider = this._providers[providerId];
			return provider.changeDatabase(connectionUri, databaseName).then(result => {
				if (result) {
					this.getConnectionProfile(connectionUri).databaseName = databaseName;
				}
				return result;
			});
		}
		return Promise.resolve(false);
	}

	public editGroup(group: ConnectionProfileGroup): Promise<any> {
		return new Promise<string>((resolve, reject) => {
			this._connectionStore.editGroup(group).then(groupId => {
				this.refreshEditorTitles();
				this._onAddConnectionProfile.fire();
				resolve(null);
			}).catch(err => {
				reject(err);
			});
		});
	}

	/**
	 * Deletes a connection from registered servers.
	 * Disconnects a connection before removing from settings.
	 */
	public deleteConnection(connection: ConnectionProfile): Promise<boolean> {

		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.DeleteConnection, {}, connection);
		// Disconnect if connected
		let uri = Utils.generateUri(connection);
		if (this.isConnected(uri) || this.isConnecting(uri)) {
			this.doDisconnect(uri, connection).then((result) => {
				if (result) {
					// Remove profile from configuration
					this._connectionStore.deleteConnectionFromConfiguration(connection).then(() => {
						this._onDeleteConnectionProfile.fire();
						Promise.resolve(true);
					}).catch(err => {
						// Reject promise if error occurred writing to settings
						Promise.reject(err);
					});

				} else {
					// If connection fails to disconnect, resolve promise with false
					Promise.resolve(false);
				}
			});
		} else {
			// Remove disconnected profile from settings
			this._connectionStore.deleteConnectionFromConfiguration(connection).then(() => {
				this._onDeleteConnectionProfile.fire();
				Promise.resolve(true);
			}).catch(err => {
				// Reject promise if error ocurred writing to settings
				Promise.reject(err);
			});
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Deletes a group with all its children groups and connections from registered servers.
	 * Disconnects a connection before removing from config. If disconnect fails, settings is not modified.
	 */
	public deleteConnectionGroup(group: ConnectionProfileGroup): Promise<boolean> {
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.DeleteServerGroup);
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
		Promise.all(disconnected).then(() => {
			// Remove profiles and groups from config
			this._connectionStore.deleteGroupFromConfiguration(group).then(() => {
				this._onDeleteConnectionProfile.fire();
				Promise.resolve(true);
			}).catch(err => {
				// If saving to config fails, reject promise with false
				return Promise.reject(false);
			});
		}).catch(err => {
			// If disconnecting all connected profiles fails, resolve promise with false
			return Promise.resolve(false);
		});
		return Promise.resolve(undefined);
	}

	private _notifyDisconnected(connectionProfile: IConnectionProfile, connectionUri: string): void {
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

			let provider = this._providers[providerId];
			return provider.rebuildIntelliSenseCache(connectionUri);
		}
		return Promise.reject('The given URI is not currently connected');
	}

	public getTabColorForUri(uri: string): string {
		if (WorkbenchUtils.getSqlConfigValue<string>(this._workspaceConfigurationService, 'tabColorMode') === QueryConstants.tabColorModeOff) {
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

	private refreshEditorTitles(): void {
		if (this._editorGroupService instanceof EditorPart) {
			this._editorGroupService.refreshEditorTitles();
		}
	}

	public removeConnectionProfileCredentials(originalProfile: IConnectionProfile): IConnectionProfile {
		return this._connectionStore.getProfileWithoutPassword(originalProfile);
	}

	public getActiveConnectionCredentials(profileId: string): { [name: string]: string } {
		let profile = this.getActiveConnections().find(connectionProfile => connectionProfile.id === profileId);
		if (!profile) {
			return undefined;
		}

		// Find the password option for the connection provider
		let passwordOption = this._capabilitiesService.getCapabilities().find(capability => capability.providerName === profile.providerName).connectionProvider.options.find(
			option => option.specialValueType === ConnectionOptionSpecialType.password);
		if (!passwordOption) {
			return undefined;
		}

		let credentials = {};
		credentials[passwordOption.name] = profile.options[passwordOption.name];
		return credentials;
	}
}
