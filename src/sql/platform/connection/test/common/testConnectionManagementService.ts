/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService, IConnectableInput, IConnectionCompletionOptions, IConnectionCallbacks, IConnectionResult, INewConnectionParams }
	from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfileGroup, ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import * as azdata from 'azdata';
import { Event } from 'vs/base/common/event';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';

// Test stubs for commonly used objects

export class TestConnectionManagementService implements IConnectionManagementService {
	disconnect(connection: IConnectionProfile): Promise<void>;
	disconnect(ownerUri: string): Promise<void>;
	disconnect(ownerUri: any) {
		return Promise.resolve();
	}
	_serviceBrand: undefined;
	onAddConnectionProfile = undefined!;
	onDeleteConnectionProfile = undefined!;
	onLanguageFlavorChanged = undefined!;

	public onConnectionProfileCreated: Event<any> = Event.None;
	public onConnectionProfileEdited: Event<any> = Event.None;
	public onConnectionProfileDeleted: Event<any> = Event.None;
	public onConnectionProfileMoved: Event<any> = Event.None;
	public onConnectionProfileConnected: Event<any> = Event.None;
	public onConnectionProfileDisconnected: Event<any> = Event.None;
	public onConnectionProfileGroupCreated: Event<any> = Event.None;
	public onConnectionProfileGroupEdited: Event<any> = Event.None;
	public onConnectionProfileGroupDeleted: Event<any> = Event.None;
	public onConnectionProfileGroupMoved: Event<any> = Event.None;
	public onRecentConnectionProfileDeleted: Event<any> = Event.None;

	public get onConnect(): Event<any> {
		return Event.None;
	}

	public get onDisconnect(): Event<any> {
		return Event.None;
	}

	public get onConnectionChanged(): Event<any> {
		return Event.None;
	}

	public get providerNameToDisplayNameMap(): { [providerDisplayName: string]: string } {
		return {};
	}

	registerProvider(providerId: string, provider: azdata.ConnectionProvider): void {

	}

	registerIconProvider(providerId: string, provider: azdata.IconProvider): void {

	}

	changeConnectionUri(newUri: string, oldUri: string): void {

	}

	showConnectionDialog(params?: INewConnectionParams, options?: IConnectionCompletionOptions, model?: IConnectionProfile, connectionResult?: IConnectionResult): Promise<void> {
		return undefined!;
	}

	showCreateServerGroupDialog(): Promise<void> {
		return undefined!;
	}

	showEditServerGroupDialog(group: ConnectionProfileGroup): Promise<void> {
		return undefined!;
	}

	showEditConnectionDialog(model: IConnectionProfile): Promise<void> {
		return undefined!;
	}

	onConnectionComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void {

	}

	onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {

	}

	public onConnectionChangedNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void {

	}

	getCurrentConnectionSummary(): azdata.ConnectionSummary {
		return undefined!;
	}

	getConnectionGroups(providers?: string[]): ConnectionProfileGroup[] {
		return [];
	}

	getConnectionGroupById(id: string): ConnectionProfileGroup | undefined {
		return undefined;
	}

	getActiveConnections(providers?: string[]): ConnectionProfile[] {
		return [];
	}

	saveProfileGroup(profile: IConnectionProfileGroup): Promise<string> {
		return undefined!;
	}

	getRecentConnections(providers?: string[]): ConnectionProfile[] {
		return [];
	}

	public clearRecentConnectionsList(): void {
		return;
	}

	public clearRecentConnection(connectionProfile: ConnectionProfile): void {
		return;
	}

	getUnsavedConnections(): ConnectionProfile[] {
		return [];
	}

	changeGroupIdForConnectionGroup(source: IConnectionProfileGroup, target: IConnectionProfileGroup): Promise<void> {
		return Promise.resolve();
	}

	changeGroupIdForConnection(source: ConnectionProfile, targetGroupId: string): Promise<void> {
		return Promise.resolve();
	}

	deleteConnection(connection: ConnectionProfile): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			resolve(true);
		});
	}

	deleteConnectionGroup(group: ConnectionProfileGroup): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			resolve(true);
		});
	}

	getAdvancedProperties(): azdata.ConnectionOption[] {
		return [];
	}

	getConnectionUri(connectionProfile: ConnectionProfile): string {
		return undefined!;
	}

	getFormattedUri(uri: string, connectionProfile: ConnectionProfile): string {
		return undefined!;
	}

	getConnectionUriFromId(connectionId: string): string {
		return undefined!;
	}

	isConnected(fileUri: string, connectionProfile?: ConnectionProfile): boolean {
		return false;
	}

	isRecent(connectionProfile: ConnectionProfile): boolean {
		return false;
	}

	isProfileConnected(connectionProfile: IConnectionProfile): boolean {
		return false;
	}

	isProfileConnecting(connectionProfile: IConnectionProfile): boolean {
		return false;
	}

	findExistingConnection(connection: IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection'): ConnectionProfile {
		return undefined!;
	}

	async fixProfile(profile?: IConnectionProfile): Promise<IConnectionProfile> {
		return profile;
	}

	connect(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		return new Promise<IConnectionResult>((resolve, reject) => {
			resolve({ connected: true, errorMessage: undefined!, errorCode: undefined!, messageDetails: undefined! });
		});
	}

	connectAndSaveProfile(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		return new Promise<IConnectionResult>(() => true);
	}

	changePassword(connection: IConnectionProfile, uri: string, newPassword: string): Promise<azdata.PasswordChangeResult> {
		return Promise.resolve(undefined!);
	}

	disconnectEditor(owner: IConnectableInput): Promise<boolean> {
		return new Promise<boolean>(() => true);
	}

	getConnectionProfile(fileUri: string): IConnectionProfile {
		return undefined!;
	}

	getConnectionInfo(fileUri: string): ConnectionManagementInfo {
		return undefined!;
	}

	public updateServerConnectionId(editorUri: string, newId: string): boolean {
		// Return false as we do not want unnecessary refresh during test.
		return false;
	}

	addSavedPassword(connectionProfile: IConnectionProfile): Promise<IConnectionProfile> {
		return new Promise<IConnectionProfile>(() => connectionProfile);
	}

	public listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult> {
		return Promise.resolve(undefined!);
	}

	cancelConnection(connection: IConnectionProfile): Thenable<boolean> {
		return undefined!;
	}

	cancelEditorConnection(owner: IConnectableInput): Thenable<boolean> {
		return undefined!;
	}

	showDashboard(connection: ConnectionProfile): Promise<boolean> {
		return new Promise(() => true);
	}

	closeDashboard(uri: string): void {
	}

	changeDatabase(connectionUri: string, databaseName: string): Thenable<boolean> {
		return new Promise(() => true);
	}

	editGroup(group: ConnectionProfileGroup): Promise<void> {
		return Promise.resolve();
	}

	getUniqueConnectionProvidersByNameMap(providerNameToDisplayNameMap: { [providerDisplayName: string]: string }): { [providerDisplayName: string]: string } {
		return {};
	}

	getProviderIdFromUri(ownerUri: string): string {
		return undefined!;
	}

	hasRegisteredServers(): boolean {
		return true;
	}

	getCapabilities(providerName: string): azdata.DataProtocolServerCapabilities {
		return undefined!;
	}

	canChangeConnectionConfig(profile: ConnectionProfile, newGroupID: string): boolean {
		return true;
	}

	doChangeLanguageFlavor(uri: string, language: string, flavor: string): void {

	}
	ensureDefaultLanguageFlavor(uri: string): void {

	}

	connectIfNotConnected(connection: IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection', saveConnection: boolean = false): Promise<string> {
		return undefined!;
	}

	rebuildIntelliSenseCache(uri: string): Thenable<void> {
		return undefined!;
	}

	getTabColorForUri(uri: string): string {
		return undefined!;
	}

	removeConnectionProfileCredentials(profile: IConnectionProfile): IConnectionProfile {
		return undefined!;
	}

	getConnectionCredentials(profileId: string): Promise<{ [name: string]: string }> {
		return Promise.resolve(undefined!);
	}

	getServerInfo(profileId: string): azdata.ServerInfo {
		return undefined;
	}

	getConnectionString(connectionId: string): Thenable<string> {
		return undefined!;
	}

	buildConnectionInfo(connectionString: string, provider: string): Promise<azdata.ConnectionInfo> {
		return undefined!;
	}

	providerRegistered(providerId: string): boolean {
		return undefined!;
	}

	getConnectionProfileById(profileId: string): IConnectionProfile {
		return undefined!;
	}

	getProviderProperties(providerName: string): ConnectionProviderProperties {
		return undefined!;
	}

	getProviderLanguageMode(providerName?: string): string {
		return undefined!;
	}

	getConnectionIconId(connectionId: string): string {
		return undefined!;
	}

	getDefaultProviderId(): string {
		return undefined!;
	}

	getDefaultAuthenticationTypeId(providerName: string): string {
		return undefined!;
	}


	getConnections(activeConnectionsOnly?: boolean): ConnectionProfile[] {
		return [];
	}

	getConnection(uri: string): ConnectionProfile {
		return undefined!;
	}

	refreshAzureAccountTokenIfNecessary(uriOrConnectionProfile: string | ConnectionProfile): Promise<boolean> {
		return undefined;
	}

	async handleUnsupportedProvider(providerName: string): Promise<boolean> {
		return true;
	}

	openChangePasswordDialog(profile: IConnectionProfile): Promise<string | undefined> {
		return undefined;
	}

	getNonDefaultOptions(profile: IConnectionProfile): string {
		return undefined!;
	}

	openCustomErrorDialog(options: azdata.window.IErrorDialogOptions): Promise<string | undefined> {
		return undefined;
	}
}
