/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import * as azdata from 'azdata';
import { IConnectionProfileGroup, ConnectionGroup } from 'sql/platform/connection/common/connectionGroup';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';
import { Connection, ConnectionState } from 'sql/base/common/connection';
import { URI } from 'vs/base/common/uri';

/**
 * Options for the actions that could happen after connecting is complete
 */
export interface IConnectionCompletionOptions {
	/**
	 * save the connection to MRU and settings (only save to setting if profile.saveProfile is set to true)
	 */
	saveTheConnection: boolean;

	/**
	 * open the dashboard after connection is complete
	 */
	showDashboard: boolean;

	/**
	 * Parameters to be used if connecting from an editor
	 */
	params: INewConnectionParams;

	/**
	 * Open the connection dialog if connection fails
	 */
	showConnectionDialogOnError: boolean;

	/**
	 * Open the connection firewall rule dialog if connection fails
	 */
	showFirewallRuleOnError: boolean;
}

export interface IConnectionResult {
	connected: boolean;
	errorMessage: string;
	errorCode: number;
	callStack: string;
	errorHandled?: boolean;
	connectionProfile?: ConnectionProfile;
}

export interface IConnectionCallbacks {
	onConnectStart(): void;
	onConnectReject(error?: string): void;
	onConnectSuccess(params: INewConnectionParams, profile: ConnectionProfile): void;
	onDisconnect(): void;
	onConnectCanceled(): void;
}

export interface ConnectOptions {
	/**
	 * Associate a uri to the connection; used for connection coming from editors
	 */
	associateUri?: URI;
	/**
	 * Attempt to use an existing connection for the profile if it exists
	 */
	useExisting?: boolean;
	/**
	 * Should save the connection to the user's config
	 */
	saveToConfig?: boolean;
}

/**
 * Represents a connection (though not necessarily connected)
 */
export interface IConnection {
	readonly state: ConnectionState;
	readonly profile: ConnectionProfile;
	readonly id: string;
	readonly onStateChange: Event<ConnectionState>;
}

export const SERVICE_ID = 'connectionManagementService';

export const IConnectionManagementService = createDecorator<IConnectionManagementService>(SERVICE_ID);

export interface IConnectionManagementService {
	_serviceBrand: undefined;

	// Event Emitters
	onAddConnectionProfile: Event<ConnectionProfile>;
	onDeleteConnectionProfile: Event<void>;
	onConnect: Event<IConnectionParams>;
	onDisconnect: Event<IConnectionParams>;
	onConnectionChanged: Event<IConnectionParams>;
	onLanguageFlavorChanged: Event<azdata.DidChangeLanguageFlavorParams>;

	/**
	 * Opens the connection dialog to create new connection
	 */
	showConnectionDialog(params?: INewConnectionParams, options?: IConnectionCompletionOptions, model?: ConnectionProfile, connectionResult?: IConnectionResult): Promise<void>;

	/**
	 * Load the password and opens a new connection
	 */
	connect(connection: ConnectionProfile, options?: ConnectOptions): Promise<IConnection>;

	/**
	 * Finds existing connection for given profile and purpose is any exists.
	 * The purpose is connection by default
	 */
	findExistingConnection(connection: ConnectionProfile): IConnection | undefined;

	/**
	 * Adds the successful connection to MRU and send the connection error back to the connection handler for failed connections
	 */
	onConnectionComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void;

	onIntelliSenseCacheComplete(handle: number, connectionUri: string): void;

	onConnectionChangedNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void;

	getConnectionGroups(providers?: string[]): ConnectionGroup[];

	getRecentConnections(providers?: string[]): ConnectionProfile[];

	clearRecentConnectionsList(): void;

	clearRecentConnection(connectionProfile: ConnectionProfile): void;

	getActiveConnections(providers?: string[]): ConnectionProfile[];

	saveProfileGroup(profile: IConnectionProfileGroup): Promise<string>;

	changeGroupIdForConnectionGroup(source: IConnectionProfileGroup, target: IConnectionProfileGroup): Promise<void>;

	changeGroupIdForConnection(source: ConnectionProfile, targetGroupName: string): Promise<void>;

	deleteConnection(connection: ConnectionProfile): Promise<boolean>;

	deleteConnectionGroup(group: ConnectionGroup): Promise<boolean>;

	getAdvancedProperties(): azdata.ConnectionOption[];

	getConnectionUri(connectionProfile: ConnectionProfile): string;

	getFormattedUri(uri: string, connectionProfile: ConnectionProfile): string;

	getConnectionUriFromId(connectionId: string): string;

	isConnected(fileUri: string): boolean;

	/**
	 * Returns true if the connection profile is connected
	 */
	isProfileConnected(connectionProfile: ConnectionProfile): boolean;

	/**
	 * Returns true if the connection profile is connecting
	 */
	isProfileConnecting(connectionProfile: ConnectionProfile): boolean;

	isRecent(connectionProfile: ConnectionProfile): boolean;

	isConnected(fileUri: string, connectionProfile?: ConnectionProfile): boolean;

	disconnectEditor(owner: IConnectableInput, force?: boolean): Promise<boolean>;

	disconnect(connection: ConnectionProfile): Promise<void>;

	disconnect(ownerUri: string): Promise<void>;

	addSavedPassword(connectionProfile: ConnectionProfile): Promise<ConnectionProfile>;

	listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult>;

	/**
	 * Register a connection provider
	 */
	registerProvider(providerId: string, provider: azdata.ConnectionProvider): void;

	registerIconProvider(providerId: string, provider: azdata.IconProvider): void;

	editGroup(group: ConnectionGroup): Promise<void>;

	getConnectionProfile(fileUri: string): ConnectionProfile;

	getConnectionInfo(fileUri: string): ConnectionManagementInfo;

	getDefaultProviderId(): string;

	/**
	 * Cancels the connection
	 */
	cancelConnection(connection: ConnectionProfile): Thenable<boolean>;

	/**
	 * Changes the database for an active connection
	 */
	changeDatabase(connectionUri: string, databaseName: string): Thenable<boolean>;

	/**
	 * Cancels the connection for the editor
	 */
	cancelEditorConnection(owner: IConnectableInput): Thenable<boolean>;

	showDashboard(connection: ConnectionProfile): Thenable<boolean>;

	closeDashboard(uri: string): void;

	getProviderIdFromUri(ownerUri: string): string;

	hasRegisteredServers(): boolean;

	canChangeConnectionConfig(profile: ConnectionProfile, newGroupID: string): boolean;

	getTabColorForUri(uri: string): string;

	/**
	 * Sends a notification that the language flavor for a given URI has changed.
	 * For SQL, this would be the specific SQL implementation being used.
	 *
	 * @param uri the URI of the resource whose language has changed
	 * @param language the base language
	 * @param flavor the specific language flavor that's been set
	 */
	doChangeLanguageFlavor(uri: string, language: string, flavor: string): void;

	/**
	 * Ensures that a default language flavor is set for a URI, if none has already been defined.
	 * @param uri document identifier
	 */
	ensureDefaultLanguageFlavor(uri: string): void;

	/**
	 * Refresh the IntelliSense cache for the connection with the given URI
	 */
	rebuildIntelliSenseCache(uri: string): Thenable<void>;

	/**
	 * Get the credentials for a connected connection profile, as they would appear in the options dictionary
	 * @param profileId The id of the connection profile to get the password for
	 * @returns A dictionary containing the credentials as they would be included
	 * in the connection profile's options dictionary, or undefined if the profile is not connected
	 */
	getActiveConnectionCredentials(profileId: string): { [name: string]: string };

	/**
	 * Get the ServerInfo for a connected connection profile
	 * @param profileId The id of the connection profile to get the password for
	 * @returns ServerInfo
	 */
	getServerInfo(profileId: string): azdata.ServerInfo;

	/**
	 * Get the connection string for the provided connection ID
	 */
	getConnectionString(connectionId: string, includePassword: boolean): Thenable<string>;

	/**
	 * Serialize connection string with optional provider
	 */
	buildConnectionInfo(connectionString: string, provider?: string): Thenable<azdata.ConnectionInfo>;

	providerRegistered(providerId: string): boolean;
	/**
	 * Get connection profile by id
	 */
	getConnectionProfileById(profileId: string): ConnectionProfile;

	getProviderProperties(providerName: string): ConnectionProviderProperties;

	getConnectionIconId(connectionId: string): string;

	/**
	 * Get known connection profiles including active connections, recent connections and saved connections.
	 * @param activeConnectionsOnly Indicates whether only get the active connections, default value is false.
	 * @returns array of connections
	 */
	getConnections(activeConnectionsOnly?: boolean): ConnectionProfile[];

	getConnection(uri: string): ConnectionProfile;
}

export enum RunQueryOnConnectionMode {
	none = 0,
	executeQuery = 1,
	executeCurrentQuery = 2,
	estimatedQueryPlan = 3,
	actualQueryPlan = 4
}

export interface INewConnectionParams {
	connectionType: ConnectionType;
	input?: IConnectableInput;
	runQueryOnCompletion?: RunQueryOnConnectionMode;
	querySelection?: azdata.ISelectionData;
	showDashboard?: boolean;
	providers?: string[];
}

export interface IConnectableInput {
	uri: string;
	onConnectStart(): void;
	onConnectReject(error?: string): void;
	onConnectSuccess(params: INewConnectionParams, profile: ConnectionProfile): void;
	onDisconnect(): void;
	onConnectCanceled(): void;
}

export enum ConnectionType {
	default = 0,
	editor = 1,
	temporary = 2
}

export enum MetadataType {
	Table = 0,
	View = 1,
	SProc = 2,
	Function = 3
}

export enum TaskStatus {
	NotStarted = 0,
	InProgress = 1,
	Succeeded = 2,
	SucceededWithWarning = 3,
	Failed = 4,
	Canceled = 5,
	Canceling = 6
}

export interface IConnectionParams {
	connectionUri: string;
	connectionProfile: ConnectionProfile;
}
