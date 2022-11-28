/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import * as azdata from 'azdata';
import { IConnectionProfileGroup, ConnectionProfileGroup, INewConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';

/**
 * A range in the editor. This interface is suitable for serialization.
 */
export interface IRange {
	/**
	 * Line number on which the range starts (starts at 1).
	 */
	readonly startLineNumber: number;
	/**
	 * Column on which the range starts in line `startLineNumber` (starts at 1).
	 */
	readonly startColumn: number;
	/**
	 * Line number on which the range ends.
	 */
	readonly endLineNumber: number;
	/**
	 * Column on which the range ends in line `endLineNumber`.
	 */
	readonly endColumn: number;
}

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
	params?: INewConnectionParams;

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
	connectionProfile?: IConnectionProfile;
}

export interface IConnectionCallbacks {
	onConnectStart(): void;
	onConnectReject(error?: string): void;
	onConnectSuccess(params: INewConnectionParams, profile: IConnectionProfile): void;
	onDisconnect(): void;
	onConnectCanceled(): void;
}

export const SERVICE_ID = 'connectionManagementService';

export const IConnectionManagementService = createDecorator<IConnectionManagementService>(SERVICE_ID);

export interface IConnectionManagementService {
	_serviceBrand: undefined;

	// Event Emitters
	onAddConnectionProfile: Event<IConnectionProfile>;
	onDeleteConnectionProfile: Event<void>;
	onConnect: Event<IConnectionParams>;
	onDisconnect: Event<IConnectionParams>;
	onConnectionChanged: Event<IConnectionParams>;
	onLanguageFlavorChanged: Event<azdata.DidChangeLanguageFlavorParams>;

	// Properties
	providerNameToDisplayNameMap: { [providerDisplayName: string]: string };

	/**
	 * Opens the edit connection dialog to change connection.
	 */
	showEditConnectionDialog(model: IConnectionProfile): Promise<void>;

	/**
	 * Opens the connection dialog to create new connection
	 */
	showConnectionDialog(params?: INewConnectionParams, options?: IConnectionCompletionOptions, model?: Partial<IConnectionProfile>, connectionResult?: IConnectionResult): Promise<void>;

	/**
	 * Load the password and opens a new connection
	 */
	connect(connection: IConnectionProfile, uri?: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult>;

	/**
	 * Opens a new connection and save the profile in settings
	 */
	connectAndSaveProfile(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult>;

	/**
	 * Replaces a connectioninfo's associated uri with a new uri.
	 */
	changeConnectionUri(newUri: string, oldUri: string): void

	/**
	 * Finds existing connection for given profile and purpose is any exists.
	 * The purpose is connection by default
	 */
	findExistingConnection(connection: IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection'): ConnectionProfile;

	/**
	 * If there's already a connection for given profile and purpose, returns the ownerUri for the connection
	 * otherwise tries to make a connection and returns the owner uri when connection is complete
	 * The purpose is connection by default
	 */
	connectIfNotConnected(connection: IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection', saveConnection?: boolean): Promise<string>;

	/**
	 * Adds the successful connection to MRU and send the connection error back to the connection handler for failed connections
	 */
	onConnectionComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void;

	onIntelliSenseCacheComplete(handle: number, connectionUri: string): void;

	onConnectionChangedNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void;

	getConnectionGroups(providers?: string[]): ConnectionProfileGroup[];

	getRecentConnections(providers?: string[]): ConnectionProfile[];

	clearRecentConnectionsList(): void;

	clearRecentConnection(connectionProfile: IConnectionProfile): void;

	getActiveConnections(providers?: string[]): ConnectionProfile[];

	saveProfileGroup(profile: INewConnectionProfileGroup): Promise<string>;

	changeGroupIdForConnectionGroup(source: IConnectionProfileGroup, target: IConnectionProfileGroup): Promise<void>;

	changeGroupIdForConnection(source: ConnectionProfile, targetGroupName: string): Promise<void>;

	deleteConnection(connection: ConnectionProfile): Promise<boolean>;

	deleteConnectionGroup(group: ConnectionProfileGroup): Promise<boolean>;

	getAdvancedProperties(): azdata.ConnectionOption[] | undefined;

	getConnectionUri(connectionProfile: IConnectionProfile): string;

	getFormattedUri(uri: string, connectionProfile: IConnectionProfile): string;

	getConnectionUriFromId(connectionId: string): string | undefined;

	isConnected(fileUri: string): boolean;

	refreshAzureAccountTokenIfNecessary(uriOrConnectionProfile: string | ConnectionProfile): Promise<boolean>;
	/**
	 * Returns true if the connection profile is connected
	 */
	isProfileConnected(connectionProfile: IConnectionProfile): boolean;

	/**
	 * Returns true if the connection profile is connecting
	 */
	isProfileConnecting(connectionProfile: IConnectionProfile): boolean;

	isRecent(connectionProfile: ConnectionProfile): boolean;

	isConnected(fileUri?: string, connectionProfile?: ConnectionProfile): boolean;

	disconnectEditor(owner: IConnectableInput, force?: boolean): Promise<boolean>;

	disconnect(connection: IConnectionProfile): Promise<void>;

	disconnect(ownerUri: string): Promise<void>;

	addSavedPassword(connectionProfile: IConnectionProfile): Promise<IConnectionProfile>;

	listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult | undefined>;

	/**
	 * Register a connection provider
	 */
	registerProvider(providerId: string, provider: azdata.ConnectionProvider): void;

	registerIconProvider(providerId: string, provider: azdata.IconProvider): void;

	editGroup(group: ConnectionProfileGroup): Promise<void>;

	getConnectionProfile(fileUri: string): IConnectionProfile | undefined;

	getConnectionInfo(fileUri: string): ConnectionManagementInfo | undefined;

	getDefaultProviderId(): string | undefined;

	getUniqueConnectionProvidersByNameMap(providerNameToDisplayNameMap: { [providerDisplayName: string]: string }): { [providerDisplayName: string]: string };

	/**
	 * Gets the default authentication type from the configuration service
	 */
	getDefaultAuthenticationTypeId(providerName: string): string;

	/**
	 * Cancels the connection
	 */
	cancelConnection(connection: IConnectionProfile): Thenable<boolean>;

	/**
	 * Changes the database for an active connection
	 */
	changeDatabase(connectionUri: string, databaseName: string): Thenable<boolean>;

	/**
	 * Cancels the connection for the editor
	 */
	cancelEditorConnection(owner: IConnectableInput): Thenable<boolean>;

	showDashboard(connection: IConnectionProfile): Thenable<boolean>;

	closeDashboard(uri: string): void;

	getProviderIdFromUri(ownerUri: string): string;

	hasRegisteredServers(): boolean;

	canChangeConnectionConfig(profile: IConnectionProfile, newGroupID: string): boolean;

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
	 * Get a copy of the connection profile with its passwords removed
	 * @param profile The connection profile to remove passwords from
	 * @returns A copy of the connection profile with passwords removed
	 */
	removeConnectionProfileCredentials(profile: IConnectionProfile): IConnectionProfile;

	/**
	 * Get the credentials for a connection profile, as they would appear in the options dictionary
	 * @param profileId The id of the connection profile to get the password for
	 * @returns A dictionary containing the credentials as they would be included
	 * in the connection profile's options dictionary, or undefined if the profile was not found
	 */
	getConnectionCredentials(profileId: string): Promise<{ [name: string]: string }>;

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
	getConnectionProfileById(profileId: string): IConnectionProfile;

	getProviderProperties(providerName: string): ConnectionProviderProperties;

	getProviderLanguageMode(providerName?: string): string;

	getConnectionIconId(connectionId: string): string;

	/**
	 * Get known connection profiles including active connections, recent connections and saved connections.
	 * @param activeConnectionsOnly Indicates whether only get the active connections, default value is false.
	 * @returns array of connections
	 */
	getConnections(activeConnectionsOnly?: boolean): ConnectionProfile[];

	/**
	 * Handle the unsupported provider scenario.
	 * @param providerId The provider ID
	 * @returns Promise with a boolean value indicating whether the user has accepted the suggestion.
	 */
	handleUnsupportedProvider(providerId: string): Promise<boolean>;
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
	queryRange?: IRange;
	showDashboard?: boolean;
	providers?: string[];
	isEditConnection?: boolean;
	oldProfileId?: string; // used for edit connection
}

export interface IConnectableInput {
	uri: string;
	onConnectStart(): void;
	onConnectReject(error?: string): void;
	onConnectSuccess(params: INewConnectionParams, profile: IConnectionProfile): void;
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
	connectionProfile: IConnectionProfile;
}
