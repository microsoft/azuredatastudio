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
import * as dom from 'vs/base/browser/dom';
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
		queryManagementService,
		instantiationService.get(IContextKeyService)
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
		let div = dom.$('div', undefined, dom.$('span', { id: 'demospan' }));
		let parentHtmlElement = div.firstChild as HTMLElement;
		notebookEditor.create(parentHtmlElement); // adds notebookEditor to new htmlElement as parent
		assert.notStrictEqual(notebookEditor['_overlay'], undefined, `The overlay must be defined for notebookEditor once create() has been called on it`);
		assert.strictEqual(notebookEditor.getContainer(), parentHtmlElement, 'parent of notebookEditor was not the one that was expected');
		await notebookEditor.setInput(untitledNotebookInput, EditorOptions.create({ pinned: true }));
	});

	test('NotebookEditor: Tests that dispose() disposes all objects in its disposable store', async () => {
		let isDisposed = (<DisposableStore>notebookEditor['_toDispose'])['_isDisposed'];
		assert.ok(!isDisposed, 'initially notebookEditor\'s disposable store must not be disposed');
		notebookEditor.dispose();
		isDisposed = (<DisposableStore>notebookEditor['_toDispose'])['_isDisposed'];
		assert.ok(isDisposed, 'notebookEditor\'s disposable store must be disposed');
	});

	test('NotebookEditor: Tests that getPosition and getLastPosition correctly return the range set by setSelection', async () => {
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
		test(`NotebookEditor: Negative Test for getCellEditor() - returns undefined for invalid or unknown guid:'${input}'`, async () => {
			const result = notebookEditor.getCellEditor(input);
			assert.strictEqual(result, undefined, `notebookEditor.getCellEditor() should return undefined when invalid guid:'${input}' is passed in for a notebookEditor of an empty document.`);
		});
	});

	test('NotebookEditor: Positive Test for getCellEditor() - returns a valid text editor object for valid guid input', async () => {
		const result = notebookEditor.getCellEditor(cellTextEditorGuid);
		assert.strictEqual(result, queryTextEditor, 'notebookEditor.getCellEditor() should return an expected QueryTextEditor when a guid corresponding to that editor is passed in.');

	});

});

