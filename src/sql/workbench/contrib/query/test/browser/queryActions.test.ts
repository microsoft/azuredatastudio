/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';

import {
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode
} from 'sql/platform/connection/common/connectionManagement';
import {
	RunQueryAction, CancelQueryAction, ListDatabasesActionItem,
	DisconnectDatabaseAction, ConnectDatabaseAction, QueryTaskbarAction
} from 'sql/workbench/contrib/query/browser/queryActions';
import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { QueryModelService } from 'sql/workbench/services/query/common/queryModelService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { TestFileService, workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { UntitledQueryEditorInput } from 'sql/workbench/common/editor/query/untitledQueryEditorInput';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TestQueryModelService } from 'sql/workbench/services/query/test/common/testQueryModelService';
import { URI } from 'vs/base/common/uri';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IRange } from 'vs/editor/common/core/range';

suite('SQL QueryAction Tests', () => {

	let testUri: string = 'testURI';
	let editor: TypeMoq.Mock<QueryEditor>;
	let calledRunQueryOnInput: boolean = undefined;
	let testQueryInput: TypeMoq.Mock<UntitledQueryEditorInput>;
	let configurationService: TypeMoq.Mock<TestConfigurationService>;
	let queryModelService: TypeMoq.Mock<TestQueryModelService>;
	let connectionManagementService: TypeMoq.Mock<TestConnectionManagementService>;

	setup(() => {

		const contextkeyservice = new MockContextKeyService();

		// Setup a reusable mock QueryEditor
		editor = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Strict, undefined, new TestThemeService(),
			new TestStorageService(), contextkeyservice, undefined, new TestFileService(), undefined);
		editor.setup(x => x.input).returns(() => testQueryInput.object);

		editor.setup(x => x.getSelection()).returns(() => undefined);
		editor.setup(x => x.getSelection(false)).returns(() => undefined);
		editor.setup(x => x.isSelectionEmpty()).returns(() => false);
		configurationService = TypeMoq.Mock.ofInstance({
			getValue: () => undefined,
			onDidChangeConfiguration: () => undefined
		} as any);
		configurationService.setup(x => x.getValue(TypeMoq.It.isAny())).returns(() => {
			return {};
		});
		queryModelService = TypeMoq.Mock.ofType<TestQueryModelService>(TestQueryModelService);
		queryModelService.setup(q => q.onRunQueryStart).returns(() => Event.None);
		queryModelService.setup(q => q.onRunQueryComplete).returns(() => Event.None);
		connectionManagementService = TypeMoq.Mock.ofType<TestConnectionManagementService>(TestConnectionManagementService);
		connectionManagementService.setup(q => q.onDisconnect).returns(() => Event.None);
		const workbenchinstantiationService = workbenchInstantiationService();
		const accessor = workbenchinstantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		let fileInput = workbenchinstantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: URI.parse('file://testUri') }));
		// Setup a reusable mock QueryInput
		testQueryInput = TypeMoq.Mock.ofType(UntitledQueryEditorInput, TypeMoq.MockBehavior.Strict, undefined, fileInput, undefined, connectionManagementService.object, queryModelService.object, configurationService.object);
		testQueryInput.setup(x => x.uri).returns(() => testUri);
		testQueryInput.setup(x => x.runQuery(undefined)).callback(() => { calledRunQueryOnInput = true; });
	});

	test('setClass sets child CSS class correctly', () => {
		// If I create a RunQueryAction
		let queryAction: QueryTaskbarAction = new RunQueryAction(undefined, undefined, undefined);

		// "class should automatically get set to include the base class and the RunQueryAction class
		let className = RunQueryAction.EnabledClass;
		assert.equal(queryAction.class, className, 'CSS class not properly set');
	});

	test('getConnectedQueryEditorUri returns connected URI only if connected', () => {
		// ... Create assert variables
		let isConnectedReturnValue: boolean = false;

		// ... Mock "isConnected in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnectedReturnValue);

		const contextkeyservice = new MockContextKeyService();

		// Setup a reusable mock QueryEditor
		editor = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Strict, undefined, new TestThemeService(),
			new TestStorageService(), contextkeyservice, undefined, new TestFileService(), undefined);
		editor.setup(x => x.input).returns(() => testQueryInput.object);

		// If I create a QueryTaskbarAction and I pass a non-connected editor to _getConnectedQueryEditorUri
		let queryAction: QueryTaskbarAction = new RunQueryAction(undefined, undefined, connectionManagementService.object);
		let connected: boolean = queryAction.isConnected(editor.object);

		// I should get an unconnected state
		assert(!connected, 'Non-connected editor should get back an undefined URI');

		// If I run with a connected URI
		isConnectedReturnValue = true;
		connected = queryAction.isConnected(editor.object);

		// I should get a connected state
		assert(connected, 'Connected editor should get back a non-undefined URI');
	});

	test('RunQueryAction calls runQuery() only if URI is connected', async () => {
		// ... Create assert variables
		let isConnected: boolean = undefined;
		let connectionParams: INewConnectionParams = undefined;
		let countCalledShowDialog: number = 0;

		// ... Mock "isConnected" in ConnectionManagementService
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);
		connectionManagementService.setup(x => x.showConnectionDialog(TypeMoq.It.isAny()))
			.callback((params: INewConnectionParams) => {
				connectionParams = params;
				countCalledShowDialog++;
			})
			.returns(() => Promise.resolve());

		// ... Mock QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);
		queryModelService.setup(x => x.runQuery(TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny()));

		// If I call run on RunQueryAction when I am not connected
		let queryAction: RunQueryAction = new RunQueryAction(editor.object, queryModelService.object, connectionManagementService.object);
		isConnected = false;
		calledRunQueryOnInput = false;
		await queryAction.run();

		// runQuery should not be run
		assert.equal(calledRunQueryOnInput, false, 'run should not call runQuery');
		testQueryInput.verify(x => x.runQuery(undefined), TypeMoq.Times.never());

		// and the connection dialog should open with the correct parameter details
		assert.equal(connectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(connectionParams.runQueryOnCompletion, RunQueryOnConnectionMode.executeQuery, 'runQueryOnCompletion should be true`');
		assert.equal(connectionParams.input.uri, testUri, 'URI should be set to the test URI');
		assert.equal(connectionParams.input, editor.object.input, 'Editor should be set to the mock editor');

		// If I call run on RunQueryAction when I am connected
		isConnected = true;
		await queryAction.run();

		//runQuery should be run, and the conneciton dialog should not open
		assert.equal(calledRunQueryOnInput, true, 'run should call runQuery');
		testQueryInput.verify(x => x.runQuery(undefined), TypeMoq.Times.once());

		assert.equal(countCalledShowDialog, 1, 'run should not call showDialog');
	});

	test('Queries are only run if the QueryEditor selection is not empty', async () => {
		// ... Create assert variables
		let isSelectionEmpty: boolean = undefined;
		let countCalledRunQuery: number = 0;

		// ... Mock "isConnected" in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => true);

		// ... Mock QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);
		queryModelService.setup(x => x.onRunQueryStart).returns(() => Event.None);
		queryModelService.setup(x => x.onRunQueryComplete).returns(() => Event.None);
		const workbenchinstantiationService = workbenchInstantiationService();
		const accessor = workbenchinstantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		let fileInput = workbenchinstantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: URI.parse('file://testUri') }));

		// ... Mock "isSelectionEmpty" in QueryEditor
		let queryInput = TypeMoq.Mock.ofType(UntitledQueryEditorInput, TypeMoq.MockBehavior.Strict, undefined, fileInput, undefined, connectionManagementService.object, queryModelService.object, configurationService.object);
		queryInput.setup(x => x.uri).returns(() => testUri);
		queryInput.setup(x => x.runQuery(undefined)).callback(() => {
			countCalledRunQuery++;
		});
		const contextkeyservice = new MockContextKeyService();

		// Setup a reusable mock QueryEditor
		let queryEditor = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Strict, undefined, new TestThemeService(),
			new TestStorageService(), contextkeyservice, undefined, new TestFileService(), undefined);
		queryEditor.setup(x => x.input).returns(() => queryInput.object);
		queryEditor.setup(x => x.getSelection()).returns(() => undefined);
		queryEditor.setup(x => x.getSelection(false)).returns(() => undefined);
		queryEditor.setup(x => x.isSelectionEmpty()).returns(() => isSelectionEmpty);

		// If I call run on RunQueryAction when I have a non empty selection
		let queryAction: RunQueryAction = new RunQueryAction(queryEditor.object, queryModelService.object, connectionManagementService.object);
		isSelectionEmpty = false;
		await queryAction.run();

		//runQuery should be run
		assert.equal(countCalledRunQuery, 1, 'runQuery should be called');

		// If I call run on RunQueryAction when I have an empty selection
		isSelectionEmpty = true;
		await queryAction.run();

		//runQuery should not be run again
		assert.equal(countCalledRunQuery, 1, 'runQuery should not be called again');
	});

	test('ISelectionData is properly passed when queries are run', async () => {

		/// Setup Test ///

		// ... Create assert variables
		let isConnected: boolean = undefined;
		let countCalledShowDialog: number = 0;
		let countCalledRunQuery: number = 0;
		let showDialogConnectionParams: INewConnectionParams = undefined;
		let runQuerySelection: IRange = undefined;
		let selectionToReturnInGetSelection: IRange = undefined;
		let predefinedSelection: IRange = { startLineNumber: 1, startColumn: 2, endLineNumber: 3, endColumn: 4 };

		// ... Mock "getSelection" in QueryEditor
		const workbenchinstantiationService = workbenchInstantiationService();
		const accessor = workbenchinstantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		let fileInput = workbenchinstantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: URI.parse('file://testUri') }));

		let queryInput = TypeMoq.Mock.ofType(UntitledQueryEditorInput, TypeMoq.MockBehavior.Loose, undefined, fileInput, undefined, connectionManagementService.object, queryModelService.object, configurationService.object);
		queryInput.setup(x => x.uri).returns(() => testUri);
		queryInput.setup(x => x.runQuery(TypeMoq.It.isAny())).callback((selection: IRange) => {
			runQuerySelection = selection;
			countCalledRunQuery++;
		});
		queryInput.setup(x => x.runQuery(undefined)).callback((selection: IRange) => {
			runQuerySelection = selection;
			countCalledRunQuery++;
		});
		const contextkeyservice = new MockContextKeyService();

		// Setup a reusable mock QueryEditor
		let queryEditor = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Strict, undefined, new TestThemeService(),
			new TestStorageService(), contextkeyservice, undefined, new TestFileService(), undefined);
		queryEditor.setup(x => x.input).returns(() => queryInput.object);
		queryEditor.setup(x => x.isSelectionEmpty()).returns(() => false);
		queryEditor.setup(x => x.getSelection()).returns(() => {
			return selectionToReturnInGetSelection;
		});
		queryEditor.setup(x => x.getSelection(TypeMoq.It.isAny())).returns(() => {
			return selectionToReturnInGetSelection;
		});

		// ... Mock "isConnected" in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);
		connectionManagementService.setup(x => x.showConnectionDialog(TypeMoq.It.isAny()))
			.callback((params: INewConnectionParams) => {
				showDialogConnectionParams = params;
				countCalledShowDialog++;
			})
			.returns(() => Promise.resolve());

		/// End Setup Test ///

		////// If I call run on RunQueryAction while disconnected and with an undefined selection
		let queryAction: RunQueryAction = new RunQueryAction(queryEditor.object, undefined, connectionManagementService.object);
		isConnected = false;
		selectionToReturnInGetSelection = undefined;
		await queryAction.run();

		// The conneciton dialog should open with an undefined seleciton
		assert.equal(countCalledShowDialog, 1, 'run should call showDialog');
		assert.equal(countCalledRunQuery, 0, 'run should not call runQuery');
		assert.equal(showDialogConnectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(showDialogConnectionParams.queryRange, undefined, 'querySelection should be undefined');

		////// If I call run on RunQueryAction while disconnected and with a defined selection
		isConnected = false;
		selectionToReturnInGetSelection = predefinedSelection;
		await queryAction.run();

		// The conneciton dialog should open with the correct seleciton
		assert.equal(countCalledShowDialog, 2, 'run should call showDialog again');
		assert.equal(countCalledRunQuery, 0, 'run should not call runQuery');
		assert.equal(showDialogConnectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.notEqual(showDialogConnectionParams.queryRange, undefined, 'There should not be an undefined selection in runQuery');
		assert.equal(showDialogConnectionParams.queryRange.startLineNumber, selectionToReturnInGetSelection.startLineNumber, 'startLine should match');
		assert.equal(showDialogConnectionParams.queryRange.startColumn, selectionToReturnInGetSelection.startColumn, 'startColumn should match');
		assert.equal(showDialogConnectionParams.queryRange.endLineNumber, selectionToReturnInGetSelection.endLineNumber, 'endLine should match');
		assert.equal(showDialogConnectionParams.queryRange.endColumn, selectionToReturnInGetSelection.endColumn, 'endColumn should match');

		////// If I call run on RunQueryAction while connected and with an undefined selection
		isConnected = true;
		selectionToReturnInGetSelection = undefined;
		await queryAction.run();

		// The query should run with an undefined selection
		assert.equal(countCalledShowDialog, 2, 'run should not call showDialog');
		assert.equal(countCalledRunQuery, 1, 'run should call runQuery');
		assert.equal(runQuerySelection, undefined, 'There should be an undefined selection in runQuery');

		////// If I call run on RunQueryAction while connected and with a defined selection
		isConnected = true;
		selectionToReturnInGetSelection = predefinedSelection;
		await queryAction.run();

		// The query should run with the given seleciton
		assert.equal(countCalledShowDialog, 2, 'run should not call showDialog');
		assert.equal(countCalledRunQuery, 2, 'run should call runQuery again');
		assert.notEqual(runQuerySelection, undefined, 'There should not be an undefined selection in runQuery');
		assert.equal(runQuerySelection.startLineNumber, selectionToReturnInGetSelection.startLineNumber, 'startLine should match');
		assert.equal(runQuerySelection.startColumn, selectionToReturnInGetSelection.startColumn, 'startColumn should match');
		assert.equal(runQuerySelection.endLineNumber, selectionToReturnInGetSelection.endLineNumber, 'endLine should match');
		assert.equal(runQuerySelection.endColumn, selectionToReturnInGetSelection.endColumn, 'endColumn should match');
	});

	test('CancelQueryAction calls cancelQuery() only if URI is connected', async () => {
		// ... Create assert variables
		let isConnected: boolean = undefined;
		let calledCancelQuery: boolean = false;

		// ... Mock "isConnected" in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);

		// ... Mock QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);
		queryModelService.setup(x => x.cancelQuery(TypeMoq.It.isAny())).callback(() => {
			calledCancelQuery = true;
		});

		// If I call run on CancelQueryAction when I am not connected
		let queryAction: CancelQueryAction = new CancelQueryAction(editor.object, queryModelService.object, connectionManagementService.object, undefined);
		isConnected = false;
		await queryAction.run();

		// cancelQuery should not be run
		assert.equal(calledCancelQuery, false, 'run should not call cancelQuery');

		// If I call run on CancelQueryAction when I am connected
		isConnected = true;
		await queryAction.run();

		// cancelQuery should be run
		assert.equal(calledCancelQuery, true, 'run should call cancelQuery');
	});

	// We want to call disconnectEditor regardless of connection to be able to cancel in-progress connections
	test('DisconnectDatabaseAction calls disconnectEditor regardless of URI being connected', async () => {
		// ... Create assert variables
		let isConnected: boolean = undefined;
		let countCalledDisconnectEditor: number = 0;

		// ... Mock "isConnected" and "disconnectEditor" in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);
		connectionManagementService.setup(x => x.disconnectEditor(TypeMoq.It.isAny())).callback(() => {
			countCalledDisconnectEditor++;
		});

		// If I call run on DisconnectDatabaseAction when I am not connected
		let queryAction: DisconnectDatabaseAction = new DisconnectDatabaseAction(editor.object, connectionManagementService.object);
		isConnected = false;
		await queryAction.run();

		// disconnectEditor should be run
		assert.equal(countCalledDisconnectEditor, 1, 'disconnectEditor should be called when URI is not connected');

		// If I call run on DisconnectDatabaseAction when I am connected
		isConnected = true;
		await queryAction.run();

		// disconnectEditor should be run again
		assert.equal(countCalledDisconnectEditor, 2, 'disconnectEditor should be called when URI is connected');
	});

	test('ConnectDatabaseAction opens dialog regardless of URI connection state', async () => {
		// ... Create assert variables
		let isConnected: boolean = undefined;
		let connectionParams: INewConnectionParams = undefined;
		let countCalledShowDialog: number = 0;

		// ... Mock "isConnected" in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);
		connectionManagementService.setup(x => x.showConnectionDialog(TypeMoq.It.isAny()))
			.callback((params: INewConnectionParams) => {
				connectionParams = params;
				countCalledShowDialog++;
			})
			.returns(() => Promise.resolve());

		// If I call run on ConnectDatabaseAction when I am not connected
		let queryAction: ConnectDatabaseAction = new ConnectDatabaseAction(editor.object, false, connectionManagementService.object);
		isConnected = false;
		await queryAction.run();

		// The conneciton dialog should open with the correct parameter details
		assert.equal(countCalledShowDialog, 1, 'run should call showDialog');
		assert.equal(connectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(connectionParams.runQueryOnCompletion, false, 'runQueryOnCompletion should be false`');
		assert.equal(connectionParams.input.uri, testUri, 'URI should be set to the test URI');
		assert.equal(connectionParams.input, editor.object.input, 'Editor should be set to the mock editor');

		// If I call run on ConnectDatabaseAction when I am connected
		isConnected = true;
		await queryAction.run();

		// The conneciton dialog should open again with the correct parameter details
		assert.equal(countCalledShowDialog, 2, 'run should call showDialog');
		assert.equal(connectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(connectionParams.runQueryOnCompletion, false, 'runQueryOnCompletion should be false`');
		assert.equal(connectionParams.input.uri, testUri, 'URI should be set to the test URI');
		assert.equal(connectionParams.input, editor.object.input, 'Editor should be set to the mock editor');
	});

	test('ChangeConnectionAction connects regardless of URI being connected', async () => {
		// ... Create assert variables
		let queryAction: ConnectDatabaseAction = undefined;
		let isConnected: boolean = undefined;
		let connectionParams: INewConnectionParams = undefined;
		let calledShowDialog: number = 0;

		// ... Mock "isConnected" in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);
		connectionManagementService.setup(x => x.showConnectionDialog(TypeMoq.It.isAny()))
			.callback((params: INewConnectionParams) => {
				calledShowDialog++;
				connectionParams = params;
			}).returns(() => Promise.resolve());

		// If I call run on ChangeConnectionAction when I am not connected
		queryAction = new ConnectDatabaseAction(editor.object, false, connectionManagementService.object);
		isConnected = false;
		await queryAction.run();

		// The connection dialog should open with the params set as below
		assert.equal(calledShowDialog, 1, 'showDialog should be called when URI is connected');
		assert.equal(connectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(connectionParams.runQueryOnCompletion, false, 'runQueryOnCompletion should be false`');
		assert.equal(connectionParams.input.uri, testUri, 'URI should be set to the test URI');
		assert.equal(connectionParams.input, editor.object.input, 'Editor should be set to the mock editor');
		// Then if I call run on ChangeConnectionAction when I am connected
		isConnected = true;
		await queryAction.run();

		// The conneciton dialog should open with the params set as below
		assert.equal(calledShowDialog, 2, 'showDialog should be called when URI is connected');
		assert.equal(connectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(connectionParams.runQueryOnCompletion, false, 'runQueryOnCompletion should be false`');
		assert.equal(connectionParams.input.uri, testUri, 'URI should be set to the test URI');
		assert.equal(connectionParams.input, editor.object.input, 'Editor should be set to the mock editor');
	});

	test('ListDatabaseItem shows items as expected', () => {
		// ... Create assert variables
		let listItem: ListDatabasesActionItem = undefined;
		let isConnected: boolean = undefined;
		let databaseName: string = undefined;

		// ... Mock "isConnected" in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);
		connectionManagementService.setup(x => x.onConnectionChanged).returns(() => Event.None);
		connectionManagementService.setup(x => x.getConnectionProfile(TypeMoq.It.isAny())).returns(() => <IConnectionProfile>{
			databaseName: databaseName
		});

		// If I query without having initialized anything, state should be clear
		listItem = new ListDatabasesActionItem(editor.object, undefined, connectionManagementService.object, undefined, configurationService.object, undefined);

		assert.equal(listItem.isEnabled(), false, 'do not expect dropdown enabled unless connected');
		assert.equal(listItem.currentDatabaseName, undefined, 'do not expect dropdown to have entries unless connected');

		// When I connect, database name should be returned in the dropdown and this should be enabled
		isConnected = true;
		databaseName = 'master';
		listItem.onConnected();
		assert.equal(listItem.isEnabled(), true, 'expect dropdown enabled when connected');
		assert.equal(listItem.currentDatabaseName, 'master', 'expect dropdown to have current DB name when connected');

		// When I disconnect, state should return to default
		isConnected = false;
		databaseName = undefined;
		listItem.onDisconnect();
		assert.equal(listItem.isEnabled(), false, 'do not expect dropdown enabled unless connected');
		assert.equal(listItem.currentDatabaseName, undefined, 'do not expect dropdown to have entries unless connected');
	});

	test('ListDatabaseItem - null event params', () => {
		// Setup:
		// ... Create event emitter we can use to trigger db changed event
		let dbChangedEmitter = new Emitter<IConnectionParams>();

		// ... Create mock connection management service
		let databaseName = 'foobar';
		connectionManagementService.setup(x => x.onConnectionChanged).returns(() => dbChangedEmitter.event);
		connectionManagementService.setup(x => x.getConnectionProfile(TypeMoq.It.isAny())).returns(() => <IConnectionProfile>{ databaseName: databaseName });

		// ... Create a database dropdown that has been connected
		let listItem = new ListDatabasesActionItem(editor.object, undefined, connectionManagementService.object, undefined, configurationService.object, undefined);
		listItem.onConnected();

		// If: I raise a connection changed event
		let eventParams = null;
		dbChangedEmitter.fire(eventParams);

		// Then: The selected database should not have changed
		assert.equal(listItem.currentDatabaseName, databaseName);
	});

	test('ListDatabaseItem - wrong uri', () => {
		// Setup:
		// ... Create event emitter we can use to trigger db changed event
		let dbChangedEmitter = new Emitter<IConnectionParams>();

		// ... Create mock connection management service that will not claim it's connected
		let databaseName = 'foobar';
		connectionManagementService.setup(x => x.onConnectionChanged).returns(() => dbChangedEmitter.event);
		connectionManagementService.setup(x => x.getConnectionProfile(TypeMoq.It.isAny())).returns(() => <IConnectionProfile>{ databaseName: databaseName });

		// ... Create a database dropdown that has been connected
		let listItem = new ListDatabasesActionItem(editor.object, undefined, connectionManagementService.object, undefined, configurationService.object, undefined);
		listItem.onConnected();

		// If: I raise a connection changed event for the 'wrong' URI
		let eventParams = <IConnectionParams>{
			connectionProfile: {
				databaseName: 'foobarbaz'
			},
			connectionUri: 'foobarUri'
		};
		dbChangedEmitter.fire(eventParams);

		// Then: The selected database should not have changed
		assert.equal(listItem.currentDatabaseName, databaseName);
	});

	test('ListDatabaseItem - updates when connected and uri matches', () => {
		// Setup:
		// ... Create event emitter we can use to trigger db changed event
		let dbChangedEmitter = new Emitter<IConnectionParams>();

		// ... Create mock connection management service
		connectionManagementService.setup(x => x.onConnectionChanged).returns(() => dbChangedEmitter.event);

		// ... Create a database dropdown
		let listItem = new ListDatabasesActionItem(editor.object, undefined, connectionManagementService.object, undefined, configurationService.object, undefined);

		// If: I raise a connection changed event
		let eventParams = <IConnectionParams>{
			connectionProfile: {
				databaseName: 'foobarbaz'
			},
			connectionUri: editor.object.input.uri
		};
		dbChangedEmitter.fire(eventParams);

		// Then:
		// ... The connection should have changed to the provided database
		assert.equal(listItem.currentDatabaseName, eventParams.connectionProfile.databaseName);
	});

	test('runCurrent - opens connection dialog when there are no active connections', async () => {
		// setting up environment
		let isConnected = false;
		let predefinedSelection: IRange = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
		let calledRunQueryStatementOnInput: boolean = undefined;

		// mocking query editor
		const contextkeyservice = new MockContextKeyService();
		let queryEditor = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Loose, undefined, new TestThemeService(),
			new TestStorageService(), contextkeyservice, undefined, new TestFileService(), undefined);
		queryEditor.setup(x => x.input).returns(() => testQueryInput.object);
		queryEditor.setup(x => x.getSelection(false)).returns(() => { return predefinedSelection; });

		// Mocking runQueryStatment in unititledQueryEditorInput
		testQueryInput.setup(x => x.runQueryStatement(TypeMoq.It.isAny())).callback(() => { calledRunQueryStatementOnInput = true; });

		// mocking isConnected in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);

		// mocking QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);
		queryModelService.setup(x => x.runQueryStatement(TypeMoq.It.isAny(), TypeMoq.It.isAny()));

		// Calling runCurrent with no open connection
		let queryAction: RunQueryAction = new RunQueryAction(queryEditor.object, queryModelService.object, connectionManagementService.object);
		calledRunQueryStatementOnInput = false;
		await queryAction.runCurrent();

		//connection dialog should open and runQueryStatement should not be called
		assert.equal(calledRunQueryStatementOnInput, false, 'runCurrent should not call runQueryStatement');
		testQueryInput.verify(x => x.runQueryStatement(TypeMoq.It.isAny()), TypeMoq.Times.never());
		connectionManagementService.verify(x => x.showConnectionDialog(TypeMoq.It.isAny()), TypeMoq.Times.once());


		// Calling runCurrent with an open connection
		isConnected = true;
		await queryAction.runCurrent();

		//connection dialog should not open and runQueryStatement should be called
		assert.equal(calledRunQueryStatementOnInput, true, 'runCurrent should call runQueryStatement');
		testQueryInput.verify(x => x.runQueryStatement(TypeMoq.It.isAny()), TypeMoq.Times.once());
		//show Dialog is not called
		connectionManagementService.verify(x => x.showConnectionDialog(TypeMoq.It.isAny()), TypeMoq.Times.once());

		// Calling runCurrent with empty Selection
		isConnected = true;
		calledRunQueryStatementOnInput = false;
		await queryAction.runCurrent();

		// Selection is empty
		queryEditor.setup(x => x.isSelectionEmpty()).returns(() => true);

		//connection dialog should not open and runQueryStatement should not be called
		assert.equal(calledRunQueryStatementOnInput, false, 'runCurrent should not call runQueryStatemet');
		connectionManagementService.verify(x => x.showConnectionDialog(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('runCurrent- calls appropriate run methods based on different selections', async () => {
		// setting up environment
		let calledRunQueryStatementOnInput: boolean = undefined;
		let predefinedCursorSelection: IRange = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
		let predefinedRangeSelection: IRange = { startLineNumber: 1, startColumn: 2, endLineNumber: 3, endColumn: 4 };

		// mocking query editor
		const contextkeyservice = new MockContextKeyService();
		let queryEditor = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Loose, undefined, new TestThemeService(),
			new TestStorageService(), contextkeyservice, undefined, new TestFileService(), undefined);
		queryEditor.setup(x => x.input).returns(() => testQueryInput.object);

		// mocking isConnected in ConnectionManagementService
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => true);

		// Mocking runQuery and runQueryStatement in unititledQueryEditorInput
		testQueryInput.setup(x => x.runQuery(TypeMoq.It.isAny())).callback(() => { calledRunQueryOnInput = true; });
		testQueryInput.setup(x => x.runQueryStatement(TypeMoq.It.isAny())).callback(() => { calledRunQueryStatementOnInput = true; });

		// mocking QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);
		queryModelService.setup(x => x.runQuery(TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny()));
		queryModelService.setup(x => x.runQueryStatement(TypeMoq.It.isAny(), TypeMoq.It.isAny()));

		let queryAction: RunQueryAction = new RunQueryAction(queryEditor.object, queryModelService.object, connectionManagementService.object);

		// setting up queryEditor with only a cursor. This case should call runQueryStatement
		queryEditor.setup(x => x.getSelection(false)).returns(() => { return predefinedCursorSelection; });
		calledRunQueryOnInput = false;
		calledRunQueryStatementOnInput = false;
		await queryAction.runCurrent();

		assert.equal(calledRunQueryStatementOnInput, true, 'runCurrent should call runQueryStatement');
		assert.equal(calledRunQueryOnInput, false, 'run should not call runQuery');

		// checking if runQuery statement is called with predefinedCursorSelection only
		testQueryInput.verify(x => x.runQueryStatement(TypeMoq.It.isValue(predefinedCursorSelection)), TypeMoq.Times.once());
		testQueryInput.verify(x => x.runQueryStatement(TypeMoq.It.isAny()), TypeMoq.Times.once());

		// checking if runQuery is not called at all
		testQueryInput.verify(x => x.runQuery(TypeMoq.It.isAny()), TypeMoq.Times.never());

		// setting up queryEditor with a selection range. This case should call runQuery
		queryEditor.setup(x => x.getSelection()).returns(() => { return predefinedRangeSelection; });
		queryEditor.setup(x => x.getSelection(false)).returns(() => { return predefinedRangeSelection; });

		calledRunQueryOnInput = false;
		calledRunQueryStatementOnInput = false;
		await queryAction.runCurrent();

		assert.equal(calledRunQueryStatementOnInput, false, 'runCurrent should not call runQueryStatement');
		assert.equal(calledRunQueryOnInput, true, 'run should call runQuery');

		// checking if runQuery is called with predefinedRangeSelection only
		testQueryInput.verify(x => x.runQuery(TypeMoq.It.isValue(predefinedRangeSelection)), TypeMoq.Times.once());
		testQueryInput.verify(x => x.runQuery(TypeMoq.It.isAny()), TypeMoq.Times.once());

		// checking if runQueryStatement is never called
		testQueryInput.verify(x => x.runQueryStatement(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});

class ServiceAccessor {
	constructor(
		@IUntitledTextEditorService public readonly untitledTextEditorService: IUntitledTextEditorService
	) { }
}
