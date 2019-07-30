/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { CommandLineWorkbenchContribution } from 'sql/workbench/parts/commandLine/electron-browser/commandLine';
import * as Constants from 'sql/platform/connection/common/constants';
import { ParsedArgs } from 'vs/platform/environment/common/environment';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { TestCommandService } from 'vs/editor/test/browser/editorTestServices';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { assertThrowsAsync } from 'sqltest/utils/testUtils';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestEditorService } from 'vs/workbench/test/workbenchTestServices';
import { QueryInput, QueryEditorState } from 'sql/workbench/parts/query/common/queryInput';
import { URI } from 'vs/base/common/uri';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';

class TestParsedArgs implements ParsedArgs {
	[arg: string]: any;
	_: string[];
	aad?: boolean;
	add?: boolean;
	database?: string;
	command?: string;
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
	'max-memory'?: string;
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

	let capabilitiesService: TestCapabilitiesService;

	setup(() => {
		capabilitiesService = new TestCapabilitiesService();
	});

	function getCommandLineContribution(
		connectionManagementService: IConnectionManagementService,
		configurationService: IConfigurationService,
		capabilitiesService?: ICapabilitiesService,
		commandService?: ICommandService,
		editorService?: IEditorService,
		logService?: ILogService
	): CommandLineWorkbenchContribution {
		return new CommandLineWorkbenchContribution(
			capabilitiesService,
			connectionManagementService,
			undefined,
			undefined,
			undefined,
			editorService,
			commandService,
			configurationService,
			undefined,
			logService
		);
	}

	function getConfigurationServiceMock(showConnectDialogOnStartup: boolean): TypeMoq.Mock<IConfigurationService> {
		let configurationService = TypeMoq.Mock.ofType<IConfigurationService>(TestConfigurationService);
		configurationService.setup((c) => c.getValue(TypeMoq.It.isAnyString())).returns((config: string) => showConnectDialogOnStartup);
		return configurationService;
	}

	test('processCommandLine shows connection dialog by default', done => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog())
			.returns(() => new Promise<void>((resolve, reject) => { resolve(); }))
			.verifiable();
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => false);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => new Promise<string>((resolve, reject) => { resolve('unused'); }))
			.verifiable(TypeMoq.Times.never());
		const configurationService = getConfigurationServiceMock(true);
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object);
		contribution.processCommandLine(new TestParsedArgs()).then(() => {
			connectionManagementService.verifyAll();
			done();
		}, error => { assert.fail(error, null, 'processCommandLine rejected ' + error); done(); });
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
		try {
			await contribution.processCommandLine(new TestParsedArgs());
			connectionManagementService.verifyAll();
		} catch (error) {
			assert.fail(error, null, 'processCommandLine rejected ' + error);
		}
	});

	test('processCommandLine opens a new connection if a server name is passed', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		const args: TestParsedArgs = new TestParsedArgs();
		args.server = 'myserver';
		args.database = 'mydatabase';
		args.user = 'myuser';
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.sqlLogin), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		const configurationService = getConfigurationServiceMock(true);
		const logService = new NullLogService();
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, capabilitiesService, undefined, undefined, logService);
		await contribution.processCommandLine(args);
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
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, capabilitiesService, commandService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
		commandService.verifyAll();
		should(capturedArgs).be.undefined();
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
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, capabilitiesService, commandService.object);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
		commandService.verifyAll();
		should(actualProfile).not.be.undefined();
		should(actualProfile.connectionProfile.serverName).equal(args.server);

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
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, capabilitiesService, commandService.object);
		assertThrowsAsync(async () => await contribution.processCommandLine(args));
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
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.integrated), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		const configurationService = getConfigurationServiceMock(true);
		const logService = new NullLogService();
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, capabilitiesService, undefined, undefined, logService);
		await contribution.processCommandLine(args);
		connectionManagementService.verifyAll();
	});

	test('processCommandLine reuses saved connections that match args', async () => {
		const connectionManagementService: TypeMoq.Mock<IConnectionManagementService>
			= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		let connection = new ConnectionProfile(capabilitiesService, {
			connectionName: 'Test',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'myserver',
			databaseName: 'mydatabase',
			authenticationType: Constants.integrated,
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
			TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.integrated && p.connectionName === 'Test' && p.id === 'testID'), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			})
			.verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById('testID')).returns(() => originalProfile).verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(x => x.getConnectionGroups(TypeMoq.It.isAny())).returns(() => [conProfGroup]);
		const configurationService = getConfigurationServiceMock(true);
		const logService = new NullLogService();
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, capabilitiesService, undefined, undefined, logService);
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
		args._ = ['c:\\dir\\file.sql'];
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.getConnectionGroups(TypeMoq.It.isAny())).returns(() => []);
		let originalProfile: IConnectionProfile = undefined;
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.sqlLogin), 'connection', true))
			.returns((conn) => {
				originalProfile = conn;
				return Promise.resolve('unused');
			}).verifiable(TypeMoq.Times.once());
		connectionManagementService.setup(c => c.getConnectionProfileById(TypeMoq.It.isAnyString())).returns(() => originalProfile);
		const configurationService = getConfigurationServiceMock(true);
		const queryInput: TypeMoq.Mock<QueryInput> = TypeMoq.Mock.ofType<QueryInput>(QueryInput);
		let uri = URI.file(args._[0]);
		const queryState = new QueryEditorState();
		queryState.connected = true;
		queryInput.setup(q => q.state).returns(() => queryState);
		queryInput.setup(q => q.getResource()).returns(() => uri).verifiable(TypeMoq.Times.once());
		const editorService: TypeMoq.Mock<IEditorService> = TypeMoq.Mock.ofType<IEditorService>(TestEditorService, TypeMoq.MockBehavior.Strict);
		editorService.setup(e => e.editors).returns(() => [queryInput.object]);
		connectionManagementService.setup(c =>
			c.connect(TypeMoq.It.is<ConnectionProfile>(p => p.serverName === 'myserver' && p.authenticationType === Constants.sqlLogin),
				uri.toString(),
				TypeMoq.It.is<IConnectionCompletionOptions>(i => i.params.input === queryInput.object && i.params.connectionType === ConnectionType.editor))
		).verifiable(TypeMoq.Times.once());
		let contribution = getCommandLineContribution(connectionManagementService.object, configurationService.object, capabilitiesService, undefined, editorService.object);
		await contribution.processCommandLine(args);
		queryInput.verifyAll();
		connectionManagementService.verifyAll();
	});
});
