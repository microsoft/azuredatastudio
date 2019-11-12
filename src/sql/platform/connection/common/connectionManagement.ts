/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { ConnectionState } from 'sql/base/common/connection';
import { URI } from 'vs/base/common/uri';

export interface ConnectOptions {
	/**
	 * Associate a uri to the connection; used for connection coming from editors
	 */
	associateUri?: URI;
	/**
	 * Attempt to use an existing connection for the profile if it exists; will be ignored if
	 * used even passing an IConnection
	 */
	useExisting?: boolean;
	/**
	 * Should save the connection to the user's config
	 */
	saveToConfig?: boolean;
}

/**
 * Represents a specific connection (though not necessarily connected)
 */
export interface IConnection {
	readonly state: ConnectionState;
	readonly profile: ConnectionProfile;
	readonly id: string;
	readonly onStateChange: Event<ConnectionState>;
	cancel(): Promise<void>;
	disconnect(): Promise<void>;
}

export interface IConnectionGroup {
	readonly name: string;
	readonly id: string;
	readonly children: Array<IConnectionGroup | IConnection>;
	readonly color?: string;
	readonly description?: string;
	readonly onChange: Event<void>;
}

export interface IConnectionProvider {
}

export const IConnectionManagementService = createDecorator<IConnectionManagementService>('connectionManagementService');

export interface IConnectionManagementService {

	/** APPROVED */
	_serviceBrand: undefined;

	/**
	 * Opens a connection with the given profile
	 */
	connect(profile: ConnectionProfile, options?: ConnectOptions): Promise<IConnection>;
	/**
	 * Connects the given connection if it is not already connected
	 */
	connect(connection: IConnection, options?: ConnectOptions): Promise<IConnection>;

	/**
	 * Finds an existing connection that matches the provided connection profile
	 */
	findExistingConnection(connection: ConnectionProfile): IConnection | undefined;

	registerProvider(providerId: string, provider: IConnectionProvider): void;

	/** NOT APPROVED */
	/*

	// Event Emitters
	onConnect: Event<IConnectionParams>;
	onDisconnect: Event<IConnectionParams>;
	onConnectionChanged: Event<IConnectionParams>;
	onLanguageFlavorChanged: Event<azdata.DidChangeLanguageFlavorParams>;


	/**
	 * Opens the connection dialog to create new connection
	 *//*
	showConnectionDialog(params?: INewConnectionParams, options?: IConnectionCompletionOptions, model?: ConnectionProfile, connectionResult?: IConnectionResult): Promise<void>;

	/**
	 * Adds the successful connection to MRU and send the connection error back to the connection handler for failed connections
	 *//*
	onConnectionComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void;

	onIntelliSenseCacheComplete(handle: number, connectionUri: string): void;

	onConnectionChangedNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void;

	getConnectionGroups(providers?: string[]): ConnectionGroup[];


	clearRecentConnectionsList(): void;

	clearRecentConnection(connectionProfile: ConnectionProfile): void;

	getActiveConnections(providers?: string[]): ConnectionProfile[];

	saveProfileGroup(profile: IConnectionProfileGroup): Promise<string>;

	changeGroupIdForConnectionGroup(source: IConnectionProfileGroup, target: IConnectionProfileGroup): Promise<void>;

	changeGroupIdForConnection(source: ConnectionProfile, targetGroupName: string): Promise<void>;

	deleteConnection(connection: ConnectionProfile): Promise<boolean>;

	deleteConnectionGroup(group: ConnectionGroup): Promise<boolean>;

	getAdvancedProperties(): azdata.ConnectionOption[];

	addSavedPassword(connectionProfile: ConnectionProfile): Promise<ConnectionProfile>;

	listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult>;

	/**
	 * Register a connection provider
	 *//*
	registerProvider(providerId: string, provider: azdata.ConnectionProvider): void;

	registerIconProvider(providerId: string, provider: azdata.IconProvider): void;

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
	 *//*
	doChangeLanguageFlavor(uri: string, language: string, flavor: string): void;

	/**
	 * Ensures that a default language flavor is set for a URI, if none has already been defined.
	 * @param uri document identifier
	 *//*
	ensureDefaultLanguageFlavor(uri: string): void;

	/**
	 * Refresh the IntelliSense cache for the connection with the given URI
	 *//*
	rebuildIntelliSenseCache(uri: string): Thenable<void>;

	/**
	 * Get the credentials for a connected connection profile, as they would appear in the options dictionary
	 * @param profileId The id of the connection profile to get the password for
	 * @returns A dictionary containing the credentials as they would be included
	 * in the connection profile's options dictionary, or undefined if the profile is not connected
	 *//*
	getActiveConnectionCredentials(profileId: string): { [name: string]: string };

	/**
	 * Get the ServerInfo for a connected connection profile
	 * @param profileId The id of the connection profile to get the password for
	 * @returns ServerInfo
	 *//*
	getServerInfo(profileId: string): azdata.ServerInfo;

	/**
	 * Get the connection string for the provided connection ID
	 *//*
	getConnectionString(connectionId: string, includePassword: boolean): Thenable<string>;

	/**
	 * Serialize connection string with optional provider
	 *//*
	buildConnectionInfo(connectionString: string, provider?: string): Thenable<azdata.ConnectionInfo>;

	providerRegistered(providerId: string): boolean;
	/**
	 * Get connection profile by id
	 *//*
	getConnectionProfileById(profileId: string): ConnectionProfile;

	getProviderProperties(providerName: string): ConnectionProviderProperties;

	getConnectionIconId(connectionId: string): string;

	/**
	 * Get known connection profiles including active connections, recent connections and saved connections.
	 * @param activeConnectionsOnly Indicates whether only get the active connections, default value is false.
	 * @returns array of connections
	 *//*
	getConnections(activeConnectionsOnly?: boolean): ConnectionProfile[];

	getConnection(uri: string): ConnectionProfile;
*/}
