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
	IConnectionCompletionOptions, IConnectionResult,
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
		connectionStore.setup(x => x.saveProfile(TypeMoq.It.isAny())).returns(() => Promise.resolve(connectionProfile));
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
			TestEnvironmentService
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
				connectionStore.verify(x => x.saveProfile(TypeMoq.It.isAny()), TypeMoq.Times.once());
			}
			if (options.showDashboard) {
				workbenchEditorService.verify(x => x.openEditor(undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			}
		}

		if (fromDialog !== undefined && !fromDialog) {
			connectionStore.verify(x => x.addSavedPassword(TypeMoq.It.isAny()), TypeMoq.Times.once());
		}

	}

	async function connect(uri: string, options?: IConnectionCompletionOptions, fromDialog?: boolean, connection?: IConnectionProfile, error?: string, errorCode?: number, errorCallStack?: string): Promise<IConnectionResult> {
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
				serverInfo: undefined
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
				querySelection: undefined,
				runQueryOnCompletion: RunQueryOnConnectionMode.none
			},
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};

		return connect(uri, options).then(() => {
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
				querySelection: undefined,
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

	test.skip('ensureDefaultLanguageFlavor should not send event if uri is connected', () => { // {{SQL CARBON EDIT}} this test is broken regardless of my changes
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};
		let connectionManagementService = createConnectionManagementService();
		let called = false;
		connectionManagementService.onLanguageFlavorChanged((changeParams: azdata.DidChangeLanguageFlavorParams) => {
			called = true;
		});
		return connect(uri, options).then(() => {
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

	test('getActiveConnectionCredentials returns the credentials dictionary for a connection profile', () => {
		let profile = assign({}, connectionProfile);
		profile.options = { password: profile.password };
		profile.id = 'test_id';
		connectionStatusManager.addConnection(profile, 'test_uri');
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;
		let credentials = connectionManagementService.getActiveConnectionCredentials(profile.id);
		assert.equal(credentials['password'], profile.options['password']);
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
		accountManagementService.setup(x => x.getSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			azure_publicCloud: {
				token: testToken
			}
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

		let testToken = 'testToken';
		let returnedTokens = {};
		returnedTokens['azure_publicCloud'] = { token: 'badToken' };
		returnedTokens[azureTenantId] = { token: testToken };
		accountManagementService.setup(x => x.getSecurityToken(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(returnedTokens));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is(profile => profile.authenticationType === 'AzureMFA'))).returns(profile => Promise.resolve({
			profile: profile,
			savedCred: false
		}));

		// If I call addSavedPassword
		let profileWithCredentials = await connectionManagementService.addSavedPassword(azureConnectionProfile);

		// Then the returned profile has the account token set corresponding to the requested tenant
		assert.equal(profileWithCredentials.userName, azureConnectionProfile.userName);
		assert.equal(profileWithCredentials.options['azureAccountToken'], testToken);
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
		const connectionManagementService = new ConnectionManagementService(connectionStoreMock.object, connectionStatusManagerMock.object, undefined, undefined, undefined, undefined, undefined, new TestCapabilitiesService(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

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

function createConnectionProfile(id: string): ConnectionProfile {

	const capabilitiesService = new TestCapabilitiesService();
	return new ConnectionProfile(capabilitiesService, {
		connectionName: 'newName',
		savePassword: false,
		groupFullName: 'testGroup',
		serverName: 'testServerName',
		databaseName: 'testDatabaseName',
		authenticationType: Constants.integrated,
		password: 'test',
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
