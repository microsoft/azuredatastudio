/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { IEditorDescriptor } from 'vs/workbench/browser/editor';
import { TPromise } from 'vs/base/common/winjs.base';
import { URI } from 'vs/base/common/uri';
import * as DOM from 'vs/base/browser/dom';
import { Memento } from 'vs/workbench/common/memento';
import { Builder } from 'sql/base/browser/builder';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { QueryModelService } from 'sql/platform/query/common/queryModelService';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { INewConnectionParams, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';
import { RunQueryAction, ListDatabasesActionItem } from 'sql/parts/query/execution/queryActions';
import { EditorDescriptorService } from 'sql/workbench/services/queryEditor/common/editorDescriptorService';

import { TestThemeService } from 'sqltest/stubs/themeTestService';

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { ConfigurationService } from 'vs/platform/configuration/node/configurationService';
import { TestStorageService } from 'vs/workbench/test/workbenchTestServices';

suite('SQL QueryEditor Tests', () => {
	let queryModelService: QueryModelService;
	let instantiationService: TypeMoq.Mock<InstantiationService>;
	let themeService: TestThemeService = new TestThemeService();
	let notificationService: TypeMoq.Mock<INotificationService>;
	let editorDescriptorService: TypeMoq.Mock<EditorDescriptorService>;
	let connectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let configurationService: TypeMoq.Mock<ConfigurationService>;
	let memento: TypeMoq.Mock<Memento>;

	let queryInput: QueryInput;
	let queryInput2: QueryInput;
	let parentBuilder: Builder;
	let mockEditor: any;

	let getQueryEditor = function (): QueryEditor {
		return new QueryEditor(
			undefined,
			themeService,
			instantiationService.object,
			undefined,
			undefined,
			undefined,
			editorDescriptorService.object,
			undefined,
			undefined,
			configurationService.object,
			new TestStorageService());
	};

	setup(() => {
		// Setup DOM elements
		let element = DOM.$('queryEditorParent');
		parentBuilder = new Builder(element);

		// Create object to mock the Editor classes
		// QueryResultsEditor fails at runtime due to the way we are importing Angualar,
		// so a {} mock is used here. This mock simply needs to have empty method stubs
		// for all called runtime methods
		mockEditor = {
			_bootstrapAngular: function () { },
			setInput: function () { },
			createEditor: function () { },
			create: function () { },
			setVisible: function () { },
			layout: function () { },
			dispose: function () { }
		};

		// Mock InstantiationService to give us our mockEditor
		instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
			return new TPromise((resolve) => resolve(mockEditor));
		});
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((input) => {
			return new TPromise((resolve) => resolve(new RunQueryAction(undefined, undefined, undefined)));
		});
		// Setup hook to capture calls to create the listDatabase action
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((classDef, editor, action) => {
			if (classDef.ID) {
				if (classDef.ID === 'listDatabaseQueryActionItem') {
					return new ListDatabasesActionItem(editor, action, connectionManagementService.object, undefined, undefined, undefined, configurationService.object);
				}
			}
			// Default
			return new RunQueryAction(undefined, undefined, undefined);
		});

		// Mock EditorDescriptorService to give us a mock editor description
		let descriptor: IEditorDescriptor = {
			getId: function (): string { return 'id'; },
			getName: function (): string { return 'name'; },
			describes: function (obj: any): boolean { return true; },
			instantiate(instantiationService: IInstantiationService): BaseEditor { return undefined; }
		};
		editorDescriptorService = TypeMoq.Mock.ofType(EditorDescriptorService, TypeMoq.MockBehavior.Loose);
		editorDescriptorService.setup(x => x.getEditor(TypeMoq.It.isAny())).returns(() => descriptor);

		configurationService = TypeMoq.Mock.ofInstance({
			getValue: () => undefined,
			onDidChangeConfiguration: () => undefined
		} as any);
		configurationService.setup(x => x.getValue(TypeMoq.It.isAny())).returns(() => {
			return { enablePreviewFeatures: true };
		});

		// Create a QueryInput
		let filePath = 'file://someFile.sql';
		let uri: URI = URI.parse(filePath);
		let fileInput = new UntitledEditorInput(uri, false, '', '', '', instantiationService.object, undefined, undefined, undefined);
		let queryResultsInput: QueryResultsInput = new QueryResultsInput(uri.fsPath, configurationService.object);
		queryInput = new QueryInput('first', fileInput, queryResultsInput, undefined, undefined, undefined, undefined, undefined);

		// Create a QueryInput to compare to the previous one
		let filePath2 = 'file://someFile2.sql';
		let uri2: URI = URI.parse(filePath2);
		let fileInput2 = new UntitledEditorInput(uri2, false, '', '', '', instantiationService.object, undefined, undefined, undefined);
		let queryResultsInput2: QueryResultsInput = new QueryResultsInput(uri2.fsPath, configurationService.object);
		queryInput2 = new QueryInput('second', fileInput2, queryResultsInput2, undefined, undefined, undefined, undefined, undefined);

		// Mock IMessageService
		notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);

		// Mock ConnectionManagementService
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
		connectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined);
		connectionManagementService.callBase = true;
		connectionManagementService.setup(x => x.isConnected(TypeMoq.It.isAny())).returns(() => false);
		connectionManagementService.setup(x => x.disconnectEditor(TypeMoq.It.isAny())).returns(() => void 0);
		connectionManagementService.setup(x => x.ensureDefaultLanguageFlavor(TypeMoq.It.isAnyString())).returns(() => void 0);

		// Create a QueryModelService
		queryModelService = new QueryModelService(instantiationService.object, notificationService.object);
	});

	test('createEditor creates only the taskbar', (done) => {
		// If I call createEditor
		let editor: QueryEditor = getQueryEditor();
		editor.createEditor(parentBuilder.getHTMLElement());

		// The taskbar should be created
		assert.equal(!!editor.taskbar, true);
		assert.equal(!!editor.taskbarContainer, true);

		// But Nothing else should be created
		assert.equal(!!editor.getContainer(), false);
		assert.equal(!!editor.sqlEditor, false);
		assert.equal(!!editor.sqlEditorContainer, false);
		assert.equal(!!editor.resultsEditor, false);
		assert.equal(!!editor.resultsEditorContainer, false);
		assert.equal(!!editor.sash, false);
		assert.equal(!!editor._isResultsEditorVisible(), false);
		done();
	});

	/*
	test('setInput creates SQL components', (done) => {
		let assertInput = function () {
			// The taskbar SQL, and parent should be created
			assert.equal(!!editor.taskbar, true);
			assert.equal(!!editor.taskbarContainer, true);
			assert.equal(!!editor.getContainer(), true);
			assert.equal(!!editor.sqlEditor, true);
			assert.equal(!!editor.sqlEditorContainer, true);

			// But the results componenets should not
			assert.equal(!!editor.resultsEditor, false);
			assert.equal(!!editor.resultsEditorContainer, false);
			assert.equal(!!editor.sash, false);
			assert.equal(!!editor._isResultsEditorVisible(), false);
		};

		// If I call create a QueryEditor
		let editor: QueryEditor = getQueryEditor();
		editor.create(parentBuilder);

		return editor.setInput(queryInput) 	// Then I set the input
			.then(assertInput) 	// Only the taskbar SQL, and parent should be created
			.then(() => done(), (err) => done(err));
	});

	test('showQueryResultsEditor creates all components and pins editor', (done) => {
		// Mock EditorGroupService to get call count of pinEditor
		let editorGroupService = TypeMoq.Mock.ofType(TestEditorGroupService, TypeMoq.MockBehavior.Loose);

		// Make the call to showQueryResultsEditor thenable
		let showQueryResultsEditor = function () {
			return editor._showQueryResultsEditor();
		};

		// Make the asserts thenable
		let assertInput = function () {
			assert.equal(!!editor.taskbar, true);
			assert.equal(!!editor.taskbarContainer, true);
			assert.equal(!!editor.getContainer(), true);
			assert.equal(!!editor.sqlEditor, true);
			assert.equal(!!editor.sqlEditorContainer, true);
			assert.equal(!!editor.resultsEditor, true);
			assert.equal(!!editor.resultsEditorContainer, true);
			assert.equal(!!editor.sash, true);
			assert.equal(!!editor._isResultsEditorVisible(), true);
			editorGroupService.verify(x => x.pinEditor(undefined, TypeMoq.It.isAny()), TypeMoq.Times.once());
		};

		// If I create a QueryEditor
		let editor: QueryEditor = new QueryEditor(
			undefined,
			themeService,
			instantiationService.object,
			undefined,
			undefined,
			undefined,
			editorDescriptorService.object,
			editorGroupService.object,
			undefined,
			undefined);
		editor.create(parentBuilder);

		return editor.setInput(queryInput) // Then I set the input
			.then(showQueryResultsEditor) // Then call showQueryResultsEditor
			.then(assertInput) // Both editor windows should be created, and the editor should be pinned
			.then(() => done(), (err) => done(err));
	});

	test('Can switch between different input files', (done) => {
		// Setup
		let firstInput: EditorInput;
		let firstContainer: HTMLElement;
		let secondInput: EditorInput;
		let secondContainer: HTMLElement;
		const firstContainerId = 'firstContainerId';
		const secondContainerId = 'secondContainerId';

		let recordFirstInput = function () {
			let input = <QueryInput>editor.input;
			firstInput = input.sql;
			firstContainer = editor.sqlEditorContainer;
			firstContainer.id = firstContainerId;
		};

		let assertFirstInputIsSet = function () {
			assert.notEqual(firstContainer.parentElement, undefined);
		};

		let setSecondInput = function () {
			return editor.setInput(queryInput2);
		};

		let assertFirstInputIsRemoved = function () {
			let input = <QueryInput>editor.input;
			secondInput = input.sql;
			secondContainer = editor.sqlEditorContainer;
			secondContainer.id = secondContainerId;

			// The inputs should not match
			assert.notEqual(firstInput.getName(), secondInput.getName());
			assert.notEqual(firstContainer.id, secondContainer.id);
			assert.equal(firstContainer.id, firstContainerId);

			// The first input should be disposed
			assert.notEqual(firstContainer.parentElement, secondContainer.parentElement);
			assert.equal(firstContainer.parentElement, undefined);

			// The second input should be added into the DOM
			assert.notEqual(secondContainer.parentElement, undefined);
		};

		let setFirstInputAgain = function () {
			return editor.setInput(queryInput);
		};

		let assertFirstInputIsAddedBack = function () {
			let input = <QueryInput>editor.input;
			firstInput = input.sql;
			firstContainer = editor.sqlEditorContainer;

			// The inputs should not match
			assert.notEqual(firstInput.getName(), secondInput.getName());
			assert.notEqual(firstContainer.id, secondContainer.id);
			assert.equal(secondContainer.id, secondContainerId);

			// The first input should be added into the DOM
			assert.equal(secondContainer.parentElement, undefined);

			// The second input should be disposed
			assert.notEqual(firstContainer.parentElement, secondContainer.parentElement);
			assert.notEqual(firstContainer.parentElement, undefined);
		};

		// If I create a QueryEditor
		let editor: QueryEditor = getQueryEditor();
		editor.create(parentBuilder);

		return editor.setInput(queryInput) // and I set the input
			.then(recordFirstInput) // then I record what the input is
			.then(assertFirstInputIsSet) // the input should be set
			.then(setSecondInput) // then if I set the input to a new file
			.then(assertFirstInputIsRemoved) // the inputs should not match, and the first input should be removed from the DOM
			.then(setFirstInputAgain) // then if I set the input back to the original
			.then(assertFirstInputIsAddedBack) // the inputs should not match, and the second input should be removed from the DOM
			.then(() => done(), (err) => done(err));
	});
	*/

	suite('Action Tests', () => {
		let queryActionInstantiationService: TypeMoq.Mock<InstantiationService>;
		let queryConnectionService: TypeMoq.Mock<ConnectionManagementService>;
		let queryModelService: TypeMoq.Mock<QueryModelService>;
		let queryInput: QueryInput;
		setup(() => {

			// Mock ConnectionManagementService but don't set connected state
			memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
			memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
			queryConnectionService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined);
			queryConnectionService.callBase = true;

			queryConnectionService.setup(x => x.disconnectEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => void 0);
			queryConnectionService.setup(x => x.ensureDefaultLanguageFlavor(TypeMoq.It.isAnyString())).returns(() => void 0);

			// Mock InstantiationService to give us the actions
			queryActionInstantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose);

			queryActionInstantiationService.setup(x => x.createInstance(TypeMoq.It.isAny())).returns((input) => {
				return new TPromise((resolve) => resolve(mockEditor));
			});

			queryActionInstantiationService.setup(x => x.createInstance(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((input) => {
				// Default
				return new RunQueryAction(undefined, undefined, undefined);
			});

			// Setup hook to capture calls to create the listDatabase action
			queryActionInstantiationService.setup(x => x.createInstance(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
				.returns((definition, editor, action, selectBox) => {
					if (definition.ID === 'listDatabaseQueryActionItem') {
						let item = new ListDatabasesActionItem(editor, action, queryConnectionService.object, undefined, undefined, undefined, configurationService.object);
						return item;
					}
					// Default
					return new RunQueryAction(undefined, undefined, undefined);
				});

			let fileInput = new UntitledEditorInput(URI.parse('file://testUri'), false, '', '', '', instantiationService.object, undefined, undefined, undefined);
			queryModelService = TypeMoq.Mock.ofType(QueryModelService, TypeMoq.MockBehavior.Loose, undefined, undefined);
			queryModelService.callBase = true;
			queryModelService.setup(x => x.disposeQuery(TypeMoq.It.isAny())).returns(() => void 0);
			queryInput = new QueryInput(
				'',
				fileInput,
				undefined,
				undefined,
				connectionManagementService.object,
				queryModelService.object,
				undefined,
				undefined
			);
		});

		test('Taskbar buttons are set correctly upon standard load', (done) => {
			queryConnectionService.setup(x => x.isConnected(TypeMoq.It.isAny())).returns(() => false);
			queryModelService.setup(x => x.isRunningQuery(TypeMoq.It.isAny())).returns(() => false);
			// If I use the created QueryEditor with no changes since creation
			// Buttons should be set as if disconnected
			assert.equal(queryInput.runQueryEnabled, true, 'runQueryAction button should be enabled');
			assert.equal(queryInput.cancelQueryEnabled, false, 'cancelQueryAction button should not be enabled');
			assert.equal(queryInput.connectEnabled, true, 'connectDatabaseAction button should be enabled');
			assert.equal(queryInput.disconnectEnabled, false, 'disconnectDatabaseAction button should not be enabled');
			assert.equal(queryInput.changeConnectionEnabled, false, 'changeConnectionAction button should not be enabled');
			assert.equal(queryInput.listDatabasesConnected, false);
			done();
		});

		test('Taskbar buttons are set correctly upon connect', (done) => {
			let params: INewConnectionParams = { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none };
			queryInput.onConnectSuccess(params);
			queryModelService.setup(x => x.isRunningQuery(TypeMoq.It.isAny())).returns(() => false);
			assert.equal(queryInput.runQueryEnabled, true, 'runQueryAction button should be enabled');
			assert.equal(queryInput.cancelQueryEnabled, false, 'cancelQueryAction button should not be enabled');
			assert.equal(queryInput.connectEnabled, false, 'connectDatabaseAction button should not be enabled');
			assert.equal(queryInput.disconnectEnabled, true, 'disconnectDatabaseAction button should be enabled');
			assert.equal(queryInput.changeConnectionEnabled, true, 'changeConnectionAction button should be enabled');
			assert.equal(queryInput.listDatabasesConnected, true);
			done();
		});
		test('Test that we attempt to dispose query when the queryInput is disposed', (done) => {
			let queryResultsInput = new QueryResultsInput('testUri', configurationService.object);
			queryInput['_results'] = queryResultsInput;
			queryInput.close();
			queryModelService.verify(x => x.disposeQuery(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
			done();
		});
	});
});