/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestConnectionDialogService } from 'sql/workbench/services/connection/test/common/testConnectionDialogService';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { ConnectionStatusManager } from 'sql/platform/connection/common/connectionStatusManager';
import { ConnectionStore } from 'sql/platform/connection/common/connectionStore';
import {
	INewConnectionParams, ConnectionType,
	IConnectionCompletionOptions, IConnectionResult, IConnectionParams,
	RunQueryOnConnectionMode
} from 'sql/platform/connection/common/connectionManagement';
import * as Constants from 'sql/platform/connection/common/constants';
import * as Utils from 'sql/platform/connection/common/utils';
import { IHandleFirewallRuleResult } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { TestConnectionProvider } from 'sql/platform/connection/test/common/testConnectionProvider';
import { TestResourceProvider } from 'sql/workbench/services/resourceProvider/test/common/testResourceProviderService';

import * as azdata from 'azdata';

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import { IConnectionProfileGroup, ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestAccountManagementService } from 'sql/platform/accounts/test/common/testAccountManagementService';
import { TestEnvironmentService, TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { TestInstantiationService } from 'sql/platform/instantiation/test/common/instantiationServiceMock';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

suite('SQL ConnectionManagementService tests', () => {

	let capabilitiesService: TestCapabilitiesService;
	let connectionDialogService: TypeMoq.Mock<TestConnectionDialogService>;
	let connectionStore: TypeMoq.Mock<ConnectionStore>;
	let workbenchEditorService: TypeMoq.Mock<TestEditorService>;
	let connectionStatusManager: ConnectionStatusManager;
	let mssqlConnectionProvider: TypeMoq.Mock<TestConnectionProvider>;
	let workspaceConfigurationServiceMock: TypeMoq.Mock<TestConfigurationService>;
	let resourceProviderStubMock: TypeMoq.Mock<TestResourceProvider>;
	let accountManagementService: TypeMoq.Mock<TestAccountManagementService>;

	let none: void;

	let connectionProfile: IConnectionProfile = {
		connectionName: 'new name',
		serverName: 'new server',
		databaseName: 'database',
		userName: 'user',
		password: 'password',
		authenticationType: 'integrated',
		savePassword: true,
		groupFullName: 'g2/g2-2',
		groupId: 'group id',
		getOptionsKey: () => { return 'connectionId'; },
		matches: undefined,
		providerName: 'MSSQL',
		options: {},
		saveProfile: true,
		id: undefined
	};
	let connectionProfileWithEmptySavedPassword: IConnectionProfile =
		Object.assign({}, connectionProfile, { password: '', serverName: connectionProfile.serverName + 1 });
	let connectionProfileWithEmptyUnsavedPassword: IConnectionProfile =
		Object.assign({}, connectionProfile, { password: '', serverName: connectionProfile.serverName + 2, savePassword: false });

	let connectionManagementService: ConnectionManagementService;
	let configResult: { [key: string]: any } = {};
	configResult['defaultEngine'] = 'MSSQL';
	let queryEditorConfiguration: Partial<IQueryEditorConfiguration> = {
		tabColorMode: 'fill'
	};

	let handleFirewallRuleResult: IHandleFirewallRuleResult;
	let resolveHandleFirewallRuleDialog: boolean;
	let isFirewallRuleAdded: boolean;

	setup(() => {

		capabilitiesService = new TestCapabilitiesService();
		connectionDialogService = TypeMoq.Mock.ofType(TestConnectionDialogService);
		connectionStore = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
		workbenchEditorService = TypeMoq.Mock.ofType(TestEditorService);
		connectionStatusManager = new ConnectionStatusManager(capabilitiesService, new NullLogService(), TestEnvironmentService, new TestNotificationService());
		mssqlConnectionProvider = TypeMoq.Mock.ofType(TestConnectionProvider);
		let resourceProviderStub = new TestResourceProvider();
		resourceProviderStubMock = TypeMoq.Mock.ofInstance(resourceProviderStub);
		accountManagementService = TypeMoq.Mock.ofType(TestAccountManagementService);
		let root = new ConnectionProfileGroup(ConnectionProfileGroup.RootGroupName, undefined, ConnectionProfileGroup.RootGroupName, undefined, undefined);
		root.connections = [ConnectionProfile.fromIConnectionProfile(capabilitiesService, connectionProfile)];

		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, undefined)).returns(() => Promise.resolve(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny())).returns(() => Promise.resolve(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, undefined, TypeMoq.It.isAny())).returns(() => Promise.resolve(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, undefined, undefined)).returns(() => Promise.resolve(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined)).returns(() => Promise.resolve(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(none));

		connectionStore.setup(x => x.addRecentConnection(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		connectionStore.setup(x => x.saveProfile(TypeMoq.It.is(profile => true), TypeMoq.It.is(x => true), TypeMoq.It.is(x => true))).returns(profile => Promise.resolve(profile));
		workbenchEditorService.setup(x => x.openEditor(undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is<IConnectionProfile>(
			c => c.serverName === connectionProfile.serverName))).returns(() => Promise.resolve({ profile: connectionProfile, savedCred: true }));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is<IConnectionProfile>(
			c => c.serverName === connectionProfileWithEmptySavedPassword.serverName))).returns(
				() => Promise.resolve({ profile: connectionProfileWithEmptySavedPassword, savedCred: true }));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is<IConnectionProfile>(
			c => c.serverName === connectionProfileWithEmptyUnsavedPassword.serverName))).returns(
				() => Promise.resolve({ profile: connectionProfileWithEmptyUnsavedPassword, savedCred: false }));
		connectionStore.setup(x => x.isPasswordRequired(TypeMoq.It.isAny())).returns(() => true);
		connectionStore.setup(x => x.getConnectionProfileGroups(false, undefined)).returns(() => [root]);
		connectionStore.setup(x => x.savePassword(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));

		mssqlConnectionProvider.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => undefined);

		// Setup resource provider
		handleFirewallRuleResult = {
			canHandleFirewallRule: false,
			ipAddress: '123.123.123.123',
			resourceProviderId: 'Azure'
		};
		resourceProviderStubMock.setup(x => x.handleFirewallRule(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(handleFirewallRuleResult));

		resolveHandleFirewallRuleDialog = true;
		isFirewallRuleAdded = true;
		resourceProviderStubMock.setup(x => x.showFirewallRuleDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => {
				if (resolveHandleFirewallRuleDialog) {
					return isFirewallRuleAdded ? Promise.resolve(true) : Promise.resolve(false);
				} else {
					return Promise.reject(null).then();
				}
			});

		// Setup configuration to return a config that can be modified later.
		workspaceConfigurationServiceMock = TypeMoq.Mock.ofType(TestConfigurationService);
		workspaceConfigurationServiceMock.setup(x => x.getValue(Constants.sqlConfigSectionName))
			.returns(() => configResult);
		workspaceConfigurationServiceMock.setup(x => x.getValue('queryEditor'))
			.returns(() => queryEditorConfiguration);

		connectionManagementService = createConnectionManagementService();

		connectionManagementService.registerProvider('MSSQL', mssqlConnectionProvider.object);
	});

	function createConnectionManagementService(): ConnectionManagementService {
		const testInstantiationService = new TestInstantiationService();
		const testLogService = new NullLogService();
		testInstantiationService.stub(IStorageService, new TestStorageService());
		testInstantiationService.stub(ICapabilitiesService, capabilitiesService);
		testInstantiationService.stub(ILogService, testLogService);
		testInstantiationService.stubCreateInstance(ConnectionStore, connectionStore.object);

		let connectionManagementService = new ConnectionManagementService(
			connectionDialogService.object,
			testInstantiationService,
			workbenchEditorService.object,
			new NullAdsTelemetryService(), // ITelemetryService
			workspaceConfigurationServiceMock.object,
			capabilitiesService,
			undefined, // IQuickInputService
			new TestNotificationService(),
			resourceProviderStubMock.object,
			undefined, // IAngularEventingService
			accountManagementService.object,
			testLogService, // ILogService
			undefined, // IStorageService
			getBasicExtensionService()
		);
		return connectionManagementService;
	}

	function verifyShowConnectionDialog(connectionProfile: IConnectionProfile, connectionType: ConnectionType, uri: string, options: boolean, connectionResult?: IConnectionResult, didShow: boolean = true): void {
		if (connectionProfile) {
			connectionDialogService.verify(x => x.showDialog(
				TypeMoq.It.isAny(),
				TypeMoq.It.is<INewConnectionParams>(p => p.connectionType === connectionType && (uri === undefined || p.input.uri === uri)),
				TypeMoq.It.is<IConnectionProfile>(c => c !== undefined && c.serverName === connectionProfile.serverName),
				connectionResult ? TypeMoq.It.is<IConnectionResult>(r => r.errorMessage === connectionResult.errorMessage && r.callStack === connectionResult.callStack) : undefined,
				options ? TypeMoq.It.isAny() : undefined),
				didShow ? TypeMoq.Times.once() : TypeMoq.Times.never());

		} else {
			connectionDialogService.verify(x => x.showDialog(
				TypeMoq.It.isAny(),
				TypeMoq.It.is<INewConnectionParams>(p => p.connectionType === connectionType && ((uri === undefined && p.input === undefined) || p.input.uri === uri)),
				undefined,
				connectionResult ? TypeMoq.It.is<IConnectionResult>(r => r.errorMessage === connectionResult.errorMessage && r.callStack === connectionResult.callStack) : undefined,
				options ? TypeMoq.It.isAny() : undefined),
				didShow ? TypeMoq.Times.once() : TypeMoq.Times.never());
		}
	}

	function verifyShowFirewallRuleDialog(connectionProfile: IConnectionProfile, didShow: boolean = true): void {
		resourceProviderStubMock.verify(x => x.showFirewallRuleDialog(
			TypeMoq.It.is<IConnectionProfile>(c => c.serverName === connectionProfile.serverName),
			TypeMoq.It.isAny(),
			TypeMoq.It.isAny()),
			didShow ? TypeMoq.Times.once() : TypeMoq.Times.never());
	}

	function verifyOptions(options?: IConnectionCompletionOptions, fromDialog?: boolean): void {

		if (options) {
			if (options.saveTheConnection) {
				connectionStore.verify(x => x.saveProfile(TypeMoq.It.is(profile => true), TypeMoq.It.is(x => true), TypeMoq.It.is(x => true)), TypeMoq.Times.once());
			}
			if (options.showDashboard) {
				workbenchEditorService.verify(x => x.openEditor(undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			}
		}

		if (fromDialog !== undefined && !fromDialog) {
			connectionStore.verify(x => x.addSavedPassword(TypeMoq.It.isAny()), TypeMoq.Times.once());
		}

	}

	async function connect(uri: string, options?: IConnectionCompletionOptions, fromDialog?: boolean, connection?: IConnectionProfile, error?: string, errorCode?: number, errorCallStack?: string, serverInfo?: azdata.ServerInfo): Promise<IConnectionResult> {
		let connectionToUse = connection ? connection : connectionProfile;
		let id = connectionToUse.getOptionsKey();
		let defaultUri = 'connection:' + (id ? id : connectionToUse.serverName + ':' + connectionToUse.databaseName);
		connectionManagementService.onConnectionRequestSent(() => {
			let info: azdata.ConnectionInfoSummary = {
				connectionId: error ? undefined : 'id',
				connectionSummary: {
					databaseName: connectionToUse.databaseName,
					serverName: connectionToUse.serverName,
					userName: connectionToUse.userName
				},
				errorMessage: error,
				errorNumber: errorCode,
				messages: errorCallStack,
				ownerUri: uri ? uri : defaultUri,
				serverInfo: serverInfo
			};
			connectionManagementService.onConnectionComplete(0, info);
		});
		await connectionManagementService.cancelConnectionForUri(uri);
		if (fromDialog) {
			return connectionManagementService.connectAndSaveProfile(connectionToUse, uri, options);
		} else {
			return connectionManagementService.connect(connectionToUse, uri, options);
		}
	}

	test('showConnectionDialog should open the dialog with default type given no parameters', async () => {
		await connectionManagementService.showConnectionDialog();
		verifyShowConnectionDialog(undefined, ConnectionType.default, undefined, false);
	});

	test('showConnectionDialog should open the dialog with given type given valid input', async () => {
		let params: INewConnectionParams = {
			connectionType: ConnectionType.editor,
			input: {
				onConnectReject: undefined,
				onConnectStart: undefined,
				onDisconnect: undefined,
				onConnectSuccess: undefined,
				onConnectCanceled: undefined,
				uri: 'Editor Uri'
			},
			runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery
		};
		await connectionManagementService.showConnectionDialog(params);
		verifyShowConnectionDialog(undefined, params.connectionType, params.input.uri, false);

	});

	test('showConnectionDialog should pass the model to the dialog if there is a model assigned to the uri', async () => {
		let params: INewConnectionParams = {
			connectionType: ConnectionType.editor,
			input: {
				onConnectReject: undefined,
				onConnectStart: undefined,
				onDisconnect: undefined,
				onConnectSuccess: undefined,
				onConnectCanceled: undefined,
				uri: 'Editor Uri'
			},
			runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery
		};

		await connect(params.input.uri);
		let saveConnection = connectionManagementService.getConnectionProfile(params.input.uri);

		assert.notEqual(saveConnection, undefined, `profile was not added to the connections`);
		assert.strictEqual(saveConnection.serverName, connectionProfile.serverName, `Server names are different`);
		await connectionManagementService.showConnectionDialog(params);
		verifyShowConnectionDialog(connectionProfile, params.connectionType, params.input.uri, false);
	});

	test('showConnectionDialog should not be called when using showEditConnectionDialog', async () => {
		await connectionManagementService.showEditConnectionDialog(connectionProfile);
		verifyShowConnectionDialog(connectionProfile, ConnectionType.default, undefined, false, undefined, false);
	});

	test('connect should save profile given options with saveProfile set to true', async () => {
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};

		await connect(uri, options);
		verifyOptions(options);
	});

	test('getDefaultProviderId is MSSQL', () => {
		let defaultProvider = connectionManagementService.getDefaultProviderId();
		assert.strictEqual(defaultProvider, 'MSSQL', `Default provider is not equal to MSSQL`);
	});

	/* Andresse  10/5/17 commented this test out since it was only working before my changes by the chance of how Promises work
		If we want to continue to test this, the connection logic needs to be rewritten to actually wait for everything to be done before it resolves */
	// test('connect should show dashboard given options with showDashboard set to true', async () => {
	// 	let uri: string = 'Editor Uri';
	// 	let options: IConnectionCompletionOptions = {
	// 		params: undefined,
	// 		saveTheConnection: false,
	// 		showDashboard: true,
	// 		showConnectionDialogOnError: false,
	// 		showFirewallRuleOnError: false
	// 	};

	// 	await connect(uri, options);
	// 	verifyOptions(options);
	// });

	test('connect should pass the params in options to onConnectSuccess callback', async () => {
		let uri: string = 'Editor Uri';
		let paramsInOnConnectSuccess: INewConnectionParams;
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: (params?: INewConnectionParams) => {
						paramsInOnConnectSuccess = params;
					},
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options);
		verifyOptions(options);
		assert.notEqual(paramsInOnConnectSuccess, undefined);
		assert.strictEqual(paramsInOnConnectSuccess.connectionType, options.params.connectionType);
	});

	test('connectAndSaveProfile should show not load the password', async () => {
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = undefined;

		await connect(uri, options, true);
		verifyOptions(options, true);
	});

	test('connect with undefined uri and options should connect using the default uri', async () => {
		let uri = undefined;
		let options: IConnectionCompletionOptions = undefined;

		await connect(uri, options);
		assert.strictEqual(connectionManagementService.isProfileConnected(connectionProfile), true);
	});

	test('failed connection should open the dialog if connection fails', async () => {
		let uri = undefined;
		let error: string = 'error';
		let errorCode: number = 111;
		let errorCallStack: string = 'error call stack';
		let expectedConnection: boolean = false;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: error,
			errorCode: errorCode,
			callStack: errorCallStack
		};

		let result = await connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, connectionResult.errorMessage);
		verifyShowFirewallRuleDialog(connectionProfile, false);
		verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult);
	});

	test('failed connection should not open the dialog if the option is set to false even if connection fails', async () => {
		let uri = undefined;
		let error: string = 'error when options set to false';
		let errorCode: number = 111;
		let errorCallStack: string = 'error call stack';
		let expectedConnection: boolean = false;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: error,
			errorCode: errorCode,
			callStack: errorCallStack
		};

		let result = await connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, connectionResult.errorMessage);
		verifyShowFirewallRuleDialog(connectionProfile, false);
		verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, false);
	});

	test('Accessors for event emitters should return emitter function', () => {
		let onAddConnectionProfile1 = connectionManagementService.onAddConnectionProfile;
		assert.strictEqual(typeof (onAddConnectionProfile1), 'function');
		let onDeleteConnectionProfile1 = connectionManagementService.onDeleteConnectionProfile;
		assert.strictEqual(typeof (onDeleteConnectionProfile1), 'function');
		let onConnect1 = connectionManagementService.onConnect;
		assert.strictEqual(typeof (onConnect1), 'function');
	});

	test('onConnectionChangedNotification should call onConnectionChanged event', async () => {
		let uri = 'Test Uri';
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};

		await connect(uri, options);
		let saveConnection = connectionManagementService.getConnectionProfile(uri);
		let changedConnectionInfo: azdata.ChangedConnectionInfo = { connectionUri: uri, connection: saveConnection };
		let called = false;
		connectionManagementService.onConnectionChanged((params: IConnectionParams) => {
			assert.strictEqual(uri, params.connectionUri);
			assert.strictEqual(saveConnection, params.connectionProfile);
			called = true;
		});
		connectionManagementService.onConnectionChangedNotification(0, changedConnectionInfo);
		assert.ok(called, 'expected onConnectionChanged event to be sent');
	});

	test('changeGroupIdForconnection should change the groupId for a connection profile', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		let newGroupId = 'new_group_id';
		connectionStore.setup(x => x.changeGroupIdForConnection(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		await connectionManagementService.changeGroupIdForConnection(profile, newGroupId);
		assert.strictEqual(profile.groupId, newGroupId);
	});

	test('changeGroupIdForConnectionGroup should call changeGroupIdForConnectionGroup in ConnectionStore', async () => {
		let sourceProfileGroup = createConnectionGroup('original_id');
		let targetProfileGroup = createConnectionGroup('new_id');
		let called = false;
		connectionStore.setup(x => x.changeGroupIdForConnectionGroup(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
			called = true;
			return Promise.resolve();
		});
		await connectionManagementService.changeGroupIdForConnectionGroup(sourceProfileGroup, targetProfileGroup);
		assert.ok(called, 'expected changeGroupIdForConnectionGroup to be called on ConnectionStore');
	});

	test('findExistingConnection should find connection for connectionProfile with same info', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri1 = 'connection:connectionId';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri1,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};
		let connectionInfoString = 'providerName:' + profile.providerName + '|authenticationType:'
			+ profile.authenticationType + '|databaseName:' + profile.databaseName + '|serverName:'
			+ profile.serverName + '|userName:' + profile.userName;
		await connect(uri1, options, true, profile);
		let returnedProfile = connectionManagementService.findExistingConnection(profile);
		assert.strictEqual(returnedProfile.getConnectionInfoId(), connectionInfoString);
	});

	test('deleteConnection should delete the connection properly', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri1 = 'connection:connectionId';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri1,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		connectionStore.setup(x => x.deleteConnectionFromConfiguration(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		// deleteConnection should work for profile not connected.
		assert(connectionManagementService.deleteConnection(profile));
		await connect(uri1, options, true, profile);
		assert(connectionManagementService.deleteConnection(profile));
	});

	test('deleteConnectionGroup should delete connections in connection group', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let profileGroup = createConnectionGroup('original_id');
		profileGroup.addConnections([profile]);
		let uri1 = 'connection:connectionId';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri1,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		connectionStore.setup(x => x.deleteGroupFromConfiguration(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		await connect(uri1, options, true, profile);
		let result = await connectionManagementService.deleteConnectionGroup(profileGroup);
		assert(result);
	});

	test('canChangeConnectionConfig returns true when connection can be moved to another group', () => {
		connectionStore.setup(x => x.canChangeConnectionConfig(TypeMoq.It.isAny(), TypeMoq.It.isAnyString())).returns(() => {
			return true;
		});
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let newGroupId = 'test_group_id';
		assert(connectionManagementService.canChangeConnectionConfig(profile, newGroupId));
	});

	test('isProfileConnecting should return false for already connected profile', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'Editor Uri';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options, true, profile);
		assert(!connectionManagementService.isProfileConnecting(profile));
	});

	test('disconnect should disconnect the profile when given ConnectionProfile', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options, true, profile);
		await connectionManagementService.disconnect(profile);
		assert(!connectionManagementService.isProfileConnected(profile));
	});

	test('disconnect should disconnect the profile when given uri string', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options, true, profile);
		await connectionManagementService.disconnect(uri);
		assert(!connectionManagementService.isProfileConnected(profile));
	});

	test('cancelConnection should disconnect the profile', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options, true, profile);
		await connectionManagementService.cancelConnection(profile);
		assert(!connectionManagementService.isConnected(undefined, profile));
	});

	test('cancelEditorConnection should not delete editor connection when already connected', async () => {
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options);
		let result = await connectionManagementService.cancelEditorConnection(options.params.input);
		assert.strictEqual(result, false);
		assert(connectionManagementService.isConnected(uri));
	});

	test('getConnection should grab connection that is connected', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let badString = 'bad_string';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options, true, profile);
		// invalid uri check.
		assert.strictEqual(connectionManagementService.getConnection(badString), undefined);
		let returnedProfile = connectionManagementService.getConnection(uri);
		assert.strictEqual(returnedProfile.groupFullName, profile.groupFullName);
		assert.strictEqual(returnedProfile.groupId, profile.groupId);
	});

	test('connectIfNotConnected should not try to connect with already connected profile', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options, true, profile);
		let result = await connectionManagementService.connectIfNotConnected(profile, undefined, true);
		assert.strictEqual(result, uri);
	});

	test('getServerInfo should return undefined when given an invalid string', () => {
		let badString = 'bad_string';
		assert.strictEqual(connectionManagementService.getServerInfo(badString), undefined);
	});

	test('getConnectionString should get connection string of connectionId', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let badString = 'bad_string';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let getConnectionResult = await connectionManagementService.getConnectionString(badString);
		// test for invalid profile id
		assert.strictEqual(getConnectionResult, undefined);
		await connect(uri, options, true, profile);
		let currentConnections = connectionManagementService.getConnections(true);
		let profileId = currentConnections[0].id;
		let testConnectionString = 'test_connection_string';
		mssqlConnectionProvider.setup(x => x.getConnectionString(uri, false)).returns(() => {
			return Promise.resolve(testConnectionString);
		});
		getConnectionResult = await connectionManagementService.getConnectionString(profileId, false);
		assert(getConnectionResult, testConnectionString);
	});


	test('rebuildIntellisenseCache should call rebuildIntelliSenseCache on provider', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let cacheRebuilt = false;
		mssqlConnectionProvider.setup(x => x.rebuildIntelliSenseCache(uri)).returns(() => {
			cacheRebuilt = true;
			return Promise.resolve();
		});
		await assert.rejects(async () => await connectionManagementService.rebuildIntelliSenseCache(uri));
		await connect(uri, options, true, profile);
		await connectionManagementService.rebuildIntelliSenseCache(uri);
		assert(cacheRebuilt);
	});

	test('buildConnectionInfo should get connection string of connectionId', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let providerName = 'MSSQL';
		let testConnectionString = 'test_connection_string';
		mssqlConnectionProvider.setup(x => x.buildConnectionInfo('test_connection_string')).returns(() => {
			let ConnectionInfo: azdata.ConnectionInfo = { options: options };
			return Promise.resolve(ConnectionInfo);
		});
		await connect(uri, options, true, profile);
		let result = await connectionManagementService.buildConnectionInfo(testConnectionString, providerName);
		assert.strictEqual(result.options, options);
	});

	test('removeConnectionProfileCredentials should return connection profile without password', () => {
		let profile = Object.assign({}, connectionProfile);
		connectionStore.setup(x => x.getProfileWithoutPassword(TypeMoq.It.isAny())).returns(() => {
			let profileWithoutPass = Object.assign({}, connectionProfile);
			profileWithoutPass.password = undefined;
			return <ConnectionProfile>profileWithoutPass;
		});
		let clearedProfile = connectionManagementService.removeConnectionProfileCredentials(profile);
		assert.strictEqual(clearedProfile.password, undefined);
	});

	test('getConnectionProfileById should return profile when given profileId', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let uri = 'connection:connectionId'; // must use default connection uri for test to work.
		let badString = 'bad_string';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};
		let result = await connect(uri, options, true, profile);
		assert.strictEqual(result.connected, true);
		assert.strictEqual(connectionManagementService.getConnectionProfileById(badString), undefined);
		let currentConnections = connectionManagementService.getConnections(true);
		let profileId = currentConnections[0].id;
		let returnedProfile = connectionManagementService.getConnectionProfileById(profileId);
		assert.strictEqual(returnedProfile.groupFullName, profile.groupFullName);
		assert.strictEqual(returnedProfile.groupId, profile.groupId);
	});

	test('Edit Connection - Changing connection profile name for same URI should persist after edit', async () => {
		let profile = Object.assign({}, connectionProfile);
		let uri1 = 'test_uri1';
		let newname = 'connection renamed';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri1,
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri1, options, true, profile);
		let newProfile = Object.assign({}, connectionProfile);
		newProfile.connectionName = newname;
		options.params.isEditConnection = true;
		await connect(uri1, options, true, newProfile);
		assert.strictEqual(connectionManagementService.getConnectionProfile(uri1).connectionName, newname);
	});

	test('Edit Connection - Connecting a different URI with same profile via edit should not change profile ID.', async () => {
		let uri1 = 'test_uri1';
		let uri2 = 'test_uri2';
		let profile = Object.assign({}, connectionProfile);
		profile.id = '0451';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri1
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none,
				isEditConnection: false
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri1, options, true, profile);
		options.params.isEditConnection = true;
		await connect(uri2, options, true, profile);
		let uri1info = connectionManagementService.getConnectionInfo(uri1);
		let uri2info = connectionManagementService.getConnectionInfo(uri2);
		assert.strictEqual(uri1info.connectionProfile.id, uri2info.connectionProfile.id);
	});


	test('failed firewall rule should open the firewall rule dialog', async () => {
		handleFirewallRuleResult.canHandleFirewallRule = true;
		resolveHandleFirewallRuleDialog = true;
		isFirewallRuleAdded = true;

		let uri = undefined;
		let error: string = 'error';
		let errorCode: number = 111;
		let expectedConnection: boolean = false;
		let expectedError: string = error;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let result = await connect(uri, options, false, connectionProfile, error, errorCode);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, expectedError);
		verifyShowFirewallRuleDialog(connectionProfile, true);
	});

	test('failed firewall rule connection should not open the firewall rule dialog if the option is set to false even if connection fails', async () => {
		handleFirewallRuleResult.canHandleFirewallRule = true;
		resolveHandleFirewallRuleDialog = true;
		isFirewallRuleAdded = true;

		let uri = undefined;
		let error: string = 'error when options set to false';
		let errorCallStack: string = 'error call stack';
		let errorCode: number = 111;
		let expectedConnection: boolean = false;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: false
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: error,
			errorCode: errorCode,
			callStack: errorCallStack
		};

		let result = await connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, connectionResult.errorMessage);
		verifyShowFirewallRuleDialog(connectionProfile, false);
		verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, false);
	});

	test('hasRegisteredServers should return true as there is one registered server', () => {
		assert(connectionManagementService.hasRegisteredServers());
	});

	test('getConnectionIconId should return undefined as there is no mementoObj service', () => {
		let connectionId = 'connection:connectionId';
		assert.strictEqual(connectionManagementService.getConnectionIconId(connectionId), undefined);
	});

	test('getAdvancedProperties should return a list of properties for connectionManagementService', () => {
		let propertyNames = ['connectionName', 'serverName', 'databaseName', 'userName', 'authenticationType', 'password'];
		let advancedProperties = connectionManagementService.getAdvancedProperties();
		assert.strictEqual(propertyNames[0], advancedProperties[0].name);
		assert.strictEqual(propertyNames[1], advancedProperties[1].name);
		assert.strictEqual(propertyNames[2], advancedProperties[2].name);
		assert.strictEqual(propertyNames[3], advancedProperties[3].name);
		assert.strictEqual(propertyNames[4], advancedProperties[4].name);
		assert.strictEqual(propertyNames[5], advancedProperties[5].name);
	});

	test('saveProfileGroup should return groupId from connection group', async () => {
		let newConnectionGroup = createConnectionGroup(connectionProfile.groupId);
		connectionStore.setup(x => x.saveProfileGroup(TypeMoq.It.isAny())).returns(() => Promise.resolve(connectionProfile.groupId));
		let result = await connectionManagementService.saveProfileGroup(newConnectionGroup);
		assert.strictEqual(result, connectionProfile.groupId);
	});

	test('editGroup should fire onAddConnectionProfile', async () => {
		let newConnectionGroup = createConnectionGroup(connectionProfile.groupId);
		let called = false;
		connectionStore.setup(x => x.editGroup(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		connectionManagementService.onAddConnectionProfile(() => {
			called = true;
		});
		await connectionManagementService.editGroup(newConnectionGroup);
		assert(called);
	});

	test('getFormattedUri should return formatted uri when given default type uri or already formatted uri', () => {
		let testUri = 'connection:';
		let formattedUri = 'connection:connectionId';
		let badUri = 'bad_uri';
		assert.strictEqual(formattedUri, connectionManagementService.getFormattedUri(testUri, connectionProfile));
		assert.strictEqual(formattedUri, connectionManagementService.getFormattedUri(formattedUri, connectionProfile));
		// test for invalid URI
		assert.strictEqual(badUri, connectionManagementService.getFormattedUri(badUri, connectionProfile));
	});

	test('failed firewall rule connection and failed during open firewall rule should open the firewall rule dialog and connection dialog with error', async () => {
		handleFirewallRuleResult.canHandleFirewallRule = true;
		resolveHandleFirewallRuleDialog = true;
		isFirewallRuleAdded = true;

		let uri = undefined;
		let error: string = 'error when options set to false';
		let errorCode: number = 111;
		let errorCallStack: string = 'error call stack';
		let expectedConnection: boolean = false;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: error,
			errorCode: errorCode,
			callStack: errorCallStack
		};

		let result = await connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, connectionResult.errorMessage);
		verifyShowFirewallRuleDialog(connectionProfile, true);
		verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, true);
	});

	test('failed firewall rule connection should open the firewall rule dialog. Then canceled firewall rule dialog should not open connection dialog', async () => {
		handleFirewallRuleResult.canHandleFirewallRule = true;
		resolveHandleFirewallRuleDialog = true;
		isFirewallRuleAdded = false;

		let uri = undefined;
		let error: string = 'error when options set to false';
		let errorCallStack: string = 'error call stack';
		let errorCode: number = 111;
		let expectedConnection: boolean = false;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: error,
			errorCode: errorCode,
			callStack: errorCallStack
		};

		let result = await connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack);
		assert.strictEqual(result, undefined);
		verifyShowFirewallRuleDialog(connectionProfile, true);
		verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, false);
	});

	test('connect when password is empty and unsaved should open the dialog', async () => {
		let uri = undefined;
		let expectedConnection: boolean = false;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: undefined,
			errorCode: undefined,
			callStack: undefined
		};

		let result = await connect(uri, options, false, connectionProfileWithEmptyUnsavedPassword);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, connectionResult.errorMessage);
		verifyShowConnectionDialog(connectionProfileWithEmptyUnsavedPassword, ConnectionType.default, uri, true, connectionResult);
		verifyShowFirewallRuleDialog(connectionProfile, false);
	});

	test('connect when password is empty and saved should not open the dialog', async () => {
		let uri = undefined;
		let expectedConnection: boolean = true;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: undefined,
			errorCode: undefined,
			callStack: undefined
		};

		let result = await connect(uri, options, false, connectionProfileWithEmptySavedPassword);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, connectionResult.errorMessage);
		verifyShowConnectionDialog(connectionProfileWithEmptySavedPassword, ConnectionType.default, uri, true, connectionResult, false);
	});

	test('connect from editor when empty password when it is required and saved should not open the dialog', async () => {
		let uri = 'editor 3';
		let expectedConnection: boolean = true;
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let connectionResult: IConnectionResult = {
			connected: expectedConnection,
			errorMessage: undefined,
			errorCode: undefined,
			callStack: undefined
		};

		let result = await connect(uri, options, false, connectionProfileWithEmptySavedPassword);
		assert.strictEqual(result.connected, expectedConnection);
		assert.strictEqual(result.errorMessage, connectionResult.errorMessage);
		verifyShowConnectionDialog(connectionProfileWithEmptySavedPassword, ConnectionType.editor, uri, true, connectionResult, false);
	});

	test('disconnect editor should disconnect uri from connection', async () => {
		let uri = 'editor to remove';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: () => { },
					onConnectCanceled: undefined,
					uri: uri
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		await connect(uri, options, false, connectionProfileWithEmptySavedPassword);
		let result = await connectionManagementService.disconnectEditor(options.params.input);
		assert(result);
	});

	test('registerIconProvider should register icon provider for connectionManagementService', async () => {
		let profile = <ConnectionProfile>Object.assign({}, connectionProfile);
		let serverInfo: azdata.ServerInfo = {
			serverMajorVersion: 0,
			serverMinorVersion: 0,
			serverReleaseVersion: 0,
			engineEditionId: 0,
			serverVersion: 'test_version',
			serverLevel: 'test_level',
			serverEdition: 'test_edition',
			azureVersion: 0,
			osVersion: 'test_version',
			options: { isBigDataCluster: 'test' },
			isCloud: true,
			cpuCount: 0,
			physicalMemoryInMb: 0
		};
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = {
			params: {
				connectionType: ConnectionType.editor,
				input: {
					onConnectSuccess: undefined,
					onConnectReject: undefined,
					onConnectStart: undefined,
					onDisconnect: undefined,
					onConnectCanceled: undefined,
					uri: uri
				},
				queryRange: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		let called = false;
		let mockIconProvider: azdata.IconProvider = {
			providerId: Constants.mssqlProviderName,
			handle: 0,
			getConnectionIconId(connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string> {
				let iconName: string = undefined;
				if (connection.providerName === 'MSSQL') {
					if (serverInfo.isCloud) {
						iconName = 'mssql:cloud';
					} else if (serverInfo.options['isBigDataCluster']) {
						iconName = 'mssql:cluster';
					}
				}
				called = true;
				return Promise.resolve(iconName);
			}
		};
		connectionManagementService.registerIconProvider('MSSQL', mockIconProvider);
		await connect(uri, options, true, profile, undefined, undefined, undefined, serverInfo);
		assert(called);
	});

	test('getProviderProperties should return properties of a provider in ConnectionManagementService', () => {
		let mssqlId = 'MSSQL';
		let pgsqlId = 'PGSQL';
		let mssqlProperties = connectionManagementService.getProviderProperties('MSSQL');
		let pgsqlProperties = connectionManagementService.getProviderProperties('PGSQL');
		assert.strictEqual(mssqlProperties.providerId, mssqlId);
		assert.strictEqual(pgsqlProperties.providerId, pgsqlId);
	});

	test('doChangeLanguageFlavor should throw on unknown provider', () => {
		// given a provider that will never exist
		let invalidProvider = 'notaprovider';
		// when I call doChangeLanguageFlavor
		// Then I expect it to throw
		assert.throws(() => connectionManagementService.doChangeLanguageFlavor('file://my.sql', 'sql', invalidProvider));
	});

	test('doChangeLanguageFlavor should send event for known provider', () => {
		// given a provider that is registered
		let uri = 'file://my.sql';
		let language = 'sql';
		let flavor = 'MSSQL';
		// when I call doChangeLanguageFlavor
		let called = false;
		connectionManagementService.onLanguageFlavorChanged((changeParams: azdata.DidChangeLanguageFlavorParams) => {
			called = true;
			assert.strictEqual(changeParams.uri, uri);
			assert.strictEqual(changeParams.language, language);
			assert.strictEqual(changeParams.flavor, flavor);
		});
		connectionManagementService.doChangeLanguageFlavor(uri, language, flavor);
		assert.ok(called, 'expected onLanguageFlavorChanged event to be sent');
	});


	test('getUniqueConnectionProvidersByNameMap should return non CMS providers', () => {
		let nameToDisplayNameMap: { [providerDisplayName: string]: string } = { 'MSSQL': 'SQL Server', 'MSSQL-CMS': 'SQL Server' };
		let providerNames = Object.keys(connectionManagementService.getUniqueConnectionProvidersByNameMap(nameToDisplayNameMap));
		assert.strictEqual(providerNames.length, 1);
		assert.strictEqual(providerNames[0], 'MSSQL');
	});

	test('providerNameToDisplayNameMap should return all providers', () => {
		let expectedNames = ['MSSQL', 'PGSQL', 'FAKE'];
		let providerNames = Object.keys(connectionManagementService.providerNameToDisplayNameMap);
		assert.strictEqual(providerNames.length, 3);
		assert.strictEqual(providerNames[0], expectedNames[0]);
		assert.strictEqual(providerNames[1], expectedNames[1]);
		assert.strictEqual(providerNames[2], expectedNames[2]);
	});

	test('ensureDefaultLanguageFlavor should send event if uri is not connected', () => {
		let uri: string = 'Test Uri';
		let called = false;
		connectionManagementService.onLanguageFlavorChanged((changeParams: azdata.DidChangeLanguageFlavorParams) => {
			called = true;
		});
		connectionManagementService.ensureDefaultLanguageFlavor(uri);
		assert(called);
	});

	test('ensureDefaultLanguageFlavor should not send event if uri is connected', async () => {
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};
		let called = false;
		connectionManagementService.onLanguageFlavorChanged((changeParams: azdata.DidChangeLanguageFlavorParams) => {
			called = true;
		});
		await connect(uri, options);
		called = false; //onLanguageFlavorChanged is called when connecting, must set back to false.
		connectionManagementService.ensureDefaultLanguageFlavor(uri);
		assert.strictEqual(called, false, 'do not expect flavor change to be called');
	});

	test('getConnectionId returns the URI associated with a connection that has had its database filled in', async () => {
		// Set up the connection management service with a connection corresponding to a default database
		let dbName = 'master';
		let serverName = 'test_server';
		let userName = 'test_user';
		let connectionProfileWithoutDb: IConnectionProfile = Object.assign(connectionProfile,
			{ serverName: serverName, databaseName: '', userName: userName, getOptionsKey: () => undefined });
		let connectionProfileWithDb: IConnectionProfile = Object.assign(connectionProfileWithoutDb, { databaseName: dbName });
		// Save the database with a URI that has the database name filled in, to mirror Carbon's behavior
		let ownerUri = Utils.generateUri(connectionProfileWithDb);
		await connect(ownerUri, undefined, false, connectionProfileWithoutDb);
		// If I get the URI for the connection with or without a database from the connection management service
		let actualUriWithDb = connectionManagementService.getConnectionUri(connectionProfileWithDb);
		let actualUriWithoutDb = connectionManagementService.getConnectionUri(connectionProfileWithoutDb);

		// Then the retrieved URIs should match the one on the connection
		let expectedUri = Utils.generateUri(connectionProfileWithoutDb);
		assert.strictEqual(actualUriWithDb, expectedUri);
		assert.strictEqual(actualUriWithoutDb, expectedUri);
	});

	test('list and change database tests', async () => {
		// Set up the connection management service with a connection corresponding to a default database
		let dbName = 'master';
		let newDbName = 'renamed_master';
		let serverName = 'test_server';
		let userName = 'test_user';
		let connectionProfileWithoutDb: IConnectionProfile = Object.assign(connectionProfile,
			{ serverName: serverName, databaseName: '', userName: userName, getOptionsKey: () => undefined });
		let connectionProfileWithDb: IConnectionProfile = Object.assign(connectionProfileWithoutDb, { databaseName: dbName });
		// Save the database with a URI that has the database name filled in, to mirror Carbon's behavior
		let ownerUri = Utils.generateUri(connectionProfileWithDb);
		let listDatabasesThenable = (connectionUri: string) => {
			let databaseResult: azdata.ListDatabasesResult = { databaseNames: [] };
			if (connectionUri === ownerUri) {
				databaseResult = { databaseNames: [dbName] };
			}
			return Promise.resolve(databaseResult);
		};
		let changeDatabasesThenable = (connectionUri: string, newDatabase: string) => {
			let result = false;
			if ((connectionUri === ownerUri) && (newDatabase === newDbName)) {
				result = true;
			}
			return Promise.resolve(result);
		};
		mssqlConnectionProvider.setup(x => x.listDatabases(ownerUri)).returns(() => listDatabasesThenable(ownerUri));
		mssqlConnectionProvider.setup(x => x.changeDatabase(ownerUri, newDbName)).returns(() => changeDatabasesThenable(ownerUri, newDbName));
		await connect(ownerUri, undefined, false, connectionProfileWithoutDb);
		let listDatabasesResult = await connectionManagementService.listDatabases(ownerUri);
		assert.strictEqual(listDatabasesResult.databaseNames.length, 1);
		assert.strictEqual(listDatabasesResult.databaseNames[0], dbName);
		let changeDatabaseResults = await connectionManagementService.changeDatabase(ownerUri, newDbName);
		assert(changeDatabaseResults);
		assert.strictEqual(newDbName, connectionManagementService.getConnectionProfile(ownerUri).databaseName);
	});

	test('list and change database tests for invalid uris', async () => {
		let badString = 'bad_string';
		let listDatabasesResult = await connectionManagementService.listDatabases(badString);
		assert(!listDatabasesResult);
		let changeDatabaseResult = await connectionManagementService.changeDatabase(badString, badString);
		assert(!changeDatabaseResult);

	});

	test('getTabColorForUri returns undefined when there is no connection for the given URI', () => {
		let connectionManagementService = createConnectionManagementService();
		let color = connectionManagementService.getTabColorForUri('invalidUri');
		assert.strictEqual(color, undefined);
	});

	test('getTabColorForUri returns the group color corresponding to the connection for a URI', async () => {
		// Set up the connection store to give back a group for the expected connection profile
		configResult['tabColorMode'] = 'border';
		let expectedColor = 'red';
		connectionStore.setup(x => x.getGroupFromId(connectionProfile.groupId)).returns(() => <IConnectionProfileGroup>{
			color: expectedColor
		});
		let uri = 'testUri';
		await connect(uri);
		let tabColor = connectionManagementService.getTabColorForUri(uri);
		assert.strictEqual(tabColor, expectedColor);
	});

	test('getConnectionCredentials returns the credentials dictionary for an active connection profile', async () => {
		let profile = Object.assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		connectionStatusManager.addConnection(profile, 'test_uri');
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;
		let credentials = await connectionManagementService.getConnectionCredentials(profile.id);
		assert.strictEqual(credentials['password'], profile.options['password']);
	});

	test('getConnectionCredentials returns the credentials dictionary for a recently used connection profile', async () => {
		const test_password = 'test_password';
		let badString = 'bad_string';
		const profile = createConnectionProfile('test_id', '');
		const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
		connectionStoreMock.setup(x => x.getRecentlyUsedConnections(undefined)).returns(() => {
			return [profile];
		});
		connectionStoreMock.setup(x => x.addSavedPassword(TypeMoq.It.isAny())).returns(async () => {
			profile.password = test_password;
			return { profile: profile, savedCred: true };
		});
		const testInstantiationService = new TestInstantiationService();
		testInstantiationService.stub(IStorageService, new TestStorageService());
		testInstantiationService.stubCreateInstance(ConnectionStore, connectionStoreMock.object);
		const connectionManagementService = new ConnectionManagementService(undefined, testInstantiationService, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
		assert.strictEqual(profile.password, '', 'Profile should not have password initially');
		assert.strictEqual(profile.options['password'], '', 'Profile options should not have password initially');
		// Check for invalid profile id
		let badCredentials = await connectionManagementService.getConnectionCredentials(badString);
		assert.strictEqual(badCredentials, undefined);
		let credentials = await connectionManagementService.getConnectionCredentials(profile.id);
		assert.strictEqual(credentials['password'], test_password);
	});

	test('getConnectionCredentials returns the credentials dictionary for a saved connection profile', async () => {
		const test_password = 'test_password';
		const profile = createConnectionProfile('test_id', '');
		const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
		const group1 = createConnectionGroup('group1');
		group1.connections = [profile];
		connectionStoreMock.setup(x => x.getRecentlyUsedConnections(undefined)).returns(() => {
			return [];
		});
		connectionStoreMock.setup(x => x.getConnectionProfileGroups(TypeMoq.It.isAny(), undefined)).returns(() => {
			return [group1];
		});
		connectionStoreMock.setup(x => x.addSavedPassword(TypeMoq.It.isAny())).returns(async () => {
			profile.password = test_password;
			return { profile: profile, savedCred: true };
		});
		const testInstantiationService = new TestInstantiationService();
		testInstantiationService.stub(IStorageService, new TestStorageService());
		testInstantiationService.stubCreateInstance(ConnectionStore, connectionStoreMock.object);

		const connectionManagementService = new ConnectionManagementService(undefined, testInstantiationService, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
		assert.strictEqual(profile.password, '', 'Profile should not have password initially');
		assert.strictEqual(profile.options['password'], '', 'Profile options should not have password initially');
		let credentials = await connectionManagementService.getConnectionCredentials(profile.id);
		assert.strictEqual(credentials['password'], test_password);
	});

	test('getConnectionUriFromId returns a URI of an active connection with the given id', () => {
		let profile = Object.assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		let uri = 'test_initial_uri';
		connectionStatusManager.addConnection(profile, uri);
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;

		// If I call getConnectionUriFromId on the given connection
		let foundUri = connectionManagementService.getConnectionUriFromId(profile.id);

		// Then the returned URI matches the connection's original URI
		assert.strictEqual(foundUri, uri);
	});

	test('provider is registered and working', () => {
		assert.strictEqual(connectionManagementService.providerRegistered('MSSQL'), true);
	});

	test('getConectionUriFromId returns undefined if the given connection is not active', () => {
		let profile = Object.assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		connectionStatusManager.addConnection(profile, Utils.generateUri(profile));
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;

		// If I call getConnectionUriFromId with a different URI than the connection's
		let foundUri = connectionManagementService.getConnectionUriFromId('different_id');

		// Then undefined is returned
		assert.strictEqual(foundUri, undefined);
	});

	test('addSavedPassword fills in Azure access tokens for Azure accounts', async () => {
		// Set up a connection profile that uses Azure
		let azureConnectionProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, connectionProfile);
		azureConnectionProfile.authenticationType = 'AzureMFA';
		let username = 'testuser@microsoft.com';
		azureConnectionProfile.azureAccount = username;
		let servername = 'test-database.database.windows.net';
		azureConnectionProfile.serverName = servername;
		let providerId = 'azure_PublicCloud';
		azureConnectionProfile.azureTenantId = 'testTenant';

		// Set up the account management service to return a token for the given user
		accountManagementService.setup(x => x.getAccountsForProvider(TypeMoq.It.isAny())).returns(providerId => Promise.resolve<azdata.Account[]>([
			{
				key: {
					accountId: username,
					providerId: providerId
				},
				displayInfo: undefined,
				isStale: false,
				properties: undefined
			}
		]));

		accountManagementService.setup(x => x.getAccounts()).returns(() => {
			return Promise.resolve<azdata.Account[]>([
				{
					key: {
						accountId: username,
						providerId: providerId
					},
					displayInfo: undefined,
					isStale: false,
					properties: undefined
				}
			]);
		});
		let testToken = 'testToken';
		accountManagementService.setup(x => x.getAccountSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			token: testToken,
			tokenType: 'Bearer'
		}));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is(profile => profile.authenticationType === 'AzureMFA'))).returns(profile => Promise.resolve({
			profile: profile,
			savedCred: false
		}));

		// If I call addSavedPassword
		let profileWithCredentials = await connectionManagementService.addSavedPassword(azureConnectionProfile);

		// Then the returned profile has the account token set
		assert.strictEqual(profileWithCredentials.userName, azureConnectionProfile.userName);
		assert.strictEqual(profileWithCredentials.options['azureAccountToken'], testToken);
	});

	test('addSavedPassword fills in Azure access token for selected tenant', async () => {
		// Set up a connection profile that uses Azure
		let azureConnectionProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, connectionProfile);
		azureConnectionProfile.authenticationType = 'AzureMFA';
		let username = 'testuser@microsoft.com';
		azureConnectionProfile.azureAccount = username;
		let servername = 'test-database.database.windows.net';
		azureConnectionProfile.serverName = servername;
		let azureTenantId = 'testTenant';
		azureConnectionProfile.azureTenantId = azureTenantId;
		let providerId = 'azure_PublicCloud';

		// Set up the account management service to return a token for the given user
		accountManagementService.setup(x => x.getAccountsForProvider(TypeMoq.It.isAny())).returns(providerId => Promise.resolve<azdata.Account[]>([
			{
				key: {
					accountId: username,
					providerId: providerId
				},
				displayInfo: undefined,
				isStale: false,
				properties: undefined
			}
		]));

		accountManagementService.setup(x => x.getAccounts()).returns(() => {
			return Promise.resolve<azdata.Account[]>([
				{
					key: {
						accountId: username,
						providerId,
					},
					displayInfo: undefined,
					isStale: false,
					properties: undefined
				}
			]);
		});

		let returnedToken = { token: 'testToken', tokenType: 'Bearer' };
		accountManagementService.setup(x => x.getAccountSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(returnedToken));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is(profile => profile.authenticationType === 'AzureMFA'))).returns(profile => Promise.resolve({
			profile: profile,
			savedCred: false
		}));

		// If I call addSavedPassword
		let profileWithCredentials = await connectionManagementService.addSavedPassword(azureConnectionProfile);

		// Then the returned profile has the account token set corresponding to the requested tenant
		assert.strictEqual(profileWithCredentials.userName, azureConnectionProfile.userName);
		assert.strictEqual(profileWithCredentials.options['azureAccountToken'], returnedToken.token);
	});

	test('getConnections test', () => {
		const connectionStatusManagerMock = TypeMoq.Mock.ofType(ConnectionStatusManager, TypeMoq.MockBehavior.Loose);
		const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
		connectionStatusManagerMock.setup(x => x.getActiveConnectionProfiles(undefined)).returns(() => {
			return [createConnectionProfile('1'), createConnectionProfile('2')];
		});
		connectionStoreMock.setup(x => x.getRecentlyUsedConnections(undefined)).returns(() => {
			return [createConnectionProfile('1'), createConnectionProfile('3')];
		});

		const group1 = createConnectionGroup('group1');
		const group2 = createConnectionGroup('group2');
		group1.connections = [createConnectionProfile('1'), createConnectionProfile('4')];
		group1.children = [group2];
		group2.connections = [createConnectionProfile('5'), createConnectionProfile('6')];
		connectionStoreMock.setup(x => x.getConnectionProfileGroups(TypeMoq.It.isAny(), undefined)).returns(() => {
			return [group1];
		});

		const testInstantiationService = new TestInstantiationService();
		const createInstanceStub = sinon.stub(testInstantiationService, 'createInstance');
		createInstanceStub.withArgs(ConnectionStore).returns(connectionStoreMock.object);
		createInstanceStub.withArgs(ConnectionStatusManager).returns(connectionStatusManagerMock.object);

		const connectionManagementService = new ConnectionManagementService(undefined, testInstantiationService, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());

		// dupe connections have been seeded the numbers below already reflected the de-duped results

		const verifyConnections = (actualConnections: ConnectionProfile[], expectedConnectionIds: string[], scenario: string) => {
			assert.strictEqual(actualConnections.length, expectedConnectionIds.length, 'incorrect number of connections returned, ' + scenario);
			assert.deepEqual(actualConnections.map(conn => conn.id).sort(), expectedConnectionIds.sort(), 'connections do not match expectation, ' + scenario);
		};

		// no parameter - default to false
		let connections = connectionManagementService.getConnections();
		verifyConnections(connections, ['1', '2', '3', '4', '5', '6'], 'no parameter provided');

		// explicitly set to false
		connections = connectionManagementService.getConnections(false);
		verifyConnections(connections, ['1', '2', '3', '4', '5', '6'], 'parameter is false');

		// active connections only
		connections = connectionManagementService.getConnections(true);
		verifyConnections(connections, ['1', '2'], 'parameter is true');
	});
});

test('isRecent should evaluate whether a profile was recently connected or not', () => {
	const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
	const testInstantiationService = new TestInstantiationService();
	testInstantiationService.stub(IStorageService, new TestStorageService());
	sinon.stub(testInstantiationService, 'createInstance').withArgs(ConnectionStore).returns(connectionStoreMock.object);
	connectionStoreMock.setup(x => x.getRecentlyUsedConnections()).returns(() => {
		return [createConnectionProfile('1')];
	});
	let profile1 = createConnectionProfile('1');
	let profile2 = createConnectionProfile('2');
	const connectionManagementService = new ConnectionManagementService(undefined, testInstantiationService, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
	assert(connectionManagementService.isRecent(profile1));
	assert(!connectionManagementService.isRecent(profile2));
});

test('clearRecentConnection and ConnectionsList should call connectionStore functions', () => {
	const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
	let called = false;
	connectionStoreMock.setup(x => x.clearRecentlyUsed()).returns(() => {
		called = true;
	});
	connectionStoreMock.setup(x => x.removeRecentConnection(TypeMoq.It.isAny())).returns(() => {
		called = true;
	});
	const testInstantiationService = new TestInstantiationService();
	testInstantiationService.stub(IStorageService, new TestStorageService());
	sinon.stub(testInstantiationService, 'createInstance').withArgs(ConnectionStore).returns(connectionStoreMock.object);
	let profile1 = createConnectionProfile('1');
	const connectionManagementService = new ConnectionManagementService(undefined, testInstantiationService, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
	connectionManagementService.clearRecentConnection(profile1);
	assert(called);
	called = false;
	connectionManagementService.clearRecentConnectionsList();
	assert(called);
});

export function createConnectionProfile(id: string, password?: string): ConnectionProfile {
	const capabilitiesService = new TestCapabilitiesService();
	return new ConnectionProfile(capabilitiesService, {
		connectionName: 'newName',
		savePassword: false,
		groupFullName: 'testGroup',
		serverName: 'testServerName',
		databaseName: 'testDatabaseName',
		authenticationType: Constants.integrated,
		password: password ?? 'test',
		userName: 'testUsername',
		groupId: undefined,
		providerName: Constants.mssqlProviderName,
		options: {},
		saveProfile: true,
		id: id
	});
}

function createConnectionGroup(id: string): ConnectionProfileGroup {
	return new ConnectionProfileGroup(id, undefined, id, undefined, undefined);
}

function getBasicExtensionService(): IExtensionService {
	return <any>{
		activateByEvent: () => Promise.resolve()
	};
}
