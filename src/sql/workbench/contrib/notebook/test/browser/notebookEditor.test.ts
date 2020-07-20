/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { nb } from 'azdata';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { NotebookFindMatch } from 'sql/workbench/contrib/notebook/browser/find/notebookFindDecorations';
import { ACTION_IDS } from 'sql/workbench/contrib/notebook/browser/find/notebookFindWidget';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/untitledNotebookInput';
import { NotebookFindNextAction, NotebookFindPreviousAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { NotebookEditor } from 'sql/workbench/contrib/notebook/browser/notebookEditor';
import { NBTestQueryManagementService } from 'sql/workbench/contrib/notebook/test/nbTestQueryManagementService';
import * as stubs from 'sql/workbench/contrib/notebook/test/stubs';
import { NotebookEditorStub } from 'sql/workbench/contrib/notebook/test/testCommon';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { ICellModel, NotebookContentChange } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookEditor, INotebookParams, INotebookService, NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import * as TypeMoq from 'typemoq';
import * as DOM from 'vs/base/browser/dom';
import { errorHandler, onUnexpectedError } from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { IOverlayWidget, IOverlayWidgetPosition } from 'vs/editor/browser/editorBrowser';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { FindReplaceStateChangedEvent, INewFindReplaceState } from 'vs/editor/contrib/find/findState';
import { getRandomString } from 'vs/editor/test/common/model/linesTextBuffer/textBufferAutoTestUtils';
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
import { ICell } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/extensionManagementService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { WorkbenchThemeService } from 'vs/workbench/services/themes/browser/workbenchThemeService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IProductService } from 'vs/platform/product/common/productService';

class NotebookModelStub extends stubs.NotebookModelStub {
	private _cells: Array<ICellModel> = [new CellModel(undefined, undefined)];
	public contentChangedEmitter = new Emitter<NotebookContentChange>();
	private _kernelChangedEmitter = new Emitter<nb.IKernelChangedArgs>();
	private _onActiveCellChanged = new Emitter<ICellModel>();

	get cells(): ReadonlyArray<ICellModel> {
		return this._cells;
	}
	public get contentChanged(): Event<NotebookContentChange> {
		return this.contentChangedEmitter.event;
	}

	get kernelChanged(): Event<nb.IKernelChangedArgs> {
		return this._kernelChangedEmitter.event;
	}

	get onActiveCellChanged(): Event<ICellModel> {
		return this._onActiveCellChanged.event;
	}

	updateActiveCell(cell: ICellModel) {
		// do nothing.
		// When relevant a mock is used to intercept this call to do any verifications or run
		// any code relevant for testing in the context of the test.
	}
}

suite('Test class NotebookEditor:', () => {
	let instantiationService = <TestInstantiationService>workbenchInstantiationService();
	let workbenchThemeService = instantiationService.createInstance(WorkbenchThemeService);
	let notebookEditor: NotebookEditor;
	let testTitle: string;
	let notebookService: NotebookService;
	let extensionService: IExtensionService;
	let cellTextEditorGuid: string;
	let queryTextEditor: QueryTextEditor;
	let untitledNotebookInput: UntitledNotebookInput;
	let notebookEditorStub: NotebookEditorStub;

	setup(async () => {
		// setup services
		({ instantiationService, workbenchThemeService, notebookService, testTitle, extensionService, cellTextEditorGuid, queryTextEditor, untitledNotebookInput, notebookEditorStub } = setupServices({ instantiationService, workbenchThemeService }));
		// Create notebookEditor
		notebookEditor = createNotebookEditor(instantiationService, workbenchThemeService, notebookService);
	});

	test('Verifies that create() calls createEditor() and sets the provided parent object as the \'_overlay\' field', () => {
		assert.strictEqual(notebookEditor['_overlay'], undefined, `The overlay must be undefined for notebookEditor when create() has not been called on it`);
		let parentHtmlElement = document.createElement('div');
		notebookEditor.create(parentHtmlElement);
		assert.notStrictEqual(notebookEditor['_overlay'], undefined, `The overlay must be defined for notebookEditor once create() has been called on it`);
		assert.strictEqual(notebookEditor.getContainer(), parentHtmlElement, 'parent of notebookEditor was not the one that was expected');
	});

	for (const notebookModel of [new NotebookModelStub(), undefined]) {
		test(`Tests that notebookModel='${notebookModel}' set indirectly by setInput -> setNotebookModel is returned by getNotebookModel()`, async () => {
			createEditor(notebookEditor);
			const untitledUri = URI.from({ scheme: Schemas.untitled, path: `NotebookEditor.Test-TestPath-${notebookModel}` });
			const untitledTextEditorService = instantiationService.get(IUntitledTextEditorService);
			const untitledTextInput = instantiationService.createInstance(UntitledTextEditorInput, untitledTextEditorService.create({ associatedResource: untitledUri }));
			const untitledNotebookInput = new UntitledNotebookInput(
				testTitle, untitledUri, untitledTextInput,
				undefined, instantiationService, notebookService, extensionService
			);
			const testNotebookEditor = new NotebookEditorStub({ cellGuid: cellTextEditorGuid, editor: queryTextEditor, model: notebookModel, notebookParams: <INotebookParams>{ notebookUri: untitledNotebookInput.notebookUri } });
			notebookService.addNotebookEditor(testNotebookEditor);
			notebookEditor.clearInput();
			await notebookEditor.setInput(untitledNotebookInput, EditorOptions.create({ pinned: true }));
			untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
			const result = await notebookEditor.getNotebookModel();
			assert.strictEqual(result, notebookModel, `getNotebookModel() should return the model set in the INotebookEditor object`);
		});
	}

	test('Tests that dispose() disposes all objects in its disposable store', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		let isDisposed = (<DisposableStore>notebookEditor['_toDispose'])['_isDisposed'];
		assert.ok(!isDisposed, 'initially notebookEditor\'s disposable store must not be disposed');
		notebookEditor.dispose();
		isDisposed = (<DisposableStore>notebookEditor['_toDispose'])['_isDisposed'];
		assert.ok(isDisposed, 'notebookEditor\'s disposable store must be disposed');
	});

	test('Tests that getPosition() and getLastPosition() correctly return the range set by setSelection', async () => {
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

	for (const input of ['', undefined, null, 'unknown string', /*unknown guid*/generateUuid()]) {
		test(`Verifies that getCellEditor() returns undefined for invalid or unknown guid:'${input}'`, async () => {
			await setupNotebookEditor(notebookEditor, untitledNotebookInput);
			const inputGuid = <string>input;
			const result = notebookEditor.getCellEditor(inputGuid);
			assert.strictEqual(result, undefined, `notebookEditor.getCellEditor() should return undefined when invalid guid:'${inputGuid}' is passed in for a notebookEditor of an empty document.`);
		});
	}

	test('Verifies that getCellEditor() returns a valid text editor object for valid guid input', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		const result = notebookEditor.getCellEditor(cellTextEditorGuid);
		assert.strictEqual(result, queryTextEditor, 'notebookEditor.getCellEditor() should return an expected QueryTextEditor when a guid corresponding to that editor is passed in.');

	});

	test('Verifies that domNode passed in via addOverlayWidget() call gets attached to the root HtmlElement of notebookEditor', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		const domNode: HTMLElement = document.createElement('div');
		const widget: IOverlayWidget = {
			getId(): string { return ''; },
			getDomNode(): HTMLElement { return domNode; },
			getPosition(): IOverlayWidgetPosition | null { return null; }
		};
		notebookEditor.addOverlayWidget(widget);
		const rootElement: HTMLElement = notebookEditor['_overlay'];
		assert.ok(domNode.parentElement === rootElement, `parent of the passed in domNode must be the root element of notebookEditor:${notebookEditor}`);
	});

	test('Noop methods do not throw', async () => {
		// Just calling the no-op methods, test will fail if they throw
		notebookEditor.focus();
		notebookEditor.layoutOverlayWidget(undefined);
		assert.strictEqual(notebookEditor.deltaDecorations(undefined, undefined), undefined, 'deltaDecorations is not implemented and returns undefined');
	});


	test('Tests that getConfiguration returns the information set by layout() call', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		const dimension: DOM.Dimension = new DOM.Dimension(Math.random(), Math.random());
		notebookEditor.layout(dimension);
		const config = notebookEditor.getConfiguration();
		assert.ok(config.layoutInfo.width === dimension.width && config.layoutInfo.height === dimension.height, `width and height returned by getConfiguration() must be same as the dimension set by layout() call`);
	});

	test('Tests setInput call with various states of input on a notebookEditor object', async () => {
		createEditor(notebookEditor);
		const editorOptions = EditorOptions.create({ pinned: true });
		for (const input of [
			untitledNotebookInput /* set to a known input */,
			untitledNotebookInput /* tries to set the same input that was previously set */
		]) {
			await notebookEditor.setInput(input, editorOptions);
			assert.strictEqual(notebookEditor.input, input, `notebookEditor.input should be the one that we set`);
		}
	});

	test('Tests setInput call with various states of findState.isRevealed on a notebookEditor object', async () => {
		createEditor(notebookEditor);
		const editorOptions = EditorOptions.create({ pinned: true });
		for (const isRevealed of [true, false]) {
			notebookEditor['_findState']['_isRevealed'] = isRevealed;
			notebookEditor.clearInput();
			await notebookEditor.setInput(untitledNotebookInput, editorOptions);
			assert.strictEqual(notebookEditor.input, untitledNotebookInput, `notebookEditor.input should be the one that we set`);
		}
	});

	test('Verifies that call updateDecorations calls deltaDecorations() on the underlying INotebookEditor object with arguments passed to it', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);

		const newRange = {} as NotebookRange;
		const oldRange = {} as NotebookRange;
		const iNotebookEditorMock = TypeMoq.Mock.ofInstance(notebookEditorStub);
		iNotebookEditorMock.callBase = true; //by default forward all call call to the underlying object
		iNotebookEditorMock
			.setup(x => x.deltaDecorations(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.callback((newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange) => {
				//Verify the parameters passed into the INotebookEditor.deltaDecorations() call
				assert.strictEqual(newDecorationRange, newRange, 'newDecorationsRange passed to INotebookEditor.deltaDecorations() must be the one that was provided to NotebookEditor.updateDecorations() call');
				assert.strictEqual(oldDecorationRange, oldRange, 'oldDecorationsRange passed to INotebookEditor.deltaDecorations() must be the one that was provided to NotebookEditor.updateDecorations() call');
			});
		notebookService.addNotebookEditor(iNotebookEditorMock.object);
		notebookEditor.updateDecorations(newRange, oldRange);
		// Ensure that INotebookEditor.deltaDecorations() was called exactly once.
		iNotebookEditorMock.verify(x => x.deltaDecorations(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
	});

	test('Verifies that changeDecorations call returns null when no input is set on the notebookEditor object', async () => {
		const returnObject = {};
		let changeDecorationsCalled = false;
		const result = notebookEditor.changeDecorations(() => {
			changeDecorationsCalled = true;
			return returnObject;
		});
		assert.notEqual(changeDecorationsCalled, true, `changeDecorations callback should not have been called`);
		assert.notStrictEqual(result, returnObject, 'object returned by the callback given to changeDecorations() call must not be returned by it');
		assert.strictEqual(result, null, 'return value of changeDecorations() call must be null when no input is set on notebookEditor object');
	});

	test('Verifies that changeDecorations calls the callback provided to it and returns the object returned by that callback', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		const returnObject = {};
		let changeDecorationsCalled = false;
		const result = notebookEditor.changeDecorations(() => {
			changeDecorationsCalled = true;
			return returnObject;
		});
		assert.ok(changeDecorationsCalled, `changeDecorations callback should have been called`);
		assert.strictEqual(result, returnObject, 'object returned by the callback given to changeDecorations() call must be returned by it');
	});


	test('Verifies getAction called for findNext and findPrevious returns objects of correct type', () => {
		assert.ok(notebookEditor.getAction(ACTION_IDS.FIND_NEXT) instanceof NotebookFindNextAction, `getAction called for '${ACTION_IDS.FIND_NEXT}' should return an instance of ${NotebookFindNextAction}`);
		assert.ok(notebookEditor.getAction(ACTION_IDS.FIND_PREVIOUS) instanceof NotebookFindPreviousAction, `getAction called for '${ACTION_IDS.FIND_PREVIOUS}' should return an instance of ${NotebookFindPreviousAction}`);
	});

	test('Verifies toggleSearch changes isRevealed state with and without a notebookModel', async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		for (const model of [new NotebookModelStub(), undefined]) {
			notebookEditor['_notebookModel'] = model;
			for (let i: number = 1; i <= 2; i++) { //Do it twice so that two toggles return back to original state verifying both transitions
				let isRevealed = notebookEditor['_findState']['_isRevealed'];
				notebookEditor.toggleSearch();
				assert.strictEqual(notebookEditor['_findState']['_isRevealed'], !isRevealed && !!model, 'new isRevealed state should be false if model is undefined and should be opposite of previous state otherwise');
			}
		}
	});

	for (const action of [ACTION_IDS.FIND_NEXT, ACTION_IDS.FIND_PREVIOUS]) {
		test(`Tests that ${action} raises 'no search running' error when findArray is empty`, async () => {
			await setupNotebookEditor(notebookEditor, untitledNotebookInput);
			let unexpectedErrorCalled = false;
			const onUnexpectedErrorVerifier = (error: any) => {
				unexpectedErrorCalled = true;
				assert.ok(error instanceof Error, `${onUnexpectedError} must be passed an instance of ${Error}`);
				assert.strictEqual((error as Error).message, 'no search running', `Error text must be 'no search running' when findArray is empty`);
			};
			errorHandler.setUnexpectedErrorHandler(onUnexpectedErrorVerifier);
			notebookEditor.notebookFindModel['_findArray'] = []; //empty out the findArray.
			action === ACTION_IDS.FIND_NEXT ? await notebookEditor.findNext() : await notebookEditor.findPrevious();
			let result = notebookEditor.getPosition();
			assert.strictEqual(result, undefined, 'the notebook cell range returned by find operation must be undefined with no pending finds');
			assert.strictEqual(unexpectedErrorCalled, true, `${onUnexpectedError} must be have been raised with no pending finds`);
		});
	}

	for (const action of [ACTION_IDS.FIND_NEXT, ACTION_IDS.FIND_PREVIOUS]) {
		for (const range of [<NotebookRange>{}, new NotebookRange(<ICellModel>{}, 0, 0, 0, 0)]) {
			test(`Tests ${action} returns the NotebookRange with cell: '${JSON.stringify(range.cell)}' that is as expected given the findArray`, async () => {
				await setupNotebookEditor(notebookEditor, untitledNotebookInput);
				untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
				const notebookModel = await notebookEditor.getNotebookModel();
				const mockModel = TypeMoq.Mock.ofInstance(notebookModel);
				mockModel.callBase = true; //forward calls to the base object
				let updateActiveCellCalled = false;
				mockModel.setup(x => x.updateActiveCell(TypeMoq.It.isAny())).callback((cell: ICell) => {
					updateActiveCellCalled = true;
					assert.strictEqual(cell, range.cell, `updateActiveCell must get called with cell property of the range object that was set in findArray\n\tactual cell:${JSON.stringify(cell, undefined, '\t')}, expected cell:${JSON.stringify(range.cell, undefined, '\t')}`);
				});
				//a method call with value undefined needs a separate setup as TypeMoq.It.isAny() does not seem to match undefined parameter value.
				mockModel.setup(x => x.updateActiveCell(undefined)).callback((cell: ICell) => {
					updateActiveCellCalled = true;
					assert.strictEqual(cell, range.cell, `updateActiveCell must get called with cell property of the range object that was set in findArray\n\tactual cell:${JSON.stringify(cell, undefined, '\t')}, expected cell:${JSON.stringify(range.cell, undefined, '\t')}`);
				});
				notebookEditor.notebookFindModel['_findArray'] = [range]; //set the findArray to have the expected range
				notebookEditor['_notebookModel'] = mockModel.object;
				action === ACTION_IDS.FIND_NEXT ? await notebookEditor.findNext() : await notebookEditor.findPrevious();
				const result = notebookEditor.getPosition();
				assert.strictEqual(result, range, 'the notebook cell range returned by find operation must be the one that we set');
				mockModel.verify(x => x.updateActiveCell(TypeMoq.It.isAny()), TypeMoq.Times.atMostOnce());
				mockModel.verify(x => x.updateActiveCell(undefined), TypeMoq.Times.atMostOnce());
				assert.strictEqual(updateActiveCellCalled, true, 'the updateActiveCell should have gotten called');
			});
		}
	}

	test(`Verifies visibility and decorations are set correctly when _onFindStateChange callback happens`, async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		let currentPosition = new NotebookRange(<ICellModel>{}, 0, 0, 0, 0);
		notebookEditor.setSelection(currentPosition);
		notebookEditor.notebookFindModel['_findArray'] = [currentPosition]; //set some pending finds.
		untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
		await notebookEditor.setNotebookModel();
		await notebookEditor.findNext();
		const findState = notebookEditor['_findState'];
		const finder = notebookEditor['_finder'];
		const newState: INewFindReplaceState = {};

		const findDecorations = notebookEditor.notebookInput.notebookFindModel.findDecorations;
		const findDecorationsMock = TypeMoq.Mock.ofInstance(findDecorations);
		findDecorationsMock.callBase = true; //forward to base object by default.
		let clearDecorationsCalled = false;
		findDecorationsMock.setup(x => x.clearDecorations()).callback(() => {
			findDecorations.clearDecorations();
			clearDecorationsCalled = true;
		});
		notebookEditor.notebookInput.notebookFindModel['_findDecorations'] = findDecorationsMock.object;
		for (const newStateIsRevealed of [true, false]) {
			newState.isRevealed = newStateIsRevealed;
			clearDecorationsCalled = false;
			findState.change(newState, false);
			if (newStateIsRevealed) {
				assert.strictEqual(finder.getDomNode().style.visibility, 'visible', 'finder node should be visible when newState.isRevealed');
				assert.ok(!clearDecorationsCalled, 'decorations are not cleared when finder isRevealed');
				assert.strictEqual(findDecorations.getStartPosition(), currentPosition, 'when finder isRevealed, decorations startPosition is set to currentPosition');
			} else {
				assert.strictEqual(finder.getDomNode().style.visibility, 'hidden', 'finder node should be hidden when newState.isNotRevealed');
				assert.ok(clearDecorationsCalled, 'decorations are cleared when finder isNotRevealed');
				//verify that clearDecorations was called only once.
				findDecorationsMock.verify(x => x.clearDecorations(), TypeMoq.Times.once());
			}
		}
	});

	for (const currentMatch of [null, new NotebookRange(<ICellModel>{}, 1, 1, 1, 1)]) {
		const searchString = getRandomString(1, 10); // a random string 1 to 10 characters long.
		for (const modelFindExpression of [searchString, getRandomString(1, 10)]) {
			for (const matchCase of [false, true]) {
				for (const wholeWord of [false, true]) {
					for (const findMatches of [[], [new NotebookFindMatch(currentMatch || <NotebookRange>{}, null)]]) {
						test(`Verifies _onFindStateChange callback when searchString='${searchString}', currentMatch='${currentMatch}', findExpression='${modelFindExpression}', matchCase='${matchCase}', wholeWord='${wholeWord}', findMatches='${findMatches}'`, async () => {
							await verifyFindCallsWhenFindStateChangeCallbackFires(instantiationService, workbenchThemeService, notebookService, untitledNotebookInput, modelFindExpression, currentMatch, searchString, wholeWord, matchCase, findMatches);
						});
					}
				}
			}
		}
	}


	for (const searchString of ['', undefined]) {
		for (const matchCase of [true, false]) {
			for (const wholeWord of [true, false]) {
				test(`Verifies _onFindStateChange callback when searchString='${searchString}', matchCase='${matchCase}', wholeWord='${wholeWord}'`, async () => {
					await verifyClearDeocorationsAndClearFindCallsWhenFindStateChangeCallbackFires(instantiationService, workbenchThemeService, notebookService, untitledNotebookInput, searchString, wholeWord, matchCase);
				});
			}
		}
	}


	for (const visibility of ['hidden', 'visible']) {
		const searchString = getRandomString(1, 10);
		const matchCase = true;
		const wholeWord = true;
		const searchScope = new NotebookRange(<ICellModel>{}, 1, 1, 1, 1);
		const currentMatch = <NotebookRange>{};
		test(`Verifies _onFindStateChange callback when searchScope is defined,  visibility='${visibility}', searchString='${searchString}', matchCase='${matchCase}', wholeWord='${wholeWord}'`, async () => {
			const { findReplaceStateChangedEvent, notebookFindModelMock, findDecorationsMock, notebookFindModel, notebookEditor } = await findStateChangeSetup(instantiationService, workbenchThemeService, notebookService, untitledNotebookInput, undefined, currentMatch, searchString, wholeWord, matchCase, searchScope);
			notebookFindModelMock.setup(x => x.getIndexByRange(TypeMoq.It.isAny())).returns((_range: NotebookRange) => {
				assert.strictEqual(_range, currentMatch, `getIndexByRange must be called with the same NotebookRange that we set for '_currentMatch' property of notebookEditor`);
				return 0;
			});
			findReplaceStateChangedEvent.searchString = false;
			findReplaceStateChangedEvent.matchCase = false;
			findReplaceStateChangedEvent.wholeWord = false;
			const findMatches = [new NotebookFindMatch(currentMatch, null)];
			notebookFindModel['_findMatches'] = findMatches;
			notebookFindModel['_findArray'] = findMatches.map(x => x?.range);
			await notebookEditor['_onFindStateChange'](findReplaceStateChangedEvent);
			notebookEditor['_finder'].getDomNode().style.visibility = visibility;
			notebookFindModelMock.verify(x => x.find(
				TypeMoq.It.isAnyString(),
				TypeMoq.It.isAny(),
				TypeMoq.It.isAny(),
				TypeMoq.It.isAnyNumber()
			), TypeMoq.Times.once());
			findDecorationsMock.verify(x => x.clearDecorations(), TypeMoq.Times.never());
			notebookFindModelMock.verify(x => x.clearFind(), TypeMoq.Times.never());
			if (visibility === 'visible') {
				assert.strictEqual(notebookEditor.getPosition(), currentMatch, `position must be set to the same NotebookRange that we set for '_currentMatch' property of notebookEditor`);
			}
		});
	}


	test(`Verifies callbacks registered by registerModelChanges`, async () => {
		const searchString = getRandomString(1, 10);
		const matchCase = true;
		const wholeWord = true;
		const searchScope = new NotebookRange(<ICellModel>{}, 1, 1, 1, 1);
		const currentMatch = <NotebookRange>{};
		const { notebookFindModelMock, notebookEditor } = await findStateChangeSetup(instantiationService, workbenchThemeService, notebookService, untitledNotebookInput, undefined, currentMatch, searchString, wholeWord, matchCase, searchScope);
		notebookFindModelMock.setup(x => x.getIndexByRange(TypeMoq.It.isAny())).returns((_range: NotebookRange) => {
			assert.strictEqual(_range, currentMatch, `getIndexByRange must be called with the same NotebookRange that we set for '_currentMatch' property of notebookEditor`);
			return 0;
		});
		untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
		const notebookModel = <NotebookModelStub>await notebookEditor.getNotebookModel();
		notebookEditor['registerModelChanges']();
		notebookModel.cells[0]['_onCellModeChanged'].fire(true); //fire cellModeChanged event on the first sell of our test notebookModel
		notebookModel.contentChangedEmitter.fire({ changeType: NotebookChangeType.Saved });
		(<NotebookService>notebookService)['_onNotebookEditorAdd'].fire(<INotebookEditor>{});
		notebookFindModelMock.verify(x => x.find(
			TypeMoq.It.isAnyString(),
			TypeMoq.It.isAny(),
			TypeMoq.It.isAny(),
			TypeMoq.It.isAnyNumber()
		), TypeMoq.Times.exactly(3));
	});

	test(`Verifies _triggerInputChange raises error and does not throw'`, async () => {
		const searchString = getRandomString(1, 10);
		const matchCase = true;
		const wholeWord = true;
		const searchScope = new NotebookRange(<ICellModel>{}, 1, 1, 1, 1);
		const currentMatch = <NotebookRange>{};
		const { notebookEditor } = await findStateChangeSetup(instantiationService, workbenchThemeService, notebookService, untitledNotebookInput, undefined, currentMatch, searchString, wholeWord, matchCase, searchScope);
		untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
		await notebookEditor.setNotebookModel();
		let unexpectedErrorCalled = false;
		const unexpectedErrorMessage = 'unexpected Error occurred';
		const onUnexpectedErrorVerifier = (error: any) => {
			unexpectedErrorCalled = true;
			assert.ok(error instanceof Error, `${onUnexpectedError} must be passed an instance of ${Error}`);
			assert.strictEqual((error as Error).message, unexpectedErrorMessage, `Error text must be '${unexpectedErrorMessage}' when exception occurs within _triggerInputChange method`);
		};
		errorHandler.setUnexpectedErrorHandler(onUnexpectedErrorVerifier);
		notebookEditor['_onFindStateChange'] = async (changeEvent: FindReplaceStateChangedEvent) => {
			try {
				throw new Error(unexpectedErrorMessage);
			} finally { }
		};
		notebookEditor['_triggerInputChange']();
		assert.notStrictEqual(unexpectedErrorCalled, true, '_triggerInputChange did not raise an error when an exception occurred Notebook model should be defined after findState.change->notebookEditor._onFindReplaceStateChange call');
	});

	test(`Verifies _onFindStateChange callback sets notebookModel when it was not previously set'`, async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		notebookEditor['_notebookModel'] = undefined;
		const findState = notebookEditor['_findState'];
		const newState: INewFindReplaceState = {
			searchString: getRandomString(1, 10),
			matchCase: true,
			wholeWord: true,
			searchScope: <NotebookRange>{}
		};
		findState.change(newState, false);
		untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
		const model = await notebookEditor.getNotebookModel();
		assert.notStrictEqual(model, undefined, 'Notebook model should be defined after findState.change->notebookEditor._onFindReplaceStateChange call');
	});

	test(`Verifies _updateFinderMatchState with no notebookInput or notebookFindModel`, async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		const findState = notebookEditor['_findState'];
		findState['changeMatchInfo'] = (matchPosition: number, matchCount: number, currentMatch: NotebookRange) => {
			assert.strictEqual(matchPosition, 0, `matchPosition parameter to changeMatchInfo call when notebookInput or notebookFindModel is not defined should be 0`);
			assert.strictEqual(matchCount, 0, `matchCount parameter to changeMatchInfo call when notebookInput or notebookFindModel is not defined should be 0`);
			assert.strictEqual(currentMatch, undefined, `currentMatch parameter to changeMatchInfo call when notebookInput or notebookFindModel is not defined should be undefined`);
		};
		notebookEditor['_input'] = <NotebookInput>{};
		notebookEditor['_updateFinderMatchState']();
		notebookEditor['_input'] = undefined;
		notebookEditor['_updateFinderMatchState']();
	});

	test(`Verifies onFindCountChange.fire invokes _updateFinderMatchState`, async () => {
		await setupNotebookEditor(notebookEditor, untitledNotebookInput);
		untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
		await notebookEditor.setNotebookModel();
		const findState = notebookEditor['_findState'];
		const newState: INewFindReplaceState = {
			searchString: getRandomString(1, 10),
			matchCase: true,
			wholeWord: true,
			searchScope: <NotebookRange>{}
		};
		findState.change(newState, false); //installs _updateFinderMatchState as event handler for onFindCountChange event
		let updateFinderMatchStateCalled = false;
		notebookEditor['_updateFinderMatchState'] = () => {
			updateFinderMatchStateCalled = true;
		};
		notebookEditor.notebookInput.notebookFindModel['_onFindCountChange'].fire(null);
		assert.strictEqual(updateFinderMatchStateCalled, true, `_updateFinderMatchState() should have been called`);
	});
});

async function verifyClearDeocorationsAndClearFindCallsWhenFindStateChangeCallbackFires(instantiationService: TestInstantiationService, workbenchThemeService: any, notebookService: NotebookService, untitledNotebookInput: UntitledNotebookInput, searchString: string, wholeWord: boolean, matchCase: boolean) {
	const { findReplaceStateChangedEvent, notebookFindModelMock, findDecorationsMock, notebookEditor } = await findStateChangeSetup(instantiationService, workbenchThemeService, notebookService, untitledNotebookInput, undefined, undefined, searchString, wholeWord, matchCase);
	await notebookEditor['_onFindStateChange'](findReplaceStateChangedEvent);
	notebookFindModelMock.verify(x => x.find(
		TypeMoq.It.isAnyString(),
		TypeMoq.It.isAny(),
		TypeMoq.It.isAny(),
		TypeMoq.It.isAnyNumber()
	), TypeMoq.Times.never());
	if (searchString === '' || findReplaceStateChangedEvent.matchCase || findReplaceStateChangedEvent.wholeWord) {
		findDecorationsMock.verify(x => x.clearDecorations(), TypeMoq.Times.once());
		notebookFindModelMock.verify(x => x.clearFind(), TypeMoq.Times.once());
	}
	else {
		findDecorationsMock.verify(x => x.clearDecorations(), TypeMoq.Times.never());
		notebookFindModelMock.verify(x => x.clearFind(), TypeMoq.Times.never());
	}
}

async function verifyFindCallsWhenFindStateChangeCallbackFires(instantiationService: TestInstantiationService, workbenchThemeService: any, notebookService: NotebookService, untitledNotebookInput: UntitledNotebookInput, modelFindExpression: string, currentMatch: NotebookRange, searchString: string, wholeWord: boolean, matchCase: boolean, findMatches: NotebookFindMatch[]) {
	const { findReplaceStateChangedEvent, notebookFindModelMock, findDecorationsMock, notebookEditor } = await findStateChangeSetup(instantiationService, workbenchThemeService, notebookService, untitledNotebookInput, modelFindExpression, currentMatch, searchString, wholeWord, matchCase, null, findMatches);
	await notebookEditor['_onFindStateChange'](findReplaceStateChangedEvent);
	if (currentMatch) {
		assert.strictEqual(notebookEditor.getPosition(), currentMatch, `position must be set to the same NotebookRange that we set for '_currentMatch' property of notebookEditor`);
	}
	if (searchString === modelFindExpression && currentMatch && !matchCase && !wholeWord) {
		notebookFindModelMock.verify(x => x.find(
			TypeMoq.It.isAnyString(),
			TypeMoq.It.isAny(),
			TypeMoq.It.isAny(),
			TypeMoq.It.isAnyNumber()
		), TypeMoq.Times.never());
		findDecorationsMock.verify(x => x.set(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
	}
	else {
		notebookFindModelMock.verify(x => x.find(
			TypeMoq.It.isAnyString(),
			TypeMoq.It.isAny(),
			TypeMoq.It.isAny(),
			TypeMoq.It.isAnyNumber()
		), TypeMoq.Times.once());
		assert.strictEqual(notebookEditor.notebookFindModel.findExpression, searchString, `findExpression should get set to the provided searchString:${searchString}`);
		if (!currentMatch && notebookEditor.notebookFindModel.findMatches.length === 0) {
			notebookFindModelMock.verify(x => x.clearFind(), TypeMoq.Times.once());
			findDecorationsMock.verify(x => x.set(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
			assert.strictEqual(notebookEditor.notebookFindModel.findArray?.length ?? 0, 0, 'The find array should be cleared or undefined if there were no findMatches');
		}
		else {
			findDecorationsMock.verify(x => x.set(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		}
	}
	findDecorationsMock.verify(x => x.clearDecorations(), TypeMoq.Times.once());
}

async function findStateChangeSetup(instantiationService: TestInstantiationService, workbenchThemeService: any, notebookService: NotebookService, untitledNotebookInput: UntitledNotebookInput, modelFindExpression: string, currentMatch: NotebookRange, searchString: string, wholeWord: boolean, matchCase: boolean, searchScope: NotebookRange | null = undefined, findMatches: Array<NotebookFindMatch> = []) {
	const findReplaceStateChangedEvent: FindReplaceStateChangedEvent = {
		searchString: searchString !== undefined,
		matchCase: matchCase,
		wholeWord: wholeWord,
		searchScope: !!searchScope,
		isRevealed: true,

		moveCursor: false,
		updateHistory: false,
		replaceString: false,
		isReplaceRevealed: false,
		isRegex: false,
		preserveCase: false,
		matchesPosition: false,
		matchesCount: false,
		currentMatch: false,
		loop: false
	};

	const notebookEditor = createNotebookEditor(instantiationService, workbenchThemeService, notebookService);
	await setupNotebookEditor(notebookEditor, untitledNotebookInput);
	untitledNotebookInput.notebookFindModel.notebookModel = undefined; // clear preexisting notebookModel
	await notebookEditor.setNotebookModel();
	const findState = notebookEditor['_findState'];
	findState['_searchString'] = searchString;
	findState['_isRevealed'] = findReplaceStateChangedEvent.isRevealed;
	findState['_wholeWord'] = findReplaceStateChangedEvent.wholeWord;
	findState['_matchCase'] = findReplaceStateChangedEvent.matchCase;
	findState['_searchScope'] = searchScope;
	const notebookFindModel = notebookEditor.notebookInput.notebookFindModel;
	notebookFindModel['_findMatches'] = findMatches;
	notebookFindModel['_findArray'] = findMatches.map(x => x?.range);
	const notebookFindModelMock = TypeMoq.Mock.ofInstance(notebookFindModel);
	notebookFindModelMock.callBase = true;
	const spiedNotebookFindModel = notebookFindModelMock.object;
	notebookEditor.notebookInput['_notebookFindModel'] = spiedNotebookFindModel;

	spiedNotebookFindModel.findExpression = modelFindExpression;
	const findDecorations = notebookFindModel.findDecorations;
	findDecorations['_currentMatch'] = currentMatch;

	const findDecorationsMock = TypeMoq.Mock.ofInstance(findDecorations);
	const spiedFindDecorations = findDecorationsMock.object;
	findDecorationsMock.callBase = true; //forward to base object by default.
	notebookFindModel['_findDecorations'] = spiedFindDecorations;
	notebookEditor['_currentMatch'] = currentMatch;

	findDecorationsMock.setup(x => x.clearDecorations());
	findDecorationsMock.setup(x => x.set(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_findMatches, _currentMatch) => {
		// install a no-op method
	});
	notebookFindModelMock.setup(x => x.find(
		TypeMoq.It.isAnyString(),
		TypeMoq.It.isAny(),
		TypeMoq.It.isAny(),
		TypeMoq.It.isAnyNumber()
	)).returns((_searchString: string, _matchCase: boolean, _wholeWord: boolean, _maxMatches: number) => {
		assert.strictEqual(_searchString, searchString, `find method should be called with the test search string:'${searchString}'`);
		assert.strictEqual(_wholeWord, wholeWord, `find method should be called with the test value of wholeWord:'${wholeWord}'`);
		assert.strictEqual(_matchCase, matchCase, `find method should be called with the test value of matchCase:'${matchCase}'`);
		return Promise.resolve(currentMatch);
	});
	notebookFindModelMock.setup(x => x.clearFind());
	return { findReplaceStateChangedEvent, notebookFindModelMock, findDecorationsMock, notebookFindModel, notebookEditor };
}

function setupServices(arg: { workbenchThemeService?: WorkbenchThemeService, instantiationService?: TestInstantiationService } = {}) {
	const installEvent: Emitter<InstallExtensionEvent> = new Emitter<InstallExtensionEvent>();
	const didInstallEvent = new Emitter<DidInstallExtensionEvent>();
	const uninstallEvent = new Emitter<IExtensionIdentifier>();
	const didUninstallEvent = new Emitter<DidUninstallExtensionEvent>();

	const instantiationService = arg.instantiationService ?? <TestInstantiationService>workbenchInstantiationService();
	const workbenchThemeService = arg.workbenchThemeService ?? instantiationService.createInstance(WorkbenchThemeService);
	instantiationService.stub(IWorkbenchThemeService, workbenchThemeService);

	const queryManagementService = new NBTestQueryManagementService();

	instantiationService.stub(IExtensionManagementService, ExtensionManagementService);
	instantiationService.stub(IExtensionManagementService, 'onInstallExtension', installEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onDidInstallExtension', didInstallEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onUninstallExtension', uninstallEvent.event);
	instantiationService.stub(IExtensionManagementService, 'onDidUninstallExtension', didUninstallEvent.event);

	instantiationService.stub(IProductService, { quality: 'stable' });

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
		instantiationService.get(IContextKeyService),
		instantiationService.get(IProductService)
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
		instantiationService.get(IEditorService)
	);
	const notebookEditorStub = new NotebookEditorStub({ cellGuid: cellTextEditorGuid, editor: queryTextEditor, model: new NotebookModelStub(), notebookParams: <INotebookParams>{ notebookUri: untitledNotebookInput.notebookUri } });
	notebookService.addNotebookEditor(notebookEditorStub);
	return { instantiationService, workbenchThemeService, notebookService, testTitle, extensionService, cellTextEditorGuid, queryTextEditor, untitledNotebookInput, notebookEditorStub };
}

function createNotebookEditor(instantiationService: TestInstantiationService, workbenchThemeService: WorkbenchThemeService, notebookService: NotebookService) {
	return new NotebookEditor(
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
}

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

