/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { Emitter } from 'vs/base/common/event';
import { TPromise } from 'vs/base/common/winjs.base';

import { ISelectionData } from 'sqlops';

import {
	IConnectionManagementService,
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import { ConnectionDialogService } from 'sql/parts/connection/connectionDialog/connectionDialogService';
import { RunQueryAction, CancelQueryAction, ListDatabasesActionItem, QueryTaskbarAction } from 'sql/parts/query/execution/queryActions';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { QueryModelService } from 'sql/parts/query/execution/queryModelService';
import { ConnectionManagementService } from 'sql/parts/connection/common/connectionManagementService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

import { TestThemeService } from 'sqltest/stubs/themeTestService';

import { ConfigurationService } from 'vs/platform/configuration/node/configurationService';

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';

let none: void;

suite('SQL QueryAction Tests', () => {

	let testUri: string = 'testURI';
	let editor: TypeMoq.Mock<QueryEditor>;
	let calledRunQueryOnInput: boolean = undefined;
	let testQueryInput: TypeMoq.Mock<QueryInput>;
	let configurationService: TypeMoq.Mock<ConfigurationService>;

	setup(() => {
		// Setup a reusable mock QueryInput
		testQueryInput = TypeMoq.Mock.ofType(QueryInput, TypeMoq.MockBehavior.Strict);
		testQueryInput.setup(x => x.uri).returns(() => testUri);
		testQueryInput.setup(x => x.runQuery(undefined)).callback(() => { calledRunQueryOnInput = true; });

		// Setup a reusable mock QueryEditor
		editor = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Strict, undefined, new TestThemeService());
		editor.setup(x => x.input).returns(() => testQueryInput.object);

		configurationService = TypeMoq.Mock.ofInstance({
			getValue: () => undefined,
			onDidChangeConfiguration: () => undefined
		} as any);
		configurationService.setup(x => x.getValue(TypeMoq.It.isAny())).returns(() => {
			return {};
		});
	});

	test('setClass sets child CSS class correctly', (done) => {
		// If I create a RunQueryAction
		let queryAction = new RunQueryAction();

		// "class should automatically get set to include the base class and the RunQueryAction class
		let className = RunQueryAction.EnabledClass;
		assert.equal(queryAction.class, className, 'CSS class not properly set');
		done();
	});

	test('RunQueryAction calls runQuery() only if URI is connected', (done) => {
		// ... Create assert variables
		let isConnected: boolean = undefined;
		let connectionParams: INewConnectionParams = undefined;
		let calledRunQuery: boolean = false;
		let countCalledShowDialog: number = 0;

		// ... Mock "showDialog" ConnectionDialogService
		let connectionDialogService = TypeMoq.Mock.ofType(ConnectionDialogService, TypeMoq.MockBehavior.Loose);
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, undefined))
			.callback((service: IConnectionManagementService, params: INewConnectionParams) => {
				connectionParams = params;
				countCalledShowDialog++;
			})
			.returns(() => TPromise.as(none));

		// ... Mock "isConnected" in ConnectionManagementService
		let connectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {}, connectionDialogService.object);
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);

		// ... Mock QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);
		queryModelService.setup(x => x.runQuery(TypeMoq.It.isAny(), undefined, TypeMoq.It.isAny(), TypeMoq.It.isAny())).callback(() => {
			calledRunQuery = true;
		});

		// If I call run on RunQueryAction when I am not connected
		let queryAction: RunQueryAction = new RunQueryAction();
		isConnected = false;
		calledRunQueryOnInput = false;
		queryAction.run({ input: undefined, editor: undefined });

		// runQuery should not be run
		assert.equal(calledRunQueryOnInput, false, 'run should not call runQuery');
		testQueryInput.verify(x => x.runQuery(undefined), TypeMoq.Times.never());

		// and the conneciton dialog should open with the correct parameter details
		assert.equal(countCalledShowDialog, 1, 'run should call showDialog');
		assert.equal(connectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(connectionParams.runQueryOnCompletion, RunQueryOnConnectionMode.executeQuery, 'runQueryOnCompletion should be true`');
		assert.equal(connectionParams.input.uri, testUri, 'URI should be set to the test URI');
		assert.equal(connectionParams.input, editor.object.input, 'Editor should be set to the mock editor');

		// If I call run on RunQueryAction when I am connected
		isConnected = true;
		queryAction.run({ input: undefined, editor: undefined });

		//runQuery should be run, and the conneciton dialog should not open
		assert.equal(calledRunQueryOnInput, true, 'run should call runQuery');
		testQueryInput.verify(x => x.runQuery(undefined), TypeMoq.Times.once());
		assert.equal(countCalledShowDialog, 1, 'run should not call showDialog');
		done();
	});

	test('Queries are only run if the QueryEditor selection is not empty', (done) => {
		// ... Create assert variables
		let isSelectionEmpty: boolean = undefined;
		let countCalledRunQuery: number = 0;

		// ... Mock "isSelectionEmpty" in QueryEditor
		let queryInput: TypeMoq.Mock<QueryInput> = TypeMoq.Mock.ofType(QueryInput, TypeMoq.MockBehavior.Strict);
		queryInput = TypeMoq.Mock.ofType(QueryInput, TypeMoq.MockBehavior.Strict);
		queryInput.setup(x => x.uri).returns(() => testUri);
		queryInput.setup(x => x.runQuery(undefined)).callback(() => {
			countCalledRunQuery++;
		});
		let queryEditor: TypeMoq.Mock<QueryEditor> = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Strict, undefined, new TestThemeService());
		queryEditor.setup(x => x.input).returns(() => queryInput.object);

		// ... Mock "isConnected" in ConnectionManagementService
		let connectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {});
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => true);

		// ... Mock QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);

		// If I call run on RunQueryAction when I have a non empty selection
		let queryAction: RunQueryAction = new RunQueryAction();
		isSelectionEmpty = false;
		queryAction.run({ input: queryInput.object, editor: undefined });

		//runQuery should be run
		assert.equal(countCalledRunQuery, 1, 'runQuery should be called');

		// If I call run on RunQueryAction when I have an empty selection
		isSelectionEmpty = true;
		queryAction.run({ input: queryInput.object, editor: undefined });

		//runQuery should not be run again
		assert.equal(countCalledRunQuery, 1, 'runQuery should not be called again');
		done();
	});

	test('ISelectionData is properly passed when queries are run', (done) => {

		/// Setup Test ///

		// ... Create assert variables
		let isConnected: boolean = undefined;
		let countCalledShowDialog: number = 0;
		let countCalledRunQuery: number = 0;
		let showDialogConnectionParams: INewConnectionParams = undefined;
		let runQuerySelection: ISelectionData = undefined;
		let selectionToReturnInGetSelection: ISelectionData = undefined;
		let predefinedSelection: ISelectionData = { startLine: 1, startColumn: 2, endLine: 3, endColumn: 4 };

		// ... Mock "showDialog" ConnectionDialogService
		let connectionDialogService = TypeMoq.Mock.ofType(ConnectionDialogService, TypeMoq.MockBehavior.Loose);
		connectionDialogService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), undefined, undefined))
			.callback((service: IConnectionManagementService, params: INewConnectionParams) => {
				showDialogConnectionParams = params;
				countCalledShowDialog++;
			})
			.returns(() => TPromise.as(none));

		// ... Mock "getSelection" in QueryEditor
		let queryInput = TypeMoq.Mock.ofType(QueryInput, TypeMoq.MockBehavior.Loose);
		queryInput.setup(x => x.uri).returns(() => testUri);
		queryInput.setup(x => x.runQuery(TypeMoq.It.isAny())).callback((selection: ISelectionData) => {
			runQuerySelection = selection;
			countCalledRunQuery++;
		});
		queryInput.setup(x => x.runQuery(undefined)).callback((selection: ISelectionData) => {
			runQuerySelection = selection;
			countCalledRunQuery++;
		});

		// ... Mock "getSelection" in QueryEditor
		let queryEditor: TypeMoq.Mock<QueryEditor> = TypeMoq.Mock.ofType(QueryEditor, TypeMoq.MockBehavior.Loose, undefined, new TestThemeService());
		queryEditor.setup(x => x.input).returns(() => queryInput.object);

		// ... Mock "isConnected" in ConnectionManagementService
		let connectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {}, connectionDialogService.object);
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);

		/// End Setup Test ///

		////// If I call run on RunQueryAction while disconnected and with an undefined selection
		let queryAction: RunQueryAction = new RunQueryAction();
		isConnected = false;
		selectionToReturnInGetSelection = undefined;
		queryAction.run({ input: queryInput.object, editor: undefined });

		// The conneciton dialog should open with an undefined seleciton
		assert.equal(countCalledShowDialog, 1, 'run should call showDialog');
		assert.equal(countCalledRunQuery, 0, 'run should not call runQuery');
		assert.equal(showDialogConnectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.equal(showDialogConnectionParams.querySelection, undefined, 'querySelection should be undefined');

		////// If I call run on RunQueryAction while disconnected and with a defined selection
		isConnected = false;
		selectionToReturnInGetSelection = predefinedSelection;
		queryAction.run({ input: queryInput.object, editor: undefined });

		// The conneciton dialog should open with the correct seleciton
		assert.equal(countCalledShowDialog, 2, 'run should call showDialog again');
		assert.equal(countCalledRunQuery, 0, 'run should not call runQuery');
		assert.equal(showDialogConnectionParams.connectionType, ConnectionType.editor, 'connectionType should be queryEditor');
		assert.notEqual(showDialogConnectionParams.querySelection, undefined, 'There should not be an undefined selection in runQuery');
		assert.equal(showDialogConnectionParams.querySelection.startLineNumber, selectionToReturnInGetSelection.startLine, 'startLine should match');
		assert.equal(showDialogConnectionParams.querySelection.startColumn, selectionToReturnInGetSelection.startColumn, 'startColumn should match');
		assert.equal(showDialogConnectionParams.querySelection.endLineNumber, selectionToReturnInGetSelection.endLine, 'endLine should match');
		assert.equal(showDialogConnectionParams.querySelection.endColumn, selectionToReturnInGetSelection.endColumn, 'endColumn should match');

		////// If I call run on RunQueryAction while connected and with an undefined selection
		isConnected = true;
		selectionToReturnInGetSelection = undefined;
		queryAction.run({ input: queryInput.object, editor: undefined });

		// The query should run with an undefined selection
		assert.equal(countCalledShowDialog, 2, 'run should not call showDialog');
		assert.equal(countCalledRunQuery, 1, 'run should call runQuery');
		assert.equal(runQuerySelection, undefined, 'There should be an undefined selection in runQuery');

		////// If I call run on RunQueryAction while connected and with a defined selection
		isConnected = true;
		selectionToReturnInGetSelection = predefinedSelection;
		queryAction.run({ input: queryInput.object, editor: undefined });

		// The query should run with the given seleciton
		assert.equal(countCalledShowDialog, 2, 'run should not call showDialog');
		assert.equal(countCalledRunQuery, 2, 'run should call runQuery again');
		assert.notEqual(runQuerySelection, undefined, 'There should not be an undefined selection in runQuery');
		assert.equal(runQuerySelection.startLine, selectionToReturnInGetSelection.startLine, 'startLine should match');
		assert.equal(runQuerySelection.startColumn, selectionToReturnInGetSelection.startColumn, 'startColumn should match');
		assert.equal(runQuerySelection.endLine, selectionToReturnInGetSelection.endLine, 'endLine should match');
		assert.equal(runQuerySelection.endColumn, selectionToReturnInGetSelection.endColumn, 'endColumn should match');

		done();
	});

	test('CancelQueryAction calls cancelQuery() only if URI is connected', (done) => {
		// ... Create assert variables
		let isConnected: boolean = undefined;
		let calledCancelQuery: boolean = false;

		// ... Mock "isConnected" in ConnectionManagementService
		let connectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {});
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);

		// ... Mock QueryModelService
		let queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose);
		queryModelService.setup(x => x.cancelQuery(TypeMoq.It.isAny())).callback(() => {
			calledCancelQuery = true;
		});

		// If I call run on CancelQueryAction when I am not connected
		let queryAction: CancelQueryAction = new CancelQueryAction(CancelQueryAction.ID, CancelQueryAction.LABEL, queryModelService.object, connectionManagementService.object);
		isConnected = false;
		queryAction.run({ input: undefined, editor: undefined });

		// cancelQuery should not be run
		assert.equal(calledCancelQuery, false, 'run should not call cancelQuery');

		// If I call run on CancelQueryAction when I am connected
		isConnected = true;
		queryAction.run({ input: undefined, editor: undefined });

		// cancelQuery should be run
		assert.equal(calledCancelQuery, true, 'run should call cancelQuery');
		done();
	});

	test('ListDatabaseItem shows items as expected', (done) => {
		// ... Create assert variables
		let listItem: ListDatabasesActionItem = undefined;
		let isConnected: boolean = undefined;
		let databaseName: string = undefined;

		// ... Mock "isConnected" in ConnectionManagementService
		let connectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {});
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAnyString())).returns(() => isConnected);
		connectionManagementService.setup(x => x.getConnectionProfile(TypeMoq.It.isAny())).returns(() => <IConnectionProfile>{
			databaseName: databaseName
		});

		// If I query without having initialized anything, state should be clear
		listItem = new ListDatabasesActionItem(undefined, undefined, configurationService.object, connectionManagementService.object, undefined);

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
		listItem.enabled = false;
		assert.equal(listItem.isEnabled(), false, 'do not expect dropdown enabled unless connected');
		assert.equal(listItem.currentDatabaseName, undefined, 'do not expect dropdown to have entries unless connected');

		done();
	});

	test('ListDatabaseItem - null event params', () => {
		// Setup:
		// ... Create event emitter we can use to trigger db changed event
		let dbChangedEmitter = new Emitter<IConnectionParams>();

		// ... Create mock connection management service
		let databaseName = 'foobar';
		let cms = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {});
		cms.callBase = true;
		cms.setup(x => x.onConnectionChanged).returns(() => dbChangedEmitter.event);
		cms.setup(x => x.getConnectionProfile(TypeMoq.It.isAny())).returns(() => <IConnectionProfile>{ databaseName: databaseName });

		// ... Create a database dropdown that has been connected
		let listItem = new ListDatabasesActionItem(undefined, undefined, configurationService.object, cms.object, undefined);
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
		let cms = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {});
		cms.callBase = true;
		cms.setup(x => x.onConnectionChanged).returns(() => dbChangedEmitter.event);
		cms.setup(x => x.getConnectionProfile(TypeMoq.It.isAny())).returns(() => <IConnectionProfile>{ databaseName: databaseName });

		// ... Create a database dropdown that has been connected
		let listItem = new ListDatabasesActionItem(undefined, undefined, configurationService.object, cms.object, undefined);
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
		let cms = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, {}, {});
		cms.callBase = true;
		cms.setup(x => x.onConnectionChanged).returns(() => dbChangedEmitter.event);

		// ... Create a database dropdown
		let listItem = new ListDatabasesActionItem(undefined, undefined, configurationService.object, cms.object, undefined);

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
});
