/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/untitledNotebookInput';
import { NotebookEditor } from 'sql/workbench/contrib/notebook/browser/notebookEditor';
import { NBTestQueryManagementService } from 'sql/workbench/contrib/notebook/test/nbTestQueryManagementService';
import { NotebookModelStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { TestNotebookEditor } from 'sql/workbench/contrib/notebook/test/testCommon';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookService, NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { Emitter } from 'vs/base/common/event';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ContextViewService } from 'vs/platform/contextview/browser/contextViewService';
import { DidInstallExtensionEvent, DidUninstallExtensionEvent, IExtensionManagementService, InstallExtensionEvent } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { IFileService } from 'vs/platform/files/common/files';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { EditorOptions } from 'vs/workbench/common/editor';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/extensionManagementService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { WorkbenchThemeService } from 'vs/workbench/services/themes/browser/workbenchThemeService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';


suite('Test class NotebookEditor', () => {

	let notebookEditor: NotebookEditor;

	const installEvent: Emitter<InstallExtensionEvent> = new Emitter<InstallExtensionEvent>();
	const didInstallEvent = new Emitter<DidInstallExtensionEvent>();
	const uninstallEvent = new Emitter<IExtensionIdentifier>();
	const didUninstallEvent = new Emitter<DidUninstallExtensionEvent>();

	const instantiationService = <TestInstantiationService>workbenchInstantiationService();
	const workbenchThemeService = instantiationService.createInstance(WorkbenchThemeService);
	instantiationService.stub(IWorkbenchThemeService, workbenchThemeService);

	const queryManagementService = new NBTestQueryManagementService();

	instantiationService.stub(IExtensionManagementService, ExtensionManagementService);
	instantiationService.stub(IExtensionManagementService, 'onInstallExtension', installEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onDidInstallExtension', didInstallEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onUninstallExtension', uninstallEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onDidUninstallExtension', didUninstallEvent.event);

	const extensionService = instantiationService.get(IExtensionService);
	const notebookService = new NotebookService(
		instantiationService.get(ILifecycleService),
		instantiationService.get(IStorageService),
		extensionService,
		instantiationService.get(IExtensionManagementService),
		instantiationService,
		instantiationService.get(IFileService),
		instantiationService.get(ILogService),
		queryManagementService
	);

	instantiationService.stub(INotebookService, notebookService);

	const testTitle = 'NotebookEditor.Test-Title';
	const untitledUri = URI.from({ scheme: Schemas.untitled, path: 'NotebookEditor.Test-TestPath' });
	const untitledTextEditorService = instantiationService.get(IUntitledTextEditorService);
	const untitledTextInput = instantiationService.createInstance(UntitledTextEditorInput, untitledTextEditorService.create({ associatedResource: untitledUri }));
	const untitledNotebookInput = new UntitledNotebookInput(
		testTitle, untitledUri, untitledTextInput,
		undefined, instantiationService, notebookService, extensionService
	);

	const cellTextEditorGuid = generateUuid();
	const queryTextEditor = new QueryTextEditor(
		instantiationService.get(ITelemetryService),
		instantiationService,
		instantiationService.get(IStorageService),
		instantiationService.get(ITextResourceConfigurationService),
		instantiationService.get(IThemeService),
		instantiationService.get(IEditorGroupsService),
		instantiationService.get(IEditorService),
		instantiationService.get(IConfigurationService)
	);
	const testNotebookEditor = new TestNotebookEditor({ cellGuid: cellTextEditorGuid, editor: queryTextEditor });
	testNotebookEditor.id = untitledNotebookInput.notebookUri.toString();
	testNotebookEditor.model = new NotebookModelStub();
	notebookService.addNotebookEditor(testNotebookEditor);

	setup(async () => {
		// Create notebookEditor
		notebookEditor = new NotebookEditor(
			instantiationService.get(ITelemetryService),
			instantiationService.get(IThemeService),
			instantiationService,
			instantiationService.get(IStorageService),
			new ContextViewService(instantiationService.get(ILayoutService)),
			instantiationService.get(IKeybindingService),
			instantiationService.get(IContextKeyService),
			workbenchThemeService,
			notebookService
		);
	});

	test('NotebookEditor: Verifies that create() calls createEditor() and sets the provided parent object as the \'_overlay\' field', () => {
		assert.strictEqual(notebookEditor['_overlay'], undefined), `The overlay must be undefined for notebookEditor when create() has not been called on it`;
		console.log(notebookEditor["_overlay"]);
		let parentHtmlElement = document.createElement('div');
		notebookEditor.create(parentHtmlElement);
		assert.notStrictEqual(notebookEditor['_overlay'], undefined), `The overlay must be defined for notebookEditor once create() has been called on it`;
		assert.strictEqual(notebookEditor['parent'], parentHtmlElement, 'parent of notebookEditor was not the one that was expected');
	});

	[undefined, new NotebookModelStub()].forEach(async (notebookModel) => {
		test(`NotebookEditor: Tests that notebookModel='${notebookModel}' set indirectly by setInput -> setNotebookModel is returned by getNotebookModel()`, async () => {
			createEditor(notebookEditor);
			const untitledUri = URI.from({ scheme: Schemas.untitled, path: `NotebookEditor.Test-TestPath-${notebookModel}` });
			const untitledTextEditorService = instantiationService.get(IUntitledTextEditorService);
			const untitledTextInput = instantiationService.createInstance(UntitledTextEditorInput, untitledTextEditorService.create({ associatedResource: untitledUri }));
			const untitledNotebookInput = new UntitledNotebookInput(
				testTitle, untitledUri, untitledTextInput,
				undefined, instantiationService, notebookService, extensionService
			);
			const testNotebookEditor = new TestNotebookEditor({ cellGuid: cellTextEditorGuid, editor: queryTextEditor });
			testNotebookEditor.id = untitledNotebookInput.notebookUri.toString();
			testNotebookEditor.model = notebookModel;
			notebookService.addNotebookEditor(testNotebookEditor);
			testNotebookEditor.model = notebookModel;
			notebookEditor.clearInput();
			await notebookEditor.setInput(untitledNotebookInput, EditorOptions.create({ pinned: true }));
			await notebookEditor.setNotebookModel();
			const result = await notebookEditor.getNotebookModel();
			assert.strictEqual(result, notebookModel, `getNotebookModel() should return the model set in the INotebookEditor object`);
			notebookService.removeNotebookEditor(testNotebookEditor);
			console.log(`notebookEditor=`, notebookEditor);
			notebookEditor.setInput(untitledNotebookInput, EditorOptions.create({ pinned: true }));
		});
	});

	test('NotebookEditor: Tests that dispose() disposes all objects in its disposable store', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		let isDisposed = (<DisposableStore>notebookEditor['_toDispose'])['_isDisposed'];
		assert.ok(!isDisposed, 'initially notebookEditor\'s disposable store must not be disposed');
		notebookEditor.dispose();
		isDisposed = (<DisposableStore>notebookEditor['_toDispose'])['_isDisposed'];
		assert.ok(isDisposed, 'notebookEditor\'s disposable store must be disposed');
	});

	test('NotebookEditor: Tests that getPosition and getLastPosition correctly return the range set by setSelection', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		let currentPosition = notebookEditor.getPosition();
		let lastPosition = notebookEditor.getLastPosition();
		assert.strictEqual(currentPosition, undefined, 'notebookEditor.getPosition() should return an undefined range with no selected range');
		assert.strictEqual(lastPosition, undefined, 'notebookEditor.getLastPosition() should return an undefined range with no previously selected range');
		let selectedRange = new NotebookRange(<ICellModel>{}, 0, 0, 0, 0);
		notebookEditor.setSelection(selectedRange);
		lastPosition = notebookEditor.getLastPosition();
		assert.strictEqual(lastPosition, currentPosition, 'notebookEditor.getLastPosition() should return the value that was the \'currentPosition before the most recent range selection');
		currentPosition = notebookEditor.getPosition();
		assert.strictEqual(currentPosition, selectedRange, 'notebookEditor.getPosition() should return the range that was selected');
		selectedRange = new NotebookRange(<ICellModel>{}, 0, 1, 0, 1);
		notebookEditor.setSelection(selectedRange);
		lastPosition = notebookEditor.getLastPosition();
		assert.strictEqual(lastPosition, currentPosition, 'notebookEditor.getLastPosition() should return the value that was the \'currentPosition before the most recent range selection');
		currentPosition = notebookEditor.getPosition();
		assert.strictEqual(currentPosition, selectedRange, 'notebookEditor.getPosition() should return the range that was selected');
	});

	// NotebookEditor-getCellEditor tests.
	['', undefined, null, 'unknown string', /*unknown guid*/generateUuid()].forEach(input => {
		test(`NotebookEditor: Negative Test -> getCellEditor() returns undefined for invalid or unknown guid:'${input}'`, async () => {
			await setupNotebookEditor(notebookEditor, untitledNotebookInput);
			const inputGuid = <string>input;
			const result = notebookEditor.getCellEditor(inputGuid);
			assert.strictEqual(result, undefined, `notebookEditor.getCellEditor() should return undefined when invalid guid:'${inputGuid}' is passed in for a notebookEditor of an empty document.`);
		});
	});

	test('NotebookEditor: Positive Test -> getCellEditor() returns a valid text editor object for valid guid input', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		const result = notebookEditor.getCellEditor(cellTextEditorGuid);
		assert.strictEqual(result, queryTextEditor, 'notebookEditor.getCellEditor() should return an expected QueryTextEditor when a guid corresponding to that editor is passed in.');

	});


	// test('NotebookEditor-focus', () => {
	// 	notebookEditor.focus();
	// });

	// test('NotebookEditor-layout', () => {
	// 	notebookEditor.layout(dimension1);
	// });

	// test('NotebookEditor-getConfiguration', () => {
	// 	notebookEditor.getConfiguration();
	// });

	// test('NotebookEditor-updateDecorations', () => {
	// 	notebookEditor.updateDecorations(newDecorationRange1, oldDecorationRange1);
	// });

	// test('NotebookEditor-changeDecorations', () => {
	// 	const result = notebookEditor.changeDecorations(callback1);

	// 	// Expect result
	// 	expect(result).to.be.not.undefined;
	// });

	// test('NotebookEditor-deltaDecorations', () => {
	// 	const result = notebookEditor.deltaDecorations(oldDecorations1, newDecorations1);

	// 	// Expect result
	// 	expect(result).to.be.not.undefined;
	// });

	// test('NotebookEditor-layoutOverlayWidget', () => {
	// 	notebookEditor.layoutOverlayWidget(widget1);
	// });

	// test('NotebookEditor-addOverlayWidget', () => {
	// 	notebookEditor.addOverlayWidget(widget2);
	// });

	// test('NotebookEditor-getAction', () => {
	// 	const result = notebookEditor.getAction(id1);

	// 	// Expect result
	// 	expect(result).to.be.not.undefined;
	// });

	// test('NotebookEditor-_onFindStateChange', async () => {
	// 	await notebookEditor._onFindStateChange(e1);
	// });

	// test('NotebookEditor-toggleSearch', () => {
	// 	notebookEditor.toggleSearch();
	// });

	// test('NotebookEditor-findNext', () => {
	// 	notebookEditor.findNext();
	// });

	// test('NotebookEditor-findPrevious', () => {
	// 	notebookEditor.findPrevious();
	// });


	// test('NotebookEditor-onDidChangeConfiguration', () => {
	// 	const onDidChangeConfiguration1 = undefined;

	// 	// Property call
	// 	notebookEditor.onDidChangeConfiguration = onDidChangeConfiguration1;
	// 	const result = notebookEditor.onDidChangeConfiguration;

	// 	// Expect result
	// 	expect(result).equals(onDidChangeConfiguration1);
	// });

});

async function setupNotebookEditor(notebookEditor: NotebookEditor, untitledNotebookInput: UntitledNotebookInput): Promise<void> {
	createEditor(notebookEditor);
	await setInputDocument(notebookEditor, untitledNotebookInput);
}

async function setInputDocument(notebookEditor: NotebookEditor, untitledNotebookInput: UntitledNotebookInput): Promise<void> {
	const editorOptions = EditorOptions.create({ pinned: true });
	await notebookEditor.setInput(untitledNotebookInput, editorOptions);
	assert.strictEqual(notebookEditor.options, editorOptions, 'NotebookEditor options must be the ones that we set');
}

function createEditor(notebookEditor: NotebookEditor) {
	let parentHtmlElement = document.createElement('div');
	notebookEditor.create(parentHtmlElement); // adds notebookEditor to new htmlElement as parent
}

