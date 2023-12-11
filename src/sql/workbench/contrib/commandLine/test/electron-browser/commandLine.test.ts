/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { CommandLineWorkbenchContribution } from 'sql/workbench/contrib/commandLine/electron-sandbox/commandLine';
import * as Constants from 'sql/platform/connection/common/constants';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { TestCommandService } from 'vs/editor/test/browser/editorTestServices';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { TestEditorService, workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { TestQueryModelService } from 'sql/workbench/services/query/test/common/testQueryModelService';
import { Event } from 'vs/base/common/event';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { FileQueryEditorInput } from 'sql/workbench/browser/editor/query/fileQueryEditorInput';
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { NativeParsedArgs } from 'vs/platform/environment/common/argv';

class TestParsedArgs implements NativeParsedArgs {
	[arg: string]: any;
	_: string[];

	// Start: SQL Args
	aad?: boolean;
	applicationName?: string;
	authenticationType?: string;
	command?: string;
	connectionProperties?: string;
	database?: string;
	integrated?: boolean;
	provider?: string;
	server?: string;
	showDashboard?: boolean;
	user?: string;
	// End: SQL Args

	debugBrkPluginHost?: string;
	debugBrkSearch?: string;
	debugId?: string;
	debugPluginHost?: string;
	debugSearch?: string;
	diff?: boolean;
	'disable-crash-reporter'?: boolean;
	'disable-extension'?: string[]; // undefined or array of 1 or more
	'disable-extensions'?: boolean;
	'disable-restore-windows'?: boolean;
	'disable-telemetry'?: boolean;
	'disable-updates'?: boolean;
	'driver'?: string;
	'enable-proposed-api'?: string[];
	'export-default-configuration'?: string;
	'extensions-dir'?: string;
	extensionDevelopmentPath?: string[];
	extensionTestsPath?: string;
	'file-chmod'?: boolean;
	'file-write'?: boolean;
	'folder-uri'?: string[];
	goto?: boolean;
	help?: boolean;
	'install-extension'?: string[];
	'install-source'?: string;
	'list-extensions'?: boolean;
	locale?: string;
	log?: string[];
	logExtensionHostCommunication?: boolean;
	'max-memory'?: string;
	'new-window'?: boolean;
	'open-url'?: boolean;
	performance?: boolean;
	'prof-append-timers'?: string;
	'prof-startup'?: boolean;
	'prof-startup-prefix'?: string;
	'reuse-window'?: boolean;
	'show-versions'?: boolean;
	'skip-add-to-recently-opened'?: boolean;
	'skip-getting-started'?: boolean;
	'skip-release-notes'?: boolean;
	status?: boolean;
	'sticky-quickopen'?: boolean;
	'uninstall-extension'?: string[];
	'unity-launch'?: boolean; // Always open a new window, except if opening the first window or opening a file or folder as part of the launch.
	'upload-logs'?: string;
	'user-data-dir'?: string;
	_urls?: string[];
	verbose?: boolean;
	version?: boolean;
	wait?: boolean;
	waitMarkerFilePath?: string;
}
suite('commandLineService tests', () => {

	let _capabilitiesService: TestCapabilitiesService;
	let _notificationService: TestNotificationService;
	let _logService: NullLogService;
	setup(() => {
		_capabilitiesService = new TestCapabilitiesService();
		_notificationService = new TestNotificationService();
		_logService = new NullLogService();
	});

	function getCommandLineContribution(
		connectionManagementService: IConnectionManagementService,
		configurationService: IConfigurationService,
		capabilitiesService?: ICapabilitiesService,
		commandService?: ICommandService,
		editorService?: IEditorService,
		logService?: ILogService,
		dialogService?: IDialogService,
		notificationService?: INotificationService
	): CommandLineWorkbenchContribution {
		return new CommandLineWorkbenchContribution(
			capabilitiesService ?? _capabilitiesService,
			connectionManagementService,
			undefined,
			editorService,
			commandService,
			configurationService,
			notificationService ?? _notificationService,
			logService ?? _logService,
			undefined,
			undefined,
			dialogService
		);
	}

	function getConfigurationServiceMock(showConnectDialogOnStartup: boolean): TypeMoq.Mock<IConfigurationService> {
		let configurationService = TypeMoq.Mock.ofType<IConfigurationService>(TestConfigurationService);
		configurationService.setup((c) => c.getValue(TypeMoq.It.isAnyString())).returns((config: string) => showConnectDialogOnStartup);
		configurationService.object.onDidChangeConfiguration = Event.None;
		return configurationService;
	}

	test('processCommandLine shows connection dialog by default', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog(undefined, TypeMoq.It.isAny()))
			.returns(() => new Promise<void>((resolve, reject) => { resolve(); }))
			.verifiable();
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => false);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => new Promise<string>((resolve, reject) => { resolve('unused'); }))
			.verifiable(TypeMoq.Times.never());
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);
		await contribution.processCommandLine(new TestParsedArgs());
		connectionManagementService.verifyAll();
	});

	test('processCommandLine does nothing if no server name and command name is provided and the configuration \'workbench.showConnectDialogOnStartup\' is set to false, even if registered servers exist', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => false);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.verifiable(TypeMoq.Times.never());
		const configurationService = getConfigurationServiceMock(false);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);

		await contribution.processCommandLine(new TestParsedArgs());
		connectionManagementService.verifyAll();
	});

	test('processCommandLine does not connect if opening connection dialog', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		const commandService: TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		const dialogService = new TestDialogService({ confirmed: true });
		const args = new TestParsedArgs();
		args.command = 'openConnectionDialog';
		args.server = 'myserver';

		connectionManagementService.setup((c) => c.showConnectionDialog(undefined,
			TypeMoq.It.is<IConnectionCompletionOptions>(i => i.saveTheConnection && i.showConnectionDialogOnError && i.showDashboard && i.showFirewallRuleOnError),
			TypeMoq.It.isAny()))
			.verifiable(TypeMoq.Times.once());

		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => false);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.verifiable(TypeMoq.Times.never());
		const configurationService = getConfigurationServiceMock(false);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, commandService.object, undefined, _logService, dialogService, _notificationService);

		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
	});

	test('processCommandLine prompts user to handle unsupported providers', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		const args = new TestParsedArgs();
		args.provider = 'unknown';
		args.server = 'myserver';
		connectionManagementService.setup(c => c.handleUnsupportedProvider(TypeMoq.It.isAny()))
			.returns(() => TypeMoq.It.isAny())
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => false);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => new Promise<string>((resolve, reject) => { resolve('unused'); }))
			.verifiable(TypeMoq.Times.never());
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
	});

	test('processCommandLine does nothing if registered servers exist and no server name is provided', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => new Promise<string>((resolve, reject) => { resolve('unused'); }))
			.verifiable(TypeMoq.Times.never());
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);
		await contribution.processCommandLine(new TestParsedArgs());
		connectionManagementService.verifyAll();
	});

	test('processCommandLine opens a new connection if a server name is passed', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		let dialogService = new TestDialogService({ confirmed: true });

		const args: TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		args.user = 'myuser';
		args.authenticationType = Constants.AuthenticationType.SqlLogin;
		args.applicationName = 'myapplication';

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(
			p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.SqlLogin && p.options['applicationName'] === 'myapplication-azdata'), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, undefined, undefined, _logService, dialogService, _notificationService);
		await contribution.processCommandLine(args);
		assert.equal(originalProfile.options['applicationName'], 'myapplication-azdata', 'Application Name not received as expected.');
		connectionManagementService.verifyAll();
	});

	test('processCommandLine shows dashboard when requested', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		const args: TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		args.user = 'myuser';
		args.showDashboard = true;
		args.authenticationType = Constants.AuthenticationType.SqlLogin;

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.showDashboard(TypeMoq.It.isAny())).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
	});

	test('processCommandLine loads advanced options in args', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		let dialogService = new TestDialogService({ confirmed: true });

		const args: TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		args.user = 'myuser';
		args.authenticationType = Constants.AuthenticationType.SqlLogin;
		args.applicationName = 'myapplication';
		// Pass advanced connection properties
		args.connectionProperties = `{"trustServerCertificate":"true"}`;

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(
			p => p.serverName === 'myserver'
				&& p.authenticationType === Constants.AuthenticationType.SqlLogin
				&& p.options['applicationName'] === 'myapplication-azdata'), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, undefined, undefined, _logService, dialogService, _notificationService);
		await contribution.processCommandLine(args);
		assert.equal(originalProfile.options['applicationName'], 'myapplication-azdata', 'Application Name not received as expected.');
		assert.equal(originalProfile.options['trustServerCertificate'], 'true', 'Advanced option not received as expected.');
		connectionManagementService.verifyAll();
	});

	test('processCommandLine invokes a command without a profile parameter when no server is passed', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Loose);
		const commandService: TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		const args: TestParsedArgs = new TestParsedArgs();

		args.command = 'mycommand';
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.verifiable(TypeMoq.Times.never());
		let capturedArgs: any;
		commandService.setup(c => c.executeCommand(TypeMoq.It.isAnyString(), undefined))
			.returns((command, args) => {
				capturedArgs = args;
				return Promise.resolve();
			})
			.verifiable(TypeMoq.Times.once());
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, commandService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
		commandService.verifyAll();
		assert(isUndefinedOrNull(capturedArgs));
	});


	test('processCommandLine invokes a command with a profile parameter when a server is passed', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		const commandService: TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		const args: TestParsedArgs = new TestParsedArgs();
		args.command = 'mycommand';
		args.server = 'myserver';
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver'), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		let actualProfile: azdata.ConnectedContext = undefined;
		commandService.setup(c => c.executeCommand('mycommand', TypeMoq.It.isAny()))
			.returns((cmdName, profile) => {
				actualProfile = profile;
				return Promise.resolve();
			})
			.verifiable(TypeMoq.Times.once());
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, commandService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
		commandService.verifyAll();
		assert(!isUndefinedOrNull(actualProfile));
		assert.strictEqual(actualProfile.connectionProfile.serverName, args.server);

	});

	test('processCommandLine rejects unknown commands', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		const commandService: TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		const args: TestParsedArgs = new TestParsedArgs();

		args.command = 'mycommand';
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true);
		commandService.setup(c => c.executeCommand('mycommand'))
			.returns(() => Promise.reject(new Error('myerror')))
			.verifiable(TypeMoq.Times.once());
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, commandService.object);
		try {
			await contribution.processCommandLine(args);
			assert.fail('expected to throw');
		} catch (e) { }
	});

	test('processCommandLine uses Integrated auth if no user name or auth type is passed', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		const args: TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.Integrated), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
	});

	test('processCommandLine reuses saved connections that match args', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		let connection = new ConnectionProfile(_capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'myserver',
			databaseName: 'mydatabase',
			authenticationType: Constants.AuthenticationType.Integrated,
			password: undefined,
			userName: '',
			groupId: undefined,
			providerName: 'MSSQL',
			options: {},
			saveProfile: true,
			id: 'testID'
		});
		let conProfGroup = new ConnectionProfileGroup('testGroup', undefined, 'testGroup', undefined, undefined);
		conProfGroup.connections = [connection];
		const args: TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(
			TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.Integrated && p.connectionName === 'Test' && p.id === 'testID'), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById('testID')).returns(() => originalProfile).verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(x => x.getConnectionGroups(TypeMoq.It.isAny())).returns(() => [conProfGroup]);
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
	});

	test('processCommandLine connects opened query files to given server', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		const args: TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		args.user = 'myuser';
		args.authenticationType = Constants.AuthenticationType.SqlLogin;
		args._ = ['c:\\dir\\file.sql'];
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.SqlLogin), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			}).verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		connectionManagementService.setup(c => c.onDisconnect).returns(() => Event.None);
		connectionManagementService.setup(c => c.onConnectionChanged).returns(() => Event.None);
		connectionManagementService.setup(c => c.ensureDefaultLanguageFlavor(TypeMoq.It.isAny()));
		const configurationService = getConfigurationServiceMock(true);
		const querymodelService = TypeMoq.Mock.ofType<IQueryModelService>(TestQueryModelService, TypeMoq.MockBehavior.Strict);
		querymodelService.setup(c => c.onRunQueryStart).returns(() => Event.None);
		querymodelService.setup(c => c.onRunQueryComplete).returns(() => Event.None);
		let uri = URI.file(args._[0]);
		const workbenchinstantiationService = workbenchInstantiationService();
		const editorInput = workbenchinstantiationService.createInstance(FileEditorInput, uri, undefined, undefined, undefined, undefined, undefined, undefined);
		const queryInput = new FileQueryEditorInput(undefined, editorInput, undefined, connectionManagementService.object, querymodelService.object, configurationService.object, workbenchinstantiationService, undefined);
		queryInput.state.connected = true;
		const editorService: TypeMoq.Mock<IEditorService> = TypeMoq.Mock.ofType<IEditorService>(TestEditorService, TypeMoq.MockBehavior.Strict);
		editorService.setup(e => e.editors).returns(() => [queryInput]);
		connectionManagementService.setup(c =>
			c.connect(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.SqlLogin),
				uri.toString(),
				TypeMoq.It.is<IConnectionCompletionOptions>(i => i.params.input === queryInput && i.params.connectionType === ConnectionType.editor))
		).verifiable(TypeMoq.Times.once());
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, undefined, editorService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
	});

	suite('URL Handler', () => {

		let dialogService: TypeMoq.Mock<TestDialogService>;

		setup(() => {
			dialogService = TypeMoq.Mock.ofType(TestDialogService);
		});


		test('handleUrl ignores non-connect URLs', async () => {
			// Given a URI pointing to a server
			let uri: URI = URI.parse('azuredatastudio://file?server=myserver&database=mydatabase&user=myuser');

			const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
				= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
			const configurationService = getConfigurationServiceMock(true);
			const logService = new NullLogService();
			let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, undefined, undefined, logService, dialogService.object);

			// When I call the URL handler and user confirms they should connect
			dialogService.setup(d => d.confirm(TypeMoq.It.isAny())).returns(() => Promise.resolve({ confirmed: true }));
			let result = await contribution.handleURL(uri);

			// Then I expect connection management service to have been called
			assert.strictEqual(result, false, 'Expected URL to be ignored');
		});

		test('handleUrl opens a new connection if a server name is passed', async () => {
			// Given a URI pointing to a server
			let uri: URI = URI.parse('azuredatastudio://connect?server=myserver&database=mydatabase&user=myuser&authenticationType=SqlLogin');

			const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
				= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

			connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
			connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
			connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
			let originalProfile: IConnectionProfile = undefined;
			connectionManagementService.setup(c => c.connect(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.SqlLogin),
				undefined,
				TypeMoq.It.is<IConnectionCompletionOptions>(i => i.saveTheConnection && i.showConnectionDialogOnError && i.showDashboard && i.showFirewallRuleOnError))
			).verifiable(TypeMoq.Times.once());
			connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
			const configurationService = getConfigurationServiceMock(true);
			let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, undefined, undefined, _logService, dialogService.object);

			// When I call the URL handler and user confirms they should connect
			dialogService.setup(d => d.confirm(TypeMoq.It.isAny())).returns(() => Promise.resolve({ confirmed: true }));
			let result = await contribution.handleURL(uri);

			// Then I expect connection management service to have been called
			assert.strictEqual(result, true, 'Expected URL to be handled');
			connectionManagementService.verifyAll();
		});

		test('handleUrl does nothing if a user does not confirm', async () => {
			// Given a URI pointing to a server
			let uri: URI = URI.parse('azuredatastudio://connect?server=myserver&database=mydatabase&user=myuser');

			const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
				= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

			connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
			connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
			connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
			let originalProfile: IConnectionProfile = undefined;
			connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.SqlLogin), 'connection', true))
				.returns((conn) => {
					originalProfile = conn;
					return Promise.resolve('unused');
				})
				// Note: should not run since we expect to cancel before this
				.verifiable(TypeMoq.Times.never());
			connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
			const configurationService = getConfigurationServiceMock(true);
			let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, undefined, undefined, _logService, dialogService.object);

			// When I call the URL handler and user says no on confirmation dialog
			dialogService.setup(d => d.confirm(TypeMoq.It.isAny())).returns(() => Promise.resolve({ confirmed: false }));
			let result = await contribution.handleURL(uri);

			// Then I expect no connection, but the URL should still be handled
			assert.strictEqual(result, true, 'Expected URL to be handled');
			connectionManagementService.verifyAll();
		});

		test('handleUrl ignores commands', async () => {
			// Given I pass a command
			let uri: URI = URI.parse('azuredatastudio://connect?command=mycommand');

			const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
				= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
			const commandService: TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);

			connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true);
			commandService.setup(c => c.executeCommand('mycommand'))
				.returns(() => Promise.resolve())
				.verifiable(TypeMoq.Times.never());
			const configurationService = getConfigurationServiceMock(true);

			const notificationService = TypeMoq.Mock.ofType(TestNotificationService);
			notificationService.setup(n => n.warn(TypeMoq.It.isAny())).returns(() => undefined)
				.verifiable(TypeMoq.Times.once());
			let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, commandService.object, undefined, new NullLogService(), dialogService.object, notificationService.object);

			// When I handle the command URL
			let result = await contribution.handleURL(uri);

			// Then command service should not have been called, and instead connection should be handled
			assert.strictEqual(result, true);
			commandService.verifyAll();
			notificationService.verifyAll();
		});

		test('handleUrl ignores commands and connects', async () => {
			// Given I pass a command
			let uri: URI = URI.parse('azuredatastudio://connect?command=mycommand&server=myserver&database=mydatabase&user=myuser&authenticationType=SqlLogin');

			const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
				= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
			const commandService: TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);

			connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
			connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
			connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
			connectionManagementService.setup(c => c.connect(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.AuthenticationType.SqlLogin),
				undefined,
				TypeMoq.It.is<IConnectionCompletionOptions>(i => i.saveTheConnection && i.showConnectionDialogOnError && i.showDashboard && i.showFirewallRuleOnError))
			).verifiable(TypeMoq.Times.once());

			commandService.setup(c => c.executeCommand('mycommand'))
				.returns(() => Promise.resolve())
				.verifiable(TypeMoq.Times.never());
			const configurationService = getConfigurationServiceMock(true);

			const notificationService = TypeMoq.Mock.ofType(TestNotificationService);
			notificationService.setup(n => n.warn(TypeMoq.It.isAny())).returns(() => undefined)
				.verifiable(TypeMoq.Times.never());
			let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, _capabilitiesService, commandService.object, undefined, new NullLogService(), dialogService.object, notificationService.object);

			// When I handle the command URL
			dialogService.setup(d => d.confirm(TypeMoq.It.isAny())).returns(() => Promise.resolve({ confirmed: true }));
			let result = await contribution.handleURL(uri);

			// Then command service should not have been called, and instead connection should be handled
			assert.strictEqual(result, true);
			commandService.verifyAll();
			notificationService.verifyAll();
			connectionManagementService.verifyAll();
		});
	});
});
