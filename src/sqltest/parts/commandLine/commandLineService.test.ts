/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as Constants from 'sql/parts/connection/common/constants';
import * as Utils from 'sql/parts/connection/common/utils';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import * as sqlops from 'sqlops';

import { TPromise } from 'vs/base/common/winjs.base';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { CommandLineService } from 'sql/parts/commandLine/common/commandLineService';
import { ConnectionManagementService } from 'sql/parts/connection/common/connectionManagementService';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { IEnvironmentService, ParsedArgs } from 'vs/platform/environment/common/environment';
import { CapabilitiesService, ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { QueryEditorService } from 'sql/parts/query/services/queryEditorService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import {
	IConnectionManagementService, IConnectionDialogService, INewConnectionParams,
	ConnectionType, IConnectableInput, IConnectionCompletionOptions, IConnectionCallbacks,
	IConnectionParams, IConnectionResult, IServerGroupController, IServerGroupDialogCallbacks,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import { ConnectionStore } from 'sql/parts/connection/common/connectionStore';
import { Event, Emitter } from 'vs/base/common/event';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';

class TestConnectionManagementService implements IConnectionManagementService
{
	_serviceBrand: any;	onAddConnectionProfile: Event<IConnectionProfile>;
	onDeleteConnectionProfile: Event<void>;
	onConnect: Event<IConnectionParams>;
	onDisconnect: Event<IConnectionParams>;
	onConnectionChanged: Event<IConnectionParams>;
	onLanguageFlavorChanged: Event<sqlops.DidChangeLanguageFlavorParams>;
	showConnectionDialog(params?: INewConnectionParams, model?: IConnectionProfile, connectionResult?: IConnectionResult): Promise<void> {
		throw new Error('Method not implemented.');
	}
	showCreateServerGroupDialog(callbacks?: IServerGroupDialogCallbacks): Promise<void> {
		throw new Error('Method not implemented.');
	}
	showEditServerGroupDialog(group: ConnectionProfileGroup): Promise<void> {
		throw new Error('Method not implemented.');
	}
	connect(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		throw new Error('Method not implemented.');
	}
	connectAndSaveProfile(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		throw new Error('Method not implemented.');
	}
	findExistingConnection(connection: IConnectionProfile, purpose?: "dashboard" | "insights" | "connection"): ConnectionProfile {
		throw new Error('Method not implemented.');
	}
	connectIfNotConnected(connection: IConnectionProfile, purpose?: "dashboard" | "insights" | "connection"): Promise<string> {
		throw new Error('Method not implemented.');
	}
	onConnectionComplete(handle: number, connectionInfoSummary: sqlops.ConnectionInfoSummary): void {
		throw new Error('Method not implemented.');
	}
	onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		throw new Error('Method not implemented.');
	}
	onConnectionChangedNotification(handle: number, changedConnInfo: sqlops.ChangedConnectionInfo) {
		throw new Error('Method not implemented.');
	}
	getConnectionGroups(providers?: string[]): ConnectionProfileGroup[] {
		throw new Error('Method not implemented.');
	}
	getRecentConnections(providers?: string[]): ConnectionProfile[] {
		throw new Error('Method not implemented.');
	}
	clearRecentConnectionsList(): void {
		throw new Error('Method not implemented.');
	}
	clearRecentConnection(connectionProfile: IConnectionProfile): void {
		throw new Error('Method not implemented.');
	}
	getActiveConnections(providers?: string[]): ConnectionProfile[] {
		throw new Error('Method not implemented.');
	}
	saveProfileGroup(profile: IConnectionProfileGroup): Promise<string> {
		throw new Error('Method not implemented.');
	}
	changeGroupIdForConnectionGroup(source: IConnectionProfileGroup): Promise<void> {
		throw new Error('Method not implemented.');
	}
	changeGroupIdForConnection(source: ConnectionProfile, targetGroupName: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	deleteConnection(connection: ConnectionProfile): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	deleteConnectionGroup(group: ConnectionProfileGroup): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	getAdvancedProperties(): sqlops.ConnectionOption[] {
		throw new Error('Method not implemented.');
	}
	getConnectionUri(connectionProfile: IConnectionProfile): string {
		throw new Error('Method not implemented.');
	}
	getFormattedUri(uri: string, connectionProfile: IConnectionProfile): string {
		throw new Error('Method not implemented.');
	}
	getConnectionUriFromId(connectionId: string): string {
		throw new Error('Method not implemented.');
	}
	isConnected(fileUri: string): boolean;
	isConnected(fileUri: string, connectionProfile?: ConnectionProfile): boolean;
	isConnected(fileUri: any, connectionProfile?: any) {
		throw new Error('Method not implemented.');
		return false;
	}
	isProfileConnected(connectionProfile: IConnectionProfile): boolean {
		throw new Error('Method not implemented.');
	}
	isProfileConnecting(connectionProfile: IConnectionProfile): boolean {
		throw new Error('Method not implemented.');
	}
	isRecent(connectionProfile: ConnectionProfile): boolean {
		throw new Error('Method not implemented.');
	}
	disconnectEditor(owner: IConnectableInput, force?: boolean): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	disconnect(connection: IConnectionProfile): Promise<void>;
	disconnect(ownerUri: string): Promise<void>;
	disconnect(ownerUri: any) {
		throw new Error('Method not implemented.');
		return new Promise<void>(undefined);
	}
	addSavedPassword(connectionProfile: IConnectionProfile): Promise<IConnectionProfile> {
		throw new Error('Method not implemented.');
	}
	listDatabases(connectionUri: string): Thenable<sqlops.ListDatabasesResult> {
		throw new Error('Method not implemented.');
	}
	registerProvider(providerId: string, provider: sqlops.ConnectionProvider): void {
		throw new Error('Method not implemented.');
	}
	editGroup(group: ConnectionProfileGroup): Promise<void> {
		throw new Error('Method not implemented.');
	}
	getConnectionProfile(fileUri: string): IConnectionProfile {
		throw new Error('Method not implemented.');
	}
	getConnectionInfo(fileUri: string): import("d:/git/azuredatastudio/src/sql/parts/connection/common/connectionManagementInfo").ConnectionManagementInfo {
		throw new Error('Method not implemented.');
	}
	cancelConnection(connection: IConnectionProfile): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	changeDatabase(connectionUri: string, databaseName: string): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	cancelEditorConnection(owner: IConnectableInput): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	showDashboard(connection: IConnectionProfile): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	closeDashboard(uri: string): void {
		throw new Error('Method not implemented.');
	}
	getProviderIdFromUri(ownerUri: string): string {
		throw new Error('Method not implemented.');
	}
	hasRegisteredServers(): boolean {
		throw new Error('Method not implemented.');
	}
	canChangeConnectionConfig(profile: IConnectionProfile, newGroupID: string): boolean {
		throw new Error('Method not implemented.');
	}
	getTabColorForUri(uri: string): string {
		throw new Error('Method not implemented.');
	}
	doChangeLanguageFlavor(uri: string, language: string, flavor: string): void {
		throw new Error('Method not implemented.');
	}
	ensureDefaultLanguageFlavor(uri: string): void {
		throw new Error('Method not implemented.');
	}
	rebuildIntelliSenseCache(uri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	removeConnectionProfileCredentials(profile: IConnectionProfile): IConnectionProfile {
		throw new Error('Method not implemented.');
	}
	getActiveConnectionCredentials(profileId: string): { [name: string]: string; } {
		throw new Error('Method not implemented.');
	}
	getConnectionString(connectionId: string, includePassword: boolean): Thenable<string> {
		throw new Error('Method not implemented.');
	}
	buildConnectionInfo(connectionString: string, provider?: string): Thenable<sqlops.ConnectionInfo> {
		throw new Error('Method not implemented.');
	}

}

class TestParsedArgs implements ParsedArgs{
	[arg: string]: any;
	_: string[];
	aad?: boolean;
	add?: boolean;
	database?:string;
	debugBrkPluginHost?: string;
	debugBrkSearch?: string;
	debugId?: string;
	debugPluginHost?: string;
	debugSearch?: string;
	diff?: boolean;
	'disable-crash-reporter'?: string;
	'disable-extension'?: string | string[];
	'disable-extensions'?: boolean;
	'disable-restore-windows'?: boolean;
	'disable-telemetry'?: boolean;
	'disable-updates'?: string;
	'driver'?: string;
	'enable-proposed-api'?: string | string[];
	'export-default-configuration'?: string;
	'extensions-dir'?: string;
	extensionDevelopmentPath?: string;
	extensionTestsPath?: string;
	'file-chmod'?: boolean;
	'file-write'?: boolean;
	'folder-uri'?: string | string[];
	goto?: boolean;
	help?: boolean;
	'install-extension'?: string | string[];
	'install-source'?: string;
	integrated?: boolean;
	'list-extensions'?: boolean;
	locale?: string;
	log?: string;
	logExtensionHostCommunication?: boolean;
	'max-memory'?: number;
	'new-window'?: boolean;
	'open-url'?: boolean;
	performance?: boolean;
	'prof-append-timers'?: string;
	'prof-startup'?: string;
	'prof-startup-prefix'?: string;
	'reuse-window'?: boolean;
	server?: string;
	'show-versions'?: boolean;
	'skip-add-to-recently-opened'?: boolean;
	'skip-getting-started'?: boolean;
	'skip-release-notes'?: boolean;
	status?: boolean;
	'sticky-quickopen'?: boolean;
	'uninstall-extension'?: string | string[];
	'unity-launch'?: boolean; // Always open a new window, except if opening the first window or opening a file or folder as part of the launch.
	'upload-logs'?: string;
	user?: string;
	'user-data-dir'?: string;
	_urls?: string[];
	verbose?: boolean;
	version?: boolean;
	wait?: boolean;
	waitMarkerFilePath?: string;
}
suite('commandLineService tests', () => {

	let capabilitiesService: CapabilitiesTestService;
	let commandLineService : CommandLineService;
	let environmentService : TypeMoq.Mock<EnvironmentService>;
	let queryEditorService : TypeMoq.Mock<QueryEditorService>;
	let editorService:TypeMoq.Mock<IEditorService>;
	let objectExplorerService : TypeMoq.Mock<ObjectExplorerService>;
	let connectionStore: TypeMoq.Mock<ConnectionStore>;

	setup(() => {
		capabilitiesService = new CapabilitiesTestService();
		connectionStore = TypeMoq.Mock.ofType(ConnectionStore);
	});

	function getCommandLineService(connectionManagementService : IConnectionManagementService,
		environmentService? : IEnvironmentService,
		capabilitiesService? : ICapabilitiesService
		) : CommandLineService
	{
		let service= new CommandLineService(
			connectionManagementService,
			capabilitiesService,
			environmentService,
			undefined,
			undefined,
			undefined
		);
		return service;
	}

	test('processCommandLine shows connection dialog by default', done => {
		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable();
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => false);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
		.verifiable(TypeMoq.Times.never());
		let service = getCommandLineService(connectionManagementService.object);
		service.processCommandLine();
		connectionManagementService.verifyAll();
		done();
	});

	test('processCommandLine does nothing if registered servers exist and no server name is provided', done => {
		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
		.verifiable(TypeMoq.Times.never());
		let service = getCommandLineService(connectionManagementService.object);
		service.processCommandLine();
		connectionManagementService.verifyAll();
		done();
	});

	test('processCommandLine opens a new connection if a server name is passed', done => {
		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		const environmentService : TypeMoq.Mock<IEnvironmentService> = TypeMoq.Mock.ofType<IEnvironmentService>(EnvironmentService);
		const args : TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		environmentService.setup(e => e.args).returns(() => args).verifiable(TypeMoq.Times.atLeastOnce());
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), 'connection'))
		.returns(() =>  new Promise<string>((resolve, reject) => { reject('unused');}))
		.verifiable(TypeMoq.Times.once());
		let service = getCommandLineService(connectionManagementService.object, environmentService.object, capabilitiesService);
		service.processCommandLine();
		environmentService.verifyAll();
		connectionManagementService.verifyAll();
		done();
	});
});
