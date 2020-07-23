/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';

import { MarkdownTextTransformer, MarkdownButtonType } from 'sql/workbench/contrib/notebook/browser/markdownToolbarActions';
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

	setup(() => {
		const dialogService = new TestDialogService();
		const notificationService = new TestNotificationService();
		const undoRedoService = new UndoRedoService(dialogService, notificationService);
		const instantiationService = new TestInstantiationService();

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
			instantiationService.get(IProductService)
		);
		mockNotebookService = TypeMoq.Mock.ofInstance(notebookService);

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

	test('Transform text with no previous selection', () => {
		testWithNoSelection(MarkdownButtonType.BOLD, '****', true);
		testWithNoSelection(MarkdownButtonType.BOLD, '');
		testWithNoSelection(MarkdownButtonType.ITALIC, '__', true);
		testWithNoSelection(MarkdownButtonType.ITALIC, '');
		testWithNoSelection(MarkdownButtonType.CODE, '```\n\n```', true);
		testWithNoSelection(MarkdownButtonType.CODE, '');
		testWithNoSelection(MarkdownButtonType.HIGHLIGHT, '<mark></mark>', true);
		testWithNoSelection(MarkdownButtonType.HIGHLIGHT, '');
		testWithNoSelection(MarkdownButtonType.LINK, '[]()', true);
		testWithNoSelection(MarkdownButtonType.LINK, '');
		testWithNoSelection(MarkdownButtonType.UNORDERED_LIST, '- ', true);
		testWithNoSelection(MarkdownButtonType.UNORDERED_LIST, '');
		testWithNoSelection(MarkdownButtonType.ORDERED_LIST, '1. ', true);
		testWithNoSelection(MarkdownButtonType.ORDERED_LIST, '');
		testWithNoSelection(MarkdownButtonType.IMAGE, '![]()', true);
		testWithNoSelection(MarkdownButtonType.IMAGE, '');
		testWithNoSelection(MarkdownButtonType.HEADING1, '# ', true);
		testWithNoSelection(MarkdownButtonType.HEADING1, '');
		testWithNoSelection(MarkdownButtonType.HEADING2, '## ', true);
		testWithNoSelection(MarkdownButtonType.HEADING2, '');
		testWithNoSelection(MarkdownButtonType.HEADING3, '### ', true);
		testWithNoSelection(MarkdownButtonType.HEADING3, '');
	});

	test('Transform text with one word selected', () => {
		testWithSingleWordSelected(MarkdownButtonType.CODE, '```\nWORD\n```');
	});

	test('Transform text with multiple words selected', () => {
		testWithMultipleWordsSelected(MarkdownButtonType.BOLD, '**Multi Words**');
		testWithMultipleWordsSelected(MarkdownButtonType.ITALIC, '_Multi Words_');
		testWithMultipleWordsSelected(MarkdownButtonType.CODE, '```\nMulti Words\n```');
		testWithMultipleWordsSelected(MarkdownButtonType.HIGHLIGHT, '<mark>Multi Words</mark>');
		testWithMultipleWordsSelected(MarkdownButtonType.LINK, '[Multi Words]()');
		testWithMultipleWordsSelected(MarkdownButtonType.UNORDERED_LIST, '- Multi Words');
		testWithMultipleWordsSelected(MarkdownButtonType.ORDERED_LIST, '1. Multi Words');
		testWithMultipleWordsSelected(MarkdownButtonType.IMAGE, '![Multi Words]()');
	});

	test('Transform text with multiple lines selected', () => {
		testWithMultipleLinesSelected(MarkdownButtonType.BOLD, '**Multi\nLines\nSelected**');
		testWithMultipleLinesSelected(MarkdownButtonType.ITALIC, '_Multi\nLines\nSelected_');
		testWithMultipleLinesSelected(MarkdownButtonType.CODE, '```\nMulti\nLines\nSelected\n```');
		testWithMultipleLinesSelected(MarkdownButtonType.HIGHLIGHT, '<mark>Multi\nLines\nSelected</mark>');
		testWithMultipleLinesSelected(MarkdownButtonType.LINK, '[Multi\nLines\nSelected]()');
		testWithMultipleLinesSelected(MarkdownButtonType.UNORDERED_LIST, '- Multi\n- Lines\n- Selected');
		testWithMultipleLinesSelected(MarkdownButtonType.ORDERED_LIST, '1. Multi\n1. Lines\n1. Selected');
		testWithMultipleLinesSelected(MarkdownButtonType.IMAGE, '![Multi\nLines\nSelected]()');
		testWithMultipleLinesSelected(MarkdownButtonType.HEADING1, '# Multi\n# Lines\n# Selected');
		testWithMultipleLinesSelected(MarkdownButtonType.HEADING2, '## Multi\n## Lines\n## Selected');
		testWithMultipleLinesSelected(MarkdownButtonType.HEADING3, '### Multi\n### Lines\n### Selected');
	});

	test('Ensure notebook editor returns expected object', () => {
		assert.deepEqual(notebookEditor, markdownTextTransformer.notebookEditor, 'Notebook editor does not match expected value');
		// Set markdown text transformer to not have a notebook editor passed in
		markdownTextTransformer = new MarkdownTextTransformer(mockNotebookService.object, cellModel);
		assert.equal(markdownTextTransformer.notebookEditor, undefined, 'No notebook editor should be returned');
		// Even after text is attempted to be transformed, there should be no editor, and therefore nothing on the text model
		markdownTextTransformer.transformText(MarkdownButtonType.BOLD);
		assert.equal(markdownTextTransformer.notebookEditor, undefined, 'Notebook model does not have a valid uri, so no editor should be returned');
		assert.equal(textModel.getValue(), '', 'No text should exist on the textModel');
	});

	function testWithNoSelection(type: MarkdownButtonType, expectedValue: string, setValue = false): void {
		if (setValue) {
			textModel.setValue('');
		}
		markdownTextTransformer.transformText(type);
		assert.equal(textModel.getValue(), expectedValue, `${MarkdownButtonType[type]} with no selection failed (setValue ${setValue})`);
	}

	function testWithSingleWordSelected(type: MarkdownButtonType, expectedValue: string): void {
		let value = 'WORD';
		textModel.setValue(value);

		// Test transformation (adding text)
		widget.setSelection({ startColumn: 1, startLineNumber: 1, endColumn: value.length + 1, endLineNumber: 1 });
		assert.equal(textModel.getValueInRange(widget.getSelection()), value, 'Expected selection is not found');
		markdownTextTransformer.transformText(type);
		const textModelValue = textModel.getValue();
		assert.equal(textModelValue, expectedValue, `${MarkdownButtonType[type]} with single word selection failed`);

		// Test undo (removing text)
		const valueRange = getValueRange(textModel, value);
		assert.notEqual(valueRange, undefined, 'Could not find value in model after transformation');
		widget.setSelection(valueRange);
		markdownTextTransformer.transformText(type);
		assert.equal(textModel.getValue(), value, `Undo operation for ${MarkdownButtonType[type]} with single word selection failed`);
	}

	function testWithMultipleWordsSelected(type: MarkdownButtonType, expectedValue: string): void {
		let value = 'Multi Words';
		textModel.setValue(value);
		widget.setSelection({ startColumn: 1, startLineNumber: 1, endColumn: 12, endLineNumber: 1 });
		assert.equal(textModel.getValueInRange(widget.getSelection()), value, 'Expected multi-word selection is not found');
		markdownTextTransformer.transformText(type);
		assert.equal(textModel.getValue(), expectedValue, `${MarkdownButtonType[type]} with multiple word selection failed`);

		// Test undo (removing text)
		const valueRange = getValueRange(textModel, value);
		assert.notEqual(valueRange, undefined, 'Could not find value in model after transformation');
		widget.setSelection(valueRange);
		markdownTextTransformer.transformText(type);
		assert.equal(textModel.getValue(), value, `Undo operation for ${MarkdownButtonType[type]} with multiple word selection failed`);
	}

	function testWithMultipleLinesSelected(type: MarkdownButtonType, expectedValue: string): void {
		let value = 'Multi\nLines\nSelected';
		textModel.setValue(value);
		widget.setSelection({ startColumn: 1, startLineNumber: 1, endColumn: 9, endLineNumber: 3 });
		assert.equal(textModel.getValueInRange(widget.getSelection()), value, 'Expected multi-line selection is not found');
		markdownTextTransformer.transformText(type);
		assert.equal(textModel.getValue(), expectedValue, `${MarkdownButtonType[type]} with multiple line selection failed`);

		// Test undo (removing text)
		let valueRange = getValueRange(textModel, 'Multi');
		// Modify the range to include all the lines
		valueRange = new Range(valueRange.startLineNumber, valueRange.startColumn, valueRange.endLineNumber + 2, 9);
		assert.notEqual(valueRange, undefined, 'Could not find value in model after transformation');
		widget.setSelection(valueRange);
		markdownTextTransformer.transformText(type);
		assert.equal(textModel.getValue(), value, `Undo operation for ${MarkdownButtonType[type]} with multiple line selection failed`);
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
