/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as Constants from 'sql/platform/connection/common/constants';
import * as Utils from 'sql/platform/connection/common/utils';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import * as sqlops from 'sqlops';

import { TPromise } from 'vs/base/common/winjs.base';
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { CommandLineService } from 'sql/parts/commandLine/common/commandLineService';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { IEnvironmentService, ParsedArgs } from 'vs/platform/environment/common/environment';
import { CapabilitiesService, ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { QueryEditorService } from 'sql/parts/query/services/queryEditorService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import {
	IConnectionManagementService, IConnectionDialogService, INewConnectionParams,
	ConnectionType, IConnectableInput, IConnectionCompletionOptions, IConnectionCallbacks,
	IConnectionParams, IConnectionResult, IServerGroupController, IServerGroupDialogCallbacks,
	RunQueryOnConnectionMode
} from 'sql/platform/connection/common/connectionManagement';
import { ConnectionStore } from 'sql/platform/connection/common/connectionStore';
import { TestConnectionManagementService } from 'sqltest/stubs/connectionManagementService.test';
import { ICommandService, ICommandEvent, CommandsRegistry } from 'vs/platform/commands/common/commands';
import { TestCommandService } from 'vs/editor/test/browser/editorTestServices';

class TestParsedArgs implements ParsedArgs{
	[arg: string]: any;
	_: string[];
	aad?: boolean;
	add?: boolean;
	database?:string;
	command?:string;
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
		capabilitiesService? : ICapabilitiesService,
		commandService? : ICommandService
		) : CommandLineService
	{
		let service= new CommandLineService(
			connectionManagementService,
			capabilitiesService,
			environmentService,
			undefined,
			undefined,
			undefined,
			commandService
		);
		return service;
	}

	test('processCommandLine shows connection dialog by default', done => {
		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog())
			.returns(() =>  new Promise<void>((resolve, reject) => { resolve();}))
			.verifiable();
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => false);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() =>  new Promise<string>((resolve, reject) => { resolve('unused');}))
			.verifiable(TypeMoq.Times.never());
		let service = getCommandLineService(connectionManagementService.object);
		service.processCommandLine().then( () => {
			connectionManagementService.verifyAll();
			done();
		}, error => {assert.fail(error, null, 'processCommandLine rejected ' + error); done(); });
	});

	test('processCommandLine does nothing if registered servers exist and no server name is provided', done => {
		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() =>  new Promise<string>((resolve, reject) => { resolve('unused');}))
			.verifiable(TypeMoq.Times.never());
		let service = getCommandLineService(connectionManagementService.object);
		service.processCommandLine().then( () => {
			connectionManagementService.verifyAll();
			done();
		}, error => {assert.fail(error, null, 'processCommandLine rejected ' + error); done(); });
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
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), 'connection', true))
			.returns(() =>  new Promise<string>((resolve, reject) => { resolve('unused');}))
			.verifiable(TypeMoq.Times.once());
		let service = getCommandLineService(connectionManagementService.object, environmentService.object, capabilitiesService);
		service.processCommandLine().then( () => {
			environmentService.verifyAll();
			connectionManagementService.verifyAll();
			done();
		}, error => {assert.fail(error, null, 'processCommandLine rejected ' + error); done(); });
	});

	test('processCommandLine invokes a command without a profile parameter when no server is passed', done => {
		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		const environmentService : TypeMoq.Mock<IEnvironmentService> = TypeMoq.Mock.ofType<IEnvironmentService>(EnvironmentService);
		const commandService : TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		const args : TestParsedArgs = new TestParsedArgs();

		args.command = 'mycommand';
		environmentService.setup(e => e.args).returns(() => args);
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.verifiable(TypeMoq.Times.never());
		commandService.setup(c => c.executeCommand('mycommand'))
			.returns(() => TPromise.wrap(1))
			.verifiable(TypeMoq.Times.once());
		let service = getCommandLineService(connectionManagementService.object, environmentService.object, capabilitiesService, commandService.object);
		service.processCommandLine().then( () => {
			connectionManagementService.verifyAll();
			commandService.verifyAll();
			done();
		}, error => {assert.fail(error, null, 'processCommandLine rejected ' + error); done(); });
	});


	test('processCommandLine invokes a command with a profile parameter when a server is passed', done => {

		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);

		const environmentService : TypeMoq.Mock<IEnvironmentService> = TypeMoq.Mock.ofType<IEnvironmentService>(EnvironmentService);
		const commandService : TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		const args : TestParsedArgs = new TestParsedArgs();
		args.command = 'mycommand';
		args.server = 'myserver';
		environmentService.setup(e => e.args).returns(() => args);
		connectionManagementService.setup((c) => c.showConnectionDialog()).verifiable(TypeMoq.Times.never());
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true).verifiable(TypeMoq.Times.atMostOnce());
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.is<ConnectionProfile>( p => p.serverName === 'myserver'), 'connection', true))
			.returns(() =>  new Promise<string>((resolve, reject) => { resolve('unused');}))
			.verifiable(TypeMoq.Times.once());
		commandService.setup(c => c.executeCommand('mycommand', TypeMoq.It.is<ConnectionProfile>( p => p.serverName === 'myserver')))
			.returns(() => TPromise.wrap(1))
			.verifiable(TypeMoq.Times.once());
		let service = getCommandLineService(connectionManagementService.object, environmentService.object, capabilitiesService, commandService.object);
		service.processCommandLine().then( () => {
			connectionManagementService.verifyAll();
			commandService.verifyAll();
			done();
		}, error => {assert.fail(error, null, 'processCommandLine rejected ' + error); done(); });
	});

	test('processCommandLine rejects unknown commands', done => {
		const connectionManagementService : TypeMoq.Mock<IConnectionManagementService>
		= TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService, TypeMoq.MockBehavior.Strict);
		const environmentService : TypeMoq.Mock<IEnvironmentService> = TypeMoq.Mock.ofType<IEnvironmentService>(EnvironmentService);
		const commandService : TypeMoq.Mock<ICommandService> = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		const args : TestParsedArgs = new TestParsedArgs();

		args.command = 'mycommand';
		environmentService.setup(e => e.args).returns(() => args);
		connectionManagementService.setup(c => c.hasRegisteredServers()).returns(() => true);
		commandService.setup(c => c.executeCommand('mycommand'))
			.returns(() => TPromise.wrapError(new Error('myerror')))
			.verifiable(TypeMoq.Times.once());
		let service = getCommandLineService(connectionManagementService.object, environmentService.object, capabilitiesService, commandService.object);
		service.processCommandLine().then( () => {
			assert.fail(1,null, 'processCommandLine should reject when executeCommand errors out');
			done();
		}, error => {
			assert.equal(error.message, 'myerror', 'unexpected error from processCommandLine ' + error);
			done();
		});
	});
});
