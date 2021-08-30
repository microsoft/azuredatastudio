/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';

import { MarkdownTextTransformer, MarkdownButtonType, insertFormattedMarkdown } from 'sql/workbench/contrib/notebook/browser/markdownToolbarActions';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestLifecycleService, TestEnvironmentService, TestAccessibilityService } from 'vs/workbench/test/browser/workbenchTestServices';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TextModel } from 'vs/editor/common/model/textModel';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { TestCodeEditorService } from 'vs/editor/test/browser/editorTestServices';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { DefaultEndOfLine } from 'vs/editor/common/model';
import { UndoRedoService } from 'vs/platform/undoRedo/common/undoRedoService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditor } from 'vs/editor/common/editorCommon';
import { NotebookEditorStub } from 'sql/workbench/contrib/notebook/test/testCommon';
import { Range } from 'vs/editor/common/core/range';
import { IProductService } from 'vs/platform/product/common/productService';

suite('MarkdownTextTransformer', () => {
	let markdownTextTransformer: MarkdownTextTransformer;
	let widget: IEditor;
	let textModel: TextModel;
	let notebookEditor: NotebookEditorStub;
	let mockNotebookService: TypeMoq.Mock<INotebookService>;
	let cellModel: CellModel;
	let instantiationService: TestInstantiationService;

	setup(() => {
		const dialogService = new TestDialogService();
		const notificationService = new TestNotificationService();
		const undoRedoService = new UndoRedoService(dialogService, notificationService);
		instantiationService = new TestInstantiationService();

		instantiationService.stub(IAccessibilityService, new TestAccessibilityService());
		instantiationService.stub(IContextKeyService, new MockContextKeyService());
		instantiationService.stub(ICodeEditorService, new TestCodeEditorService());
		instantiationService.stub(IThemeService, new TestThemeService());
		instantiationService.stub(IEnvironmentService, TestEnvironmentService);
		instantiationService.stub(IStorageService, new TestStorageService());

		instantiationService.stub(IProductService, { quality: 'stable' });

		let notebookService = new NotebookService(
			new TestLifecycleService(),
			undefined,
			undefined,
			undefined,
			instantiationService,
			undefined,
			undefined,
			undefined,
			new MockContextKeyService(),
			instantiationService.get(IProductService),
			undefined,
			undefined,
			undefined,
			undefined,
		);
		mockNotebookService = TypeMoq.Mock.ofInstance<INotebookService>(notebookService);

		cellModel = new CellModel(undefined, undefined, mockNotebookService.object);
		notebookEditor = new NotebookEditorStub({ cellGuid: cellModel.cellGuid, instantiationService: instantiationService });
		markdownTextTransformer = new MarkdownTextTransformer(mockNotebookService.object, cellModel, notebookEditor);
		mockNotebookService.setup(s => s.findNotebookEditor(TypeMoq.It.isAny())).returns(() => notebookEditor);

		let editor = notebookEditor.cellEditors[0].getEditor();
		assert(!isUndefinedOrNull(editor), 'editor is undefined');

		widget = editor.getControl();
		assert(!isUndefinedOrNull(widget), 'widget is undefined');

		// Create new text model
		textModel = new TextModel('', { isForSimpleWidget: true, defaultEOL: DefaultEndOfLine.LF, detectIndentation: true, indentSize: 0, insertSpaces: false, largeFileOptimizations: false, tabSize: 4, trimAutoWhitespace: false }, null, undefined, undoRedoService);

		// Couple widget with newly created text model
		widget.setModel(textModel);

		assert(!isUndefinedOrNull(widget.getModel()), 'Text model is undefined');
	});

	test('Transform text with no previous selection', async () => {
		await testWithNoSelection(MarkdownButtonType.BOLD, '****', true);
		await testWithNoSelection(MarkdownButtonType.BOLD, '');
		await testWithNoSelection(MarkdownButtonType.ITALIC, '__', true);
		await testWithNoSelection(MarkdownButtonType.ITALIC, '');
		await testWithNoSelection(MarkdownButtonType.CODE, '```\n\n```', true);
		await testWithNoSelection(MarkdownButtonType.CODE, '');
		await testWithNoSelection(MarkdownButtonType.HIGHLIGHT, '<mark></mark>', true);
		await testWithNoSelection(MarkdownButtonType.HIGHLIGHT, '');
		await testWithNoSelection(MarkdownButtonType.LINK, '[]()', true);
		await testWithNoSelection(MarkdownButtonType.LINK, '');
		await testWithNoSelection(MarkdownButtonType.UNORDERED_LIST, '- ', true);
		await testWithNoSelection(MarkdownButtonType.UNORDERED_LIST, '');
		await testWithNoSelection(MarkdownButtonType.ORDERED_LIST, '1. ', true);
		await testWithNoSelection(MarkdownButtonType.ORDERED_LIST, '');
		await testWithNoSelection(MarkdownButtonType.IMAGE, '![]()', true);
		await testWithNoSelection(MarkdownButtonType.IMAGE, '');
		await testWithNoSelection(MarkdownButtonType.HEADING1, '# ', true);
		await testWithNoSelection(MarkdownButtonType.HEADING1, '');
		await testWithNoSelection(MarkdownButtonType.HEADING2, '## ', true);
		await testWithNoSelection(MarkdownButtonType.HEADING2, '');
		await testWithNoSelection(MarkdownButtonType.HEADING3, '### ', true);
		await testWithNoSelection(MarkdownButtonType.HEADING3, '');
		await testPreviouslyTransformedWithNoSelection(MarkdownButtonType.LINK_PREVIEW, '[test](./URL)', true);
	});

	test('Transform text with one word selected', async () => {
		await testWithSingleWordSelected(MarkdownButtonType.CODE, '```\nWORD\n```');
		await testPreviouslyTransformedWithSingleWordSelected(MarkdownButtonType.LINK_PREVIEW, '[SampleURL](https://aka.ms)');
	});

	test('Transform text with multiple words selected', async () => {
		await testWithMultipleWordsSelected(MarkdownButtonType.BOLD, '**Multi Words**');
		await testWithMultipleWordsSelected(MarkdownButtonType.ITALIC, '_Multi Words_');
		await testWithMultipleWordsSelected(MarkdownButtonType.CODE, '```\nMulti Words\n```');
		await testWithMultipleWordsSelected(MarkdownButtonType.HIGHLIGHT, '<mark>Multi Words</mark>');
		await testWithMultipleWordsSelected(MarkdownButtonType.LINK, '[Multi Words]()');
		await testWithMultipleWordsSelected(MarkdownButtonType.UNORDERED_LIST, '- Multi Words');
		await testWithMultipleWordsSelected(MarkdownButtonType.ORDERED_LIST, '1. Multi Words');
		await testWithMultipleWordsSelected(MarkdownButtonType.IMAGE, '![Multi Words]()');
	});

	test('Transform text with multiple lines selected', async () => {
		await testWithMultipleLinesSelected(MarkdownButtonType.BOLD, '**Multi\nLines\nSelected**');
		await testWithMultipleLinesSelected(MarkdownButtonType.ITALIC, '_Multi\nLines\nSelected_');
		await testWithMultipleLinesSelected(MarkdownButtonType.CODE, '```\nMulti\nLines\nSelected\n```');
		await testWithMultipleLinesSelected(MarkdownButtonType.HIGHLIGHT, '<mark>Multi\nLines\nSelected</mark>');
		await testWithMultipleLinesSelected(MarkdownButtonType.LINK, '[Multi\nLines\nSelected]()');
		await testWithMultipleLinesSelected(MarkdownButtonType.UNORDERED_LIST, '- Multi\n- Lines\n- Selected');
		await testWithMultipleLinesSelected(MarkdownButtonType.ORDERED_LIST, '1. Multi\n1. Lines\n1. Selected');
		await testWithMultipleLinesSelected(MarkdownButtonType.IMAGE, '![Multi\nLines\nSelected]()');
		await testWithMultipleLinesSelected(MarkdownButtonType.HEADING1, '# Multi\n# Lines\n# Selected');
		await testWithMultipleLinesSelected(MarkdownButtonType.HEADING2, '## Multi\n## Lines\n## Selected');
		await testWithMultipleLinesSelected(MarkdownButtonType.HEADING3, '### Multi\n### Lines\n### Selected');
	});

	test('Ensure notebook editor returns expected object', async () => {
		assert.deepEqual(notebookEditor, markdownTextTransformer.notebookEditor, 'Notebook editor does not match expected value');
		// Set markdown text transformer to not have a notebook editor passed in
		markdownTextTransformer = new MarkdownTextTransformer(mockNotebookService.object, cellModel);
		assert.strictEqual(markdownTextTransformer.notebookEditor, undefined, 'No notebook editor should be returned');
		// Even after text is attempted to be transformed, there should be no editor, and therefore nothing on the text model
		await markdownTextTransformer.transformText(MarkdownButtonType.BOLD);
		assert.strictEqual(markdownTextTransformer.notebookEditor, undefined, 'Notebook model does not have a valid uri, so no editor should be returned');
		assert.strictEqual(textModel.getValue(), '', 'No text should exist on the textModel');
	});

	async function testWithNoSelection(type: MarkdownButtonType, expectedValue: string, setValue = false): Promise<void> {
		if (setValue) {
			textModel.setValue('');
		}
		await markdownTextTransformer.transformText(type);
		assert.strictEqual(textModel.getValue(), expectedValue, `${MarkdownButtonType[type]} with no selection failed (setValue ${setValue})`);
	}


	async function testPreviouslyTransformedWithNoSelection(type: MarkdownButtonType, expectedValue: string, setValue = false): Promise<void> {
		if (setValue) {
			textModel.setValue('');
		}
		await insertFormattedMarkdown('[test](./URL)', widget);
		assert.strictEqual(textModel.getValue(), expectedValue, `${MarkdownButtonType[type]} with no selection and previously transformed md failed (setValue ${setValue})`);
	}

	async function testWithSingleWordSelected(type: MarkdownButtonType, expectedValue: string): Promise<void> {
		let value = 'WORD';
		textModel.setValue(value);

		// Test transformation (adding text)
		widget.setSelection({ startColumn: 1, startLineNumber: 1, endColumn: value.length + 1, endLineNumber: 1 });
		assert.strictEqual(textModel.getValueInRange(widget.getSelection()), value, 'Expected selection is not found');
		await markdownTextTransformer.transformText(type);
		const textModelValue = textModel.getValue();
		assert.strictEqual(textModelValue, expectedValue, `${MarkdownButtonType[type]} with single word selection failed`);

		// Test undo (removing text)
		const valueRange = getValueRange(textModel, value);
		assert.notStrictEqual(valueRange, undefined, 'Could not find value in model after transformation');
		widget.setSelection(valueRange);
		await markdownTextTransformer.transformText(type);
		assert.strictEqual(textModel.getValue(), value, `Undo operation for ${MarkdownButtonType[type]} with single word selection failed`);
	}

	async function testPreviouslyTransformedWithSingleWordSelected(type: MarkdownButtonType, expectedValue: string): Promise<void> {
		let value = 'WORD';
		textModel.setValue(value);

		// Test transformation (adding text)
		widget.setSelection({ startColumn: 1, startLineNumber: 1, endColumn: value.length + 1, endLineNumber: 1 });
		assert.strictEqual(textModel.getValueInRange(widget.getSelection()), value, 'Expected selection is not found');
		await insertFormattedMarkdown('[SampleURL](https://aka.ms)', widget);
		const textModelValue = textModel.getValue();
		assert.strictEqual(textModelValue, expectedValue, `${MarkdownButtonType[type]} with single word selection and previously transformed md failed`);
	}

	async function testWithMultipleWordsSelected(type: MarkdownButtonType, expectedValue: string): Promise<void> {
		let value = 'Multi Words';
		textModel.setValue(value);
		widget.setSelection({ startColumn: 1, startLineNumber: 1, endColumn: 12, endLineNumber: 1 });
		assert.strictEqual(textModel.getValueInRange(widget.getSelection()), value, 'Expected multi-word selection is not found');
		await markdownTextTransformer.transformText(type);
		assert.strictEqual(textModel.getValue(), expectedValue, `${MarkdownButtonType[type]} with multiple word selection failed`);

		// Test undo (removing text)
		const valueRange = getValueRange(textModel, value);
		assert.notStrictEqual(valueRange, undefined, 'Could not find value in model after transformation');
		widget.setSelection(valueRange);
		await markdownTextTransformer.transformText(type);
		assert.strictEqual(textModel.getValue(), value, `Undo operation for ${MarkdownButtonType[type]} with multiple word selection failed`);
	}

	async function testWithMultipleLinesSelected(type: MarkdownButtonType, expectedValue: string): Promise<void> {
		let value = 'Multi\nLines\nSelected';
		textModel.setValue(value);
		widget.setSelection({ startColumn: 1, startLineNumber: 1, endColumn: 9, endLineNumber: 3 });
		assert.strictEqual(textModel.getValueInRange(widget.getSelection()), value, 'Expected multi-line selection is not found');
		await markdownTextTransformer.transformText(type);
		assert.strictEqual(textModel.getValue(), expectedValue, `${MarkdownButtonType[type]} with multiple line selection failed`);

		// Test undo (removing text)
		let valueRange = getValueRange(textModel, 'Multi');
		// Modify the range to include all the lines
		valueRange = new Range(valueRange.startLineNumber, valueRange.startColumn, valueRange.endLineNumber + 2, 9);
		assert.notStrictEqual(valueRange, undefined, 'Could not find value in model after transformation');
		widget.setSelection(valueRange);
		await markdownTextTransformer.transformText(type);
		assert.strictEqual(textModel.getValue(), value, `Undo operation for ${MarkdownButtonType[type]} with multiple line selection failed`);
	}
});

/**
 * Searches the model for the specified string value and if found returns a range for the last
 * occurence of that value.
 * @param textModel The model to search
 * @param value The value to search for
 */
function getValueRange(textModel: TextModel, value: string): Range | undefined {
	const linesContent = textModel.getLinesContent();
	let range = undefined;
	linesContent.forEach((line, index) => {
		const valueIndex = line.indexOf(value);
		if (valueIndex >= 0) {
			range = new Range(index + 1, valueIndex + 1, index + 1, valueIndex + value.length + 1);
		}
	});
	return range;
}
