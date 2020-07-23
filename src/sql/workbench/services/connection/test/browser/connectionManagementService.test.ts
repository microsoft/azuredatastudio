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
import { IConnectionProfileGroup, ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestAccountManagementService } from 'sql/platform/accounts/test/common/testAccountManagementService';
import { TestEnvironmentService, TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { NullLogService } from 'vs/platform/log/common/log';
import { assign } from 'vs/base/common/objects';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';

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
		assign({}, connectionProfile, { password: '', serverName: connectionProfile.serverName + 1 });
	let connectionProfileWithEmptyUnsavedPassword: IConnectionProfile =
		assign({}, connectionProfile, { password: '', serverName: connectionProfile.serverName + 2, savePassword: false });

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
		let connectionManagementService = new ConnectionManagementService(
			connectionStore.object,
			undefined,
			connectionDialogService.object,
			undefined, // IInstantiationService
			workbenchEditorService.object,
			new NullAdsTelemetryService(), // ITelemetryService
			workspaceConfigurationServiceMock.object,
			capabilitiesService,
			undefined, // IQuickInputService
			new TestNotificationService(),
			resourceProviderStubMock.object,
			undefined, // IAngularEventingService
			accountManagementService.object,
			new NullLogService(), // ILogService
			undefined, // IStorageService
			TestEnvironmentService,
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

	test('showConnectionDialog should open the dialog with default type given no parameters', () => {
		return connectionManagementService.showConnectionDialog().then(() => {
			verifyShowConnectionDialog(undefined, ConnectionType.default, undefined, false);
		});
	});

	test('showConnectionDialog should open the dialog with given type given valid input', () => {
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
		return connectionManagementService.showConnectionDialog(params).then(() => {
			verifyShowConnectionDialog(undefined, params.connectionType, params.input.uri, false);
		});
	});

	test('showConnectionDialog should pass the model to the dialog if there is a model assigned to the uri', () => {
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

		return connect(params.input.uri).then(() => {
			let saveConnection = connectionManagementService.getConnectionProfile(params.input.uri);

			assert.notEqual(saveConnection, undefined, `profile was not added to the connections`);
			assert.equal(saveConnection.serverName, connectionProfile.serverName, `Server names are different`);
			return connectionManagementService.showConnectionDialog(params).then(() => {
				verifyShowConnectionDialog(connectionProfile, params.connectionType, params.input.uri, false);
			});
		});
	});

	test('showConnectionDialog should not be called when using showEditConnectionDialog', () => {
		return connectionManagementService.showEditConnectionDialog(connectionProfile).then(() => {
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, undefined, false, undefined, false);
		});
	});

	test('connect should save profile given options with saveProfile set to true', () => {
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};

		return connect(uri, options).then(() => {
			verifyOptions(options);
		});
	});

	test('getDefaultProviderId is MSSQL', () => {
		let defaultProvider = connectionManagementService.getDefaultProviderId();
		assert.equal(defaultProvider, 'MSSQL', `Default provider is not equal to MSSQL`);
	});

	/* Andresse  10/5/17 commented this test out since it was only working before my changes by the chance of how Promises work
		If we want to continue to test this, the connection logic needs to be rewritten to actually wait for everything to be done before it resolves */
	// test('connect should show dashboard given options with showDashboard set to true', done => {
	// 	let uri: string = 'Editor Uri';
	// 	let options: IConnectionCompletionOptions = {
	// 		params: undefined,
	// 		saveTheConnection: false,
	// 		showDashboard: true,
	// 		showConnectionDialogOnError: false
	// 	};

	// 	connect(uri, options).then(() => {
	// 		verifyOptions(options);
	// 		done();
	// 	}).catch(err => {
	// 		done(err);
	// 	});
	// });

	test('connect should pass the params in options to onConnectSuccess callback', () => {
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

		return connect(uri, options).then((result) => {
			verifyOptions(options);
			assert.notEqual(paramsInOnConnectSuccess, undefined);
			assert.equal(paramsInOnConnectSuccess.connectionType, options.params.connectionType);
		});
	});

	test('connectAndSaveProfile should show not load the password', () => {
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = undefined;

		return connect(uri, options, true).then(() => {
			verifyOptions(options, true);
		});
	});

	test('connect with undefined uri and options should connect using the default uri', () => {
		let uri = undefined;
		let options: IConnectionCompletionOptions = undefined;

		return connect(uri, options).then(() => {
			assert.equal(connectionManagementService.isProfileConnected(connectionProfile), true);
		});
	});

	test('failed connection should open the dialog if connection fails', () => {
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

		return connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, false);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult);
		});
	});

	test('failed connection should not open the dialog if the option is set to false even if connection fails', () => {
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

		return connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, false);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, false);
		});
	});

	test('Accessors for event emitters should return emitter function', () => {
		let onAddConnectionProfile1 = connectionManagementService.onAddConnectionProfile;
		assert.equal(typeof (onAddConnectionProfile1), 'function');
		let onDeleteConnectionProfile1 = connectionManagementService.onDeleteConnectionProfile;
		assert.equal(typeof (onDeleteConnectionProfile1), 'function');
		let onConnect1 = connectionManagementService.onConnect;
		assert.equal(typeof (onConnect1), 'function');
	});

	test('onConnectionChangedNotification should call onConnectionChanged event', () => {
		let uri = 'Test Uri';
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};

		return connect(uri, options).then(result => {
			let saveConnection = connectionManagementService.getConnectionProfile(uri);
			let changedConnectionInfo: azdata.ChangedConnectionInfo = { connectionUri: uri, connection: saveConnection };
			let called = false;
			connectionManagementService.onConnectionChanged((params: IConnectionParams) => {
				assert.equal(uri, params.connectionUri);
				assert.equal(saveConnection, params.connectionProfile);
				called = true;
			});
			connectionManagementService.onConnectionChangedNotification(0, changedConnectionInfo);
			assert.ok(called, 'expected onConnectionChanged event to be sent');
		});
	});

	test('changeGroupIdForconnection should change the groupId for a connection profile', () => {
		let profile = <ConnectionProfile>assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		let newGroupId = 'new_group_id';
		connectionStore.setup(x => x.changeGroupIdForConnection(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		connectionManagementService.changeGroupIdForConnection(profile, newGroupId).then(() => {
			assert.equal(profile.groupId, newGroupId);
		});
	});

	test('changeGroupIdForConnectionGroup should call changeGroupIdForConnectionGroup in ConnectionStore', () => {
		let sourceProfileGroup = createConnectionGroup('original_id');
		let targetProfileGroup = createConnectionGroup('new_id');
		let called = false;
		connectionStore.setup(x => x.changeGroupIdForConnectionGroup(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
			called = true;
			return Promise.resolve();
		});
		connectionManagementService.changeGroupIdForConnectionGroup(sourceProfileGroup, targetProfileGroup).then(() => {
			assert.ok(called, 'expected changeGroupIdForConnectionGroup to be called on ConnectionStore');
		});
	});

	test('findExistingConnection should find connection for connectionProfile with same info', () => {
		let profile = <ConnectionProfile>assign({}, connectionProfile);
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
		return connect(uri1, options, true, profile).then(() => {
			let returnedProfile = connectionManagementService.findExistingConnection(profile);
			assert.equal(returnedProfile.getConnectionInfoId(), connectionInfoString);
		});
	});

	test('deleteConnection should delete the connection properly', () => {
		let profile = <ConnectionProfile>assign({}, connectionProfile);
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
		return connect(uri1, options, true, profile).then(() => {
			assert(connectionManagementService.deleteConnection(profile));
		});
	});

	test('deleteConnectionGroup should delete connections in connection group', () => {
		let profile = <ConnectionProfile>assign({}, connectionProfile);
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
		return connect(uri1, options, true, profile).then(() => {
			return connectionManagementService.deleteConnectionGroup(profileGroup).then(result => {
				assert(result);
			});
		});
	});

	test('canChangeConnectionConfig returns true when connection can be moved to another group', () => {
		connectionStore.setup(x => x.canChangeConnectionConfig(TypeMoq.It.isAny(), TypeMoq.It.isAnyString())).returns(() => {
			return true;
		});
		let profile = <ConnectionProfile>assign({}, connectionProfile);
		let newGroupId = 'test_group_id';
		assert(connectionManagementService.canChangeConnectionConfig(profile, newGroupId));
	});

	test('connectIfNotConnected should not try to connect with already connected profile', () => {
		let profile = <ConnectionProfile>assign({}, connectionProfile);
		let uri1 = 'connection:connectionId'; //must use default connection uri for test to work.
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

		return connect(uri1, options, true, profile).then(result => {
			assert.equal(result.connected, true);
			return connectionManagementService.connectIfNotConnected(profile, undefined, true).then(result => {
				assert.equal(result, uri1);
			});
		});
	});

	test('Edit Connection - Changing connection profile name for same URI should persist after edit', () => {
		let profile = assign({}, connectionProfile);
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

		return connect(uri1, options, true, profile).then(result => {
			assert.equal(result.connected, true);
			let newProfile = assign({}, connectionProfile);
			newProfile.connectionName = newname;
			options.params.isEditConnection = true;
			return connect(uri1, options, true, newProfile).then(result => {
				assert.equal(result.connected, true);
				assert.equal(connectionManagementService.getConnectionProfile(uri1).connectionName, newname);
			});
		});
	});

	test('Edit Connection - Connecting a different URI with same profile via edit should not change profile ID.', () => {
		let uri1 = 'test_uri1';
		let uri2 = 'test_uri2';
		let profile = assign({}, connectionProfile);
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

		return connect(uri1, options, true, profile).then(result => {
			assert.equal(result.connected, true);
			options.params.isEditConnection = true;
			return connect(uri2, options, true, profile).then(result => {
				assert.equal(result.connected, true);
				let uri1info = connectionManagementService.getConnectionInfo(uri1);
				let uri2info = connectionManagementService.getConnectionInfo(uri2);
				assert.equal(uri1info.connectionProfile.id, uri2info.connectionProfile.id);
			});
		});
	});


	test('failed firewall rule should open the firewall rule dialog', () => {
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

		return connect(uri, options, false, connectionProfile, error, errorCode).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, expectedError);
			verifyShowFirewallRuleDialog(connectionProfile, true);
		});
	});

	test('failed firewall rule connection should not open the firewall rule dialog if the option is set to false even if connection fails', () => {
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

		return connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, false);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, false);
		});
	});

	test('hasRegisteredServers should return true as there is one registered server', () => {
		assert(connectionManagementService.hasRegisteredServers());
	});


	test('getAdvancedProperties should return a list of properties for connectionManagementService', () => {
		let propertyNames = ['connectionName', 'serverName', 'databaseName', 'userName', 'authenticationType', 'password'];
		let advancedProperties = connectionManagementService.getAdvancedProperties();
		assert.equal(propertyNames[0], advancedProperties[0].name);
		assert.equal(propertyNames[1], advancedProperties[1].name);
		assert.equal(propertyNames[2], advancedProperties[2].name);
		assert.equal(propertyNames[3], advancedProperties[3].name);
		assert.equal(propertyNames[4], advancedProperties[4].name);
		assert.equal(propertyNames[5], advancedProperties[5].name);
	});

	test('saveProfileGroup should return groupId from connection group', () => {
		let newConnectionGroup = createConnectionGroup(connectionProfile.groupId);
		connectionStore.setup(x => x.saveProfileGroup(TypeMoq.It.isAny())).returns(() => Promise.resolve(connectionProfile.groupId));
		connectionManagementService.saveProfileGroup(newConnectionGroup).then(result => {
			assert.equal(result, connectionProfile.groupId);
		});
	});

	test('editGroup should fire onAddConnectionProfile', () => {
		let newConnectionGroup = createConnectionGroup(connectionProfile.groupId);
		let called = false;
		connectionStore.setup(x => x.editGroup(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		connectionManagementService.onAddConnectionProfile(() => {
			called = true;
		});
		return connectionManagementService.editGroup(newConnectionGroup).then(() => {
			assert(called);
		});
	});

	test('getFormattedUri should return formatted uri when given default type uri', () => {
		let testUri = 'connection:';
		assert.equal('connection:connectionId', connectionManagementService.getFormattedUri(testUri, connectionProfile));
	});

	test('failed firewall rule connection and failed during open firewall rule should open the firewall rule dialog and connection dialog with error', () => {
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

		return connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, true);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, true);
		});
	});

	test('failed firewall rule connection should open the firewall rule dialog. Then canceled firewall rule dialog should not open connection dialog', () => {
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

		return connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result, undefined);
			verifyShowFirewallRuleDialog(connectionProfile, true);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, true, connectionResult, false);
		});
	});

	test('connect when password is empty and unsaved should open the dialog', () => {
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

		return connect(uri, options, false, connectionProfileWithEmptyUnsavedPassword).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowConnectionDialog(connectionProfileWithEmptyUnsavedPassword, ConnectionType.default, uri, true, connectionResult);
			verifyShowFirewallRuleDialog(connectionProfile, false);
		});
	});

	test('connect when password is empty and saved should not open the dialog', () => {
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

		return connect(uri, options, false, connectionProfileWithEmptySavedPassword).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowConnectionDialog(connectionProfileWithEmptySavedPassword, ConnectionType.default, uri, true, connectionResult, false);
		});
	});

	test('connect from editor when empty password when it is required and saved should not open the dialog', () => {
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

		return connect(uri, options, false, connectionProfileWithEmptySavedPassword).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowConnectionDialog(connectionProfileWithEmptySavedPassword, ConnectionType.editor, uri, true, connectionResult, false);
		});
	});

	test('disconnect editor should disconnect uri from connection', () => {
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

		return connect(uri, options, false, connectionProfileWithEmptySavedPassword).then(() => {
			return connectionManagementService.disconnectEditor(options.params.input).then(result => {
				assert(result);
			});
		});
	});

	test('registerIconProvider should register icon provider for connectionManagementService', () => {
		let profile = <ConnectionProfile>assign({}, connectionProfile);
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
			isCloud: true
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
		return connect(uri, options, true, profile, undefined, undefined, undefined, serverInfo).then(() => {
			assert(called);
		});
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
			assert.equal(changeParams.uri, uri);
			assert.equal(changeParams.language, language);
			assert.equal(changeParams.flavor, flavor);
		});
		connectionManagementService.doChangeLanguageFlavor(uri, language, flavor);
		assert.ok(called, 'expected onLanguageFlavorChanged event to be sent');
	});


	test('getUniqueConnectionProvidersByNameMap should return non CMS providers', () => {
		let nameToDisplayNameMap: { [providerDisplayName: string]: string } = { 'MSSQL': 'SQL Server', 'MSSQL-CMS': 'SQL Server' };
		let providerNames = Object.keys(connectionManagementService.getUniqueConnectionProvidersByNameMap(nameToDisplayNameMap));
		assert.equal(providerNames.length, 1);
		assert.equal(providerNames[0], 'MSSQL');
	});

	test('providerNameToDisplayNameMap should return all providers', () => {
		let expectedNames = ['MSSQL', 'PGSQL'];
		let providerNames = Object.keys(connectionManagementService.providerNameToDisplayNameMap);
		assert.equal(providerNames.length, 2);
		assert.equal(providerNames[0], expectedNames[0]);
		assert.equal(providerNames[1], expectedNames[1]);
	});

	test('ensureDefaultLanguageFlavor should not send event if uri is connected', () => {
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
		return connect(uri, options).then(() => {
			called = false; //onLanguageFlavorChanged is called when connecting, must set back to false.
			connectionManagementService.ensureDefaultLanguageFlavor(uri);
			assert.equal(called, false, 'do not expect flavor change to be called');
		});
	});

	test('getConnectionId returns the URI associated with a connection that has had its database filled in', () => {
		// Set up the connection management service with a connection corresponding to a default database
		let dbName = 'master';
		let serverName = 'test_server';
		let userName = 'test_user';
		let connectionProfileWithoutDb: IConnectionProfile = assign(connectionProfile,
			{ serverName: serverName, databaseName: '', userName: userName, getOptionsKey: () => undefined });
		let connectionProfileWithDb: IConnectionProfile = assign(connectionProfileWithoutDb, { databaseName: dbName });
		// Save the database with a URI that has the database name filled in, to mirror Carbon's behavior
		let ownerUri = Utils.generateUri(connectionProfileWithDb);
		return connect(ownerUri, undefined, false, connectionProfileWithoutDb).then(() => {
			// If I get the URI for the connection with or without a database from the connection management service
			let actualUriWithDb = connectionManagementService.getConnectionUri(connectionProfileWithDb);
			let actualUriWithoutDb = connectionManagementService.getConnectionUri(connectionProfileWithoutDb);

			// Then the retrieved URIs should match the one on the connection
			let expectedUri = Utils.generateUri(connectionProfileWithoutDb);
			assert.equal(actualUriWithDb, expectedUri);
			assert.equal(actualUriWithoutDb, expectedUri);
		});
	});

	test('list and change database tests', () => {
		// Set up the connection management service with a connection corresponding to a default database
		let dbName = 'master';
		let newDbName = 'renamed_master';
		let serverName = 'test_server';
		let userName = 'test_user';
		let connectionProfileWithoutDb: IConnectionProfile = assign(connectionProfile,
			{ serverName: serverName, databaseName: '', userName: userName, getOptionsKey: () => undefined });
		let connectionProfileWithDb: IConnectionProfile = assign(connectionProfileWithoutDb, { databaseName: dbName });
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
		return connect(ownerUri, undefined, false, connectionProfileWithoutDb).then(() => {
			return connectionManagementService.listDatabases(ownerUri).then(result => {
				assert.equal(result.databaseNames.length, 1);
				assert.equal(result.databaseNames[0], dbName);
				return connectionManagementService.changeDatabase(ownerUri, newDbName).then(result => {
					assert(result);
					assert.equal(newDbName, connectionManagementService.getConnectionProfile(ownerUri).databaseName);
				});
			});
		});
	});

	test('getTabColorForUri returns undefined when there is no connection for the given URI', () => {
		let connectionManagementService = createConnectionManagementService();
		let color = connectionManagementService.getTabColorForUri('invalidUri');
		assert.equal(color, undefined);
	});

	test('getTabColorForUri returns the group color corresponding to the connection for a URI', () => {
		// Set up the connection store to give back a group for the expected connection profile
		configResult['tabColorMode'] = 'border';
		let expectedColor = 'red';
		connectionStore.setup(x => x.getGroupFromId(connectionProfile.groupId)).returns(() => <IConnectionProfileGroup>{
			color: expectedColor
		});
		let uri = 'testUri';
		return connect(uri).then(() => {
			let tabColor = connectionManagementService.getTabColorForUri(uri);
			assert.equal(tabColor, expectedColor);
		});
	});

	test('getConnectionCredentials returns the credentials dictionary for an active connection profile', async () => {
		let profile = assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		connectionStatusManager.addConnection(profile, 'test_uri');
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;
		let credentials = await connectionManagementService.getConnectionCredentials(profile.id);
		assert.equal(credentials['password'], profile.options['password']);
	});

	test('getConnectionCredentials returns the credentials dictionary for a recently used connection profile', async () => {
		const test_password = 'test_password';
		const profile = createConnectionProfile('test_id', '');
		const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
		connectionStoreMock.setup(x => x.getRecentlyUsedConnections(undefined)).returns(() => {
			return [profile];
		});
		connectionStoreMock.setup(x => x.addSavedPassword(TypeMoq.It.isAny())).returns(async () => {
			profile.password = test_password;
			return { profile: profile, savedCred: true };
		});
		const connectionManagementService = new ConnectionManagementService(connectionStoreMock.object, undefined, undefined, undefined, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
		assert.equal(profile.password, '', 'Profile should not have password initially');
		assert.equal(profile.options['password'], '', 'Profile options should not have password initially');
		let credentials = await connectionManagementService.getConnectionCredentials(profile.id);
		assert.equal(credentials['password'], test_password);
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
		const connectionManagementService = new ConnectionManagementService(connectionStoreMock.object, undefined, undefined, undefined, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
		assert.equal(profile.password, '', 'Profile should not have password initially');
		assert.equal(profile.options['password'], '', 'Profile options should not have password initially');
		let credentials = await connectionManagementService.getConnectionCredentials(profile.id);
		assert.equal(credentials['password'], test_password);
	});

	test('getConnectionUriFromId returns a URI of an active connection with the given id', () => {
		let profile = assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		let uri = 'test_initial_uri';
		connectionStatusManager.addConnection(profile, uri);
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;

		// If I call getConnectionUriFromId on the given connection
		let foundUri = connectionManagementService.getConnectionUriFromId(profile.id);

		// Then the returned URI matches the connection's original URI
		assert.equal(foundUri, uri);
	});

	test('provider is registered and working', () => {
		assert.equal(connectionManagementService.providerRegistered('MSSQL'), true);
	});

	test('getConectionUriFromId returns undefined if the given connection is not active', () => {
		let profile = assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		connectionStatusManager.addConnection(profile, Utils.generateUri(profile));
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;

		// If I call getConnectionUriFromId with a different URI than the connection's
		let foundUri = connectionManagementService.getConnectionUriFromId('different_id');

		// Then undefined is returned
		assert.equal(foundUri, undefined);
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
		assert.equal(profileWithCredentials.userName, azureConnectionProfile.userName);
		assert.equal(profileWithCredentials.options['azureAccountToken'], testToken);
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
		assert.equal(profileWithCredentials.userName, azureConnectionProfile.userName);
		assert.equal(profileWithCredentials.options['azureAccountToken'], returnedToken.token);
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
		const connectionManagementService = new ConnectionManagementService(connectionStoreMock.object, connectionStatusManagerMock.object, undefined, undefined, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());

		// dupe connections have been seeded the numbers below already reflected the de-duped results

		const verifyConnections = (actualConnections: ConnectionProfile[], expectedConnectionIds: string[], scenario: string) => {
			assert.equal(actualConnections.length, expectedConnectionIds.length, 'incorrect number of connections returned, ' + scenario);
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
	const connectionStatusManagerMock = TypeMoq.Mock.ofType(ConnectionStatusManager, TypeMoq.MockBehavior.Loose);
	const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
	connectionStoreMock.setup(x => x.getRecentlyUsedConnections()).returns(() => {
		return [createConnectionProfile('1')];
	});
	let profile1 = createConnectionProfile('1');
	let profile2 = createConnectionProfile('2');
	const connectionManagementService = new ConnectionManagementService(connectionStoreMock.object, connectionStatusManagerMock.object, undefined, undefined, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
	assert(connectionManagementService.isRecent(profile1));
	assert(!connectionManagementService.isRecent(profile2));
});

test('clearRecentConnection and ConnectionsList should call connectionStore functions', () => {
	const connectionStatusManagerMock = TypeMoq.Mock.ofType(ConnectionStatusManager, TypeMoq.MockBehavior.Loose);
	const connectionStoreMock = TypeMoq.Mock.ofType(ConnectionStore, TypeMoq.MockBehavior.Loose, new TestStorageService());
	let called = false;
	connectionStoreMock.setup(x => x.clearRecentlyUsed()).returns(() => {
		called = true;
	});
	connectionStoreMock.setup(x => x.removeRecentConnection(TypeMoq.It.isAny())).returns(() => {
		called = true;
	});
	let profile1 = createConnectionProfile('1');
	const connectionManagementService = new ConnectionManagementService(connectionStoreMock.object, connectionStatusManagerMock.object, undefined, undefined, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, getBasicExtensionService());
	connectionManagementService.clearRecentConnection(profile1);
	assert(called);
	called = false;
	connectionManagementService.clearRecentConnectionsList();
	assert(called);
});

function createConnectionProfile(id: string, password?: string): ConnectionProfile {
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
