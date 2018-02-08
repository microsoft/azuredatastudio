/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ConnectionDialogTestService } from 'sqltest/stubs/connectionDialogTestService';
import { ConnectionManagementService } from 'sql/parts/connection/common/connectionManagementService';
import { ConnectionStatusManager } from 'sql/parts/connection/common/connectionStatusManager';
import { ConnectionStore } from 'sql/parts/connection/common/connectionStore';
import {
	INewConnectionParams, ConnectionType,
	IConnectionCompletionOptions, IConnectionResult,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import * as Constants from 'sql/parts/connection/common/constants';
import * as Utils from 'sql/parts/connection/common/utils';
import { IHandleFirewallRuleResult } from 'sql/parts/accountManagement/common/interfaces';

import { WorkbenchEditorTestService } from 'sqltest/stubs/workbenchEditorTestService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { EditorGroupTestService } from 'sqltest/stubs/editorGroupService';
import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { ConnectionProviderStub } from 'sqltest/stubs/connectionProviderStub';
import { ResourceProviderStub } from 'sqltest/stubs/resourceProviderServiceStub';

import * as sqlops from 'sqlops';

import { TPromise } from 'vs/base/common/winjs.base';
import { WorkspaceConfigurationTestService } from 'sqltest/stubs/workspaceConfigurationTestService';

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { IConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';

suite('SQL ConnectionManagementService tests', () => {

	let capabilitiesService: CapabilitiesTestService;
	let connectionDialogService: TypeMoq.Mock<ConnectionDialogTestService>;
	let connectionStore: TypeMoq.Mock<ConnectionStore>;
	let workbenchEditorService: TypeMoq.Mock<WorkbenchEditorTestService>;
	let editorGroupService: TypeMoq.Mock<EditorGroupTestService>;
	let connectionStatusManager: ConnectionStatusManager;
	let mssqlConnectionProvider: TypeMoq.Mock<ConnectionProviderStub>;
	let workspaceConfigurationServiceMock: TypeMoq.Mock<WorkspaceConfigurationTestService>;
	let resourceProviderStubMock: TypeMoq.Mock<ResourceProviderStub>;

	let none: void;

	let connectionProfile: IConnectionProfile = {
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
	let handleFirewallRuleResult: IHandleFirewallRuleResult;
	let resolveHandleFirewallRuleDialog: boolean;
	let isFirewallRuleAdded: boolean;

	setup(() => {

		capabilitiesService = new CapabilitiesTestService();
		connectionDialogService = TypeMoq.Mock.ofType(ConnectionDialogTestService);
		connectionStore = TypeMoq.Mock.ofType(ConnectionStore);
		workbenchEditorService = TypeMoq.Mock.ofType(WorkbenchEditorTestService);
		editorGroupService = TypeMoq.Mock.ofType(EditorGroupTestService);
		connectionStatusManager = new ConnectionStatusManager(capabilitiesService);
		mssqlConnectionProvider = TypeMoq.Mock.ofType(ConnectionProviderStub);
		let resourceProviderStub = new ResourceProviderStub();
		resourceProviderStubMock = TypeMoq.Mock.ofInstance(resourceProviderStub);

		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined)).returns(() => TPromise.as(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, undefined)).returns(() => TPromise.as(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => TPromise.as(none));
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny())).returns(() => TPromise.as(none));

		connectionStore.setup(x => x.addActiveConnection(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		connectionStore.setup(x => x.saveProfile(TypeMoq.It.isAny())).returns(() => Promise.resolve(connectionProfile));
		workbenchEditorService.setup(x => x.openEditor(undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => TPromise.as(undefined));
		editorGroupService.setup(x => x.getStacksModel()).returns(() => undefined);
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is<IConnectionProfile>(
			c => c.serverName === connectionProfile.serverName))).returns(() => Promise.resolve({ profile: connectionProfile, savedCred: true }));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is<IConnectionProfile>(
			c => c.serverName === connectionProfileWithEmptySavedPassword.serverName))).returns(
			() => Promise.resolve({ profile: connectionProfileWithEmptySavedPassword, savedCred: true }));
		connectionStore.setup(x => x.addSavedPassword(TypeMoq.It.is<IConnectionProfile>(
			c => c.serverName === connectionProfileWithEmptyUnsavedPassword.serverName))).returns(
			() => Promise.resolve({ profile: connectionProfileWithEmptyUnsavedPassword, savedCred: false }));
		connectionStore.setup(x => x.isPasswordRequired(TypeMoq.It.isAny())).returns(() => true);

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
		workspaceConfigurationServiceMock = TypeMoq.Mock.ofType(WorkspaceConfigurationTestService);
		workspaceConfigurationServiceMock.setup(x => x.getValue(Constants.sqlConfigSectionName))
			.returns(() => configResult);

		connectionManagementService = createConnectionManagementService();

		connectionManagementService.registerProvider('MSSQL', mssqlConnectionProvider.object);
	});

	function createConnectionManagementService(): ConnectionManagementService {
		let connectionManagementService = new ConnectionManagementService(
			undefined,
			connectionStore.object,
			connectionDialogService.object,
			undefined,
			undefined,
			undefined,
			workbenchEditorService.object,
			undefined,
			undefined,
			undefined,
			workspaceConfigurationServiceMock.object,
			undefined,
			capabilitiesService,
			undefined,
			editorGroupService.object,
			undefined,
			resourceProviderStubMock.object,
			undefined,
			undefined
		);
		return connectionManagementService;
	}

	function verifyShowConnectionDialog(connectionProfile: IConnectionProfile, connectionType: ConnectionType, uri: string, connectionResult?: IConnectionResult, didShow: boolean = true): void {
		if (connectionProfile) {
			connectionDialogService.verify(x => x.showDialog(
				TypeMoq.It.isAny(),
				TypeMoq.It.is<INewConnectionParams>(p => p.connectionType === connectionType && (uri === undefined || p.input.uri === uri)),
				TypeMoq.It.is<IConnectionProfile>(c => c.serverName === connectionProfile.serverName),
				connectionResult ? TypeMoq.It.is<IConnectionResult>(r => r.errorMessage === connectionResult.errorMessage && r.callStack === connectionResult.callStack) : undefined),
				didShow ? TypeMoq.Times.once() : TypeMoq.Times.never());

		} else {
			connectionDialogService.verify(x => x.showDialog(
				TypeMoq.It.isAny(),
				TypeMoq.It.is<INewConnectionParams>(p => p.connectionType === connectionType && ((uri === undefined && p.input === undefined) || p.input.uri === uri)),
				undefined,
				connectionResult ? TypeMoq.It.is<IConnectionResult>(r => r.errorMessage === connectionResult.errorMessage && r.callStack === connectionResult.callStack) : undefined),
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

	function connect(uri: string, options?: IConnectionCompletionOptions, fromDialog?: boolean, connection?: IConnectionProfile, error?: string, errorCode?: number, errorCallStack?: string): Promise<IConnectionResult> {
		let connectionToUse = connection ? connection : connectionProfile;
		return new Promise<IConnectionResult>((resolve, reject) => {
			let id = connectionToUse.getOptionsKey();
			let defaultUri = 'connection://' + (id ? id : connectionToUse.serverName + ':' + connectionToUse.databaseName);
			connectionManagementService.onConnectionRequestSent(() => {
				let info: sqlops.ConnectionInfoSummary = {
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
			connectionManagementService.cancelConnectionForUri(uri).then(() => {
				if (fromDialog) {
					resolve(connectionManagementService.connectAndSaveProfile(connectionToUse, uri, options));
				} else {
					resolve(connectionManagementService.connect(connectionToUse, uri, options));
				}
			});
		});
	}

	test('showConnectionDialog should open the dialog with default type given no parameters', done => {
		connectionManagementService.showConnectionDialog().then(() => {
			verifyShowConnectionDialog(undefined, ConnectionType.default, undefined);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('showConnectionDialog should open the dialog with given type given valid input', done => {
		let params: INewConnectionParams = {
			connectionType: ConnectionType.editor,
			input: {
				onConnectReject: undefined,
				onConnectStart: undefined,
				onDisconnect: undefined,
				onConnectSuccess: undefined,
				uri: 'Editor Uri'
			},
			runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery
		};
		connectionManagementService.showConnectionDialog(params).then(() => {
			verifyShowConnectionDialog(undefined, params.connectionType, params.input.uri);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('showConnectionDialog should pass the model to the dialog if there is a model assigned to the uri', done => {
		let params: INewConnectionParams = {
			connectionType: ConnectionType.editor,
			input: {
				onConnectReject: undefined,
				onConnectStart: undefined,
				onDisconnect: undefined,
				onConnectSuccess: undefined,
				uri: 'Editor Uri'
			},
			runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery
		};

		connect(params.input.uri).then(() => {
			let saveConnection = connectionManagementService.getConnectionProfile(params.input.uri);

			assert.notEqual(saveConnection, undefined, `profile was not added to the connections`);
			assert.equal(saveConnection.serverName, connectionProfile.serverName, `Server names are different`);
			connectionManagementService.showConnectionDialog(params).then(() => {
				verifyShowConnectionDialog(connectionProfile, params.connectionType, params.input.uri);
				done();
			}).catch(err => {
				done(err);
			});
		}, err => done(err));
	});

	test('connect should save profile given options with saveProfile set to true', done => {
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: true,
			showDashboard: false,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};

		connect(uri, options).then(() => {
			verifyOptions(options);
			done();
		}).catch(err => {
			done(err);
		});
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

	test('connect should pass the params in options to onConnectSuccess callback', done => {
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

		connect(uri, options).then(() => {
			verifyOptions(options);
			assert.notEqual(paramsInOnConnectSuccess, undefined);
			assert.equal(paramsInOnConnectSuccess.connectionType, options.params.connectionType);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('connectAndSaveProfile should show not load the password', done => {
		let uri: string = 'Editor Uri';
		let options: IConnectionCompletionOptions = undefined;

		connect(uri, options, true).then(() => {
			verifyOptions(options, true);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('connect with undefined uri and options should connect using the default uri', done => {
		let uri = undefined;
		let options: IConnectionCompletionOptions = undefined;

		connect(uri, options).then(() => {
			assert.equal(connectionManagementService.isProfileConnected(connectionProfile), true);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('failed connection should open the dialog if connection fails', done => {
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

		connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, false);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, connectionResult);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('failed connection should not open the dialog if the option is set to false even if connection fails', done => {
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

		connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, false);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, connectionResult, false);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('failed firewall rule should open the firewall rule dialog', done => {
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

		connect(uri, options, false, connectionProfile, error, errorCode).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, expectedError);
			verifyShowFirewallRuleDialog(connectionProfile, true);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('failed firewall rule connection should not open the firewall rule dialog if the option is set to false even if connection fails', done => {
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

		connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, false);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, connectionResult, false);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('failed firewall rule connection and failed during open firewall rule should open the firewall rule dialog and connection dialog with error', done => {
		handleFirewallRuleResult.canHandleFirewallRule = true;
		resolveHandleFirewallRuleDialog = false;
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

		connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, true);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, connectionResult, true);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('failed firewall rule connection should open the firewall rule dialog. Then canceled firewall rule dialog should not open connection dialog', done => {
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

		connect(uri, options, false, connectionProfile, error, errorCode, errorCallStack).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowFirewallRuleDialog(connectionProfile, true);
			verifyShowConnectionDialog(connectionProfile, ConnectionType.default, uri, connectionResult, false);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('connect when password is empty and unsaved should open the dialog', done => {
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

		connect(uri, options, false, connectionProfileWithEmptyUnsavedPassword).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowConnectionDialog(connectionProfileWithEmptyUnsavedPassword, ConnectionType.default, uri, connectionResult);
			verifyShowFirewallRuleDialog(connectionProfile, false);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('connect when password is empty and saved should not open the dialog', done => {
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

		connect(uri, options, false, connectionProfileWithEmptySavedPassword).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowConnectionDialog(connectionProfileWithEmptySavedPassword, ConnectionType.default, uri, connectionResult, false);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('connect from editor when empty password when it is required and saved should not open the dialog', done => {
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

		connect(uri, options, false, connectionProfileWithEmptySavedPassword).then(result => {
			assert.equal(result.connected, expectedConnection);
			assert.equal(result.errorMessage, connectionResult.errorMessage);
			verifyShowConnectionDialog(connectionProfileWithEmptySavedPassword, ConnectionType.editor, uri, connectionResult, false);
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('doChangeLanguageFlavor should throw on unknown provider', done => {
		// given a provider that will never exist
		let invalidProvider = 'notaprovider';
		// when I call doChangeLanguageFlavor
		// Then I expect it to throw
		assert.throws(() => connectionManagementService.doChangeLanguageFlavor('file://my.sql', 'sql', invalidProvider));
		done();
	});

	test('doChangeLanguageFlavor should send event for known provider', done => {
		// given a provider that is registered
		let uri = 'file://my.sql';
		let language = 'sql';
		let flavor = 'MSSQL';
		// when I call doChangeLanguageFlavor
		try {
			let called = false;
			connectionManagementService.onLanguageFlavorChanged((changeParams: sqlops.DidChangeLanguageFlavorParams) => {
				called = true;
				assert.equal(changeParams.uri, uri);
				assert.equal(changeParams.language, language);
				assert.equal(changeParams.flavor, flavor);
			});
			connectionManagementService.doChangeLanguageFlavor(uri, language, flavor);
			assert.ok(called, 'expected onLanguageFlavorChanged event to be sent');
			done();
		} catch (error) {
			done(error);
		}
	});

	test('ensureDefaultLanguageFlavor should not send event if uri is connected', done => {
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
		connectionManagementService.onLanguageFlavorChanged((changeParams: sqlops.DidChangeLanguageFlavorParams) => {
			called = true;
		});
		connect(uri, options).then(() => {
			connectionManagementService.ensureDefaultLanguageFlavor(uri);
			assert.equal(called, false, 'do not expect flavor change to be called');
			done();
		}).catch(err => {
			done(err);
		});
	});

	test('getConnectionId returns the URI associated with a connection that has had its database filled in', done => {
		// Set up the connection management service with a connection corresponding to a default database
		let dbName = 'master';
		let serverName = 'test_server';
		let userName = 'test_user';
		let connectionProfileWithoutDb: IConnectionProfile = Object.assign(connectionProfile,
			{ serverName: serverName, databaseName: '', userName: userName, getOptionsKey: () => undefined });
		let connectionProfileWithDb: IConnectionProfile = Object.assign(connectionProfileWithoutDb, { databaseName: dbName });
		// Save the database with a URI that has the database name filled in, to mirror Carbon's behavior
		let ownerUri = Utils.generateUri(connectionProfileWithDb);
		connect(ownerUri, undefined, false, connectionProfileWithoutDb).then(() => {
			try {
				// If I get the URI for the connection with or without a database from the connection management service
				let actualUriWithDb = connectionManagementService.getConnectionId(connectionProfileWithDb);
				let actualUriWithoutDb = connectionManagementService.getConnectionId(connectionProfileWithoutDb);

				// Then the retrieved URIs should match the one on the connection
				let expectedUri = Utils.generateUri(connectionProfileWithoutDb);
				assert.equal(actualUriWithDb, expectedUri);
				assert.equal(actualUriWithoutDb, expectedUri);
				done();
			} catch (err) {
				done(err);
			}
		}, err => done(err));
	});

	test('getTabColorForUri returns undefined when there is no connection for the given URI', () => {
		let connectionManagementService = createConnectionManagementService();
		let color = connectionManagementService.getTabColorForUri('invalidUri');
		assert.equal(color, undefined);
	});

	test('getTabColorForUri returns the group color corresponding to the connection for a URI', done => {
		// Set up the connection store to give back a group for the expected connection profile
		configResult['tabColorMode'] = 'border';
		let expectedColor = 'red';
		connectionStore.setup(x => x.getGroupFromId(connectionProfile.groupId)).returns(() => <IConnectionProfileGroup>{
			color: expectedColor
		});
		let uri = 'testUri';
		connect(uri).then(() => {
			try {
				let tabColor = connectionManagementService.getTabColorForUri(uri);
				assert.equal(tabColor, expectedColor);
				done();
			} catch (e) {
				done(e);
			}
		}, err => done(err));
	});

	test('getActiveConnectionCredentials returns the credentials dictionary for a connection profile', () => {
		let profile = Object.assign({}, connectionProfile);
		profile.options = {password: profile.password};
		profile.id = 'test_id';
		connectionStatusManager.addConnection(profile, 'test_uri');
		(connectionManagementService as any)._connectionStatusManager = connectionStatusManager;
		let credentials = connectionManagementService.getActiveConnectionCredentials(profile.id);
		assert.equal(credentials['password'], profile.options['password']);
	});
});