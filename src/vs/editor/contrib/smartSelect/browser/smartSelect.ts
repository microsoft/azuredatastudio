/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arrays from 'vs/base/common/arrays';
import { CancellationToken } from 'vs/base/common/cancellation';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction, EditorContributionInstantiation, IActionOptions, registerEditorAction, registerEditorContribution, ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { Selection } from 'vs/editor/common/core/selection';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { ITextModel } from 'vs/editor/common/model';
import * as languages from 'vs/editor/common/languages';
import { BracketSelectionRangeProvider } from 'vs/editor/contrib/smartSelect/browser/bracketSelections';
import { WordSelectionRangeProvider } from 'vs/editor/contrib/smartSelect/browser/wordSelections';
import * as nls from 'vs/nls';
import { MenuId } from 'vs/platform/actions/common/actions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { LanguageFeatureRegistry } from 'vs/editor/common/languageFeatureRegistry';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { assertType } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';

class SelectionRanges {

	constructor(
		readonly index: number,
		readonly ranges: Range[]
	) { }

	mov(fwd: boolean): SelectionRanges {
		const index = this.index + (fwd ? 1 : -1);
		if (index < 0 || index >= this.ranges.length) {
			return this;
		}
		const res = new SelectionRanges(index, this.ranges);
		if (res.ranges[index].equalsRange(this.ranges[this.index])) {
			// next range equals this range, retry with next-next
			return res.mov(fwd);
		}
		return res;
	}
}

export class SmartSelectController implements IEditorContribution {

	static readonly ID = 'editor.contrib.smartSelectController';

	static get(editor: ICodeEditor): SmartSelectController | null {
		return editor.getContribution<SmartSelectController>(SmartSelectController.ID);
	}

	private _state?: SelectionRanges[];
	private _selectionListener?: IDisposable;
	private _ignoreSelection: boolean = false;

	constructor(
		private readonly _editor: ICodeEditor,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
	) { }

	dispose(): void {
		this._selectionListener?.dispose();
	}

	async run(forward: boolean): Promise<void> {
		if (!this._editor.hasModel()) {
			return;
		}

		const selections = this._editor.getSelections();
		const model = this._editor.getModel();

		if (!this._state) {

			await provideSelectionRanges(this._languageFeaturesService.selectionRangeProvider, model, selections.map(s => s.getPosition()), this._editor.getOption(EditorOption.smartSelect), CancellationToken.None).then(ranges => {
				if (!arrays.isNonEmptyArray(ranges) || ranges.length !== selections.length) {
					// invalid result
					return;
				}
				if (!this._editor.hasModel() || !arrays.equals(this._editor.getSelections(), selections, (a, b) => a.equalsSelection(b))) {
					// invalid editor state
					return;
				}

				for (let i = 0; i < ranges.length; i++) {
					ranges[i] = ranges[i].filter(range => {
						// filter ranges inside the selection
						return range.containsPosition(selections[i].getStartPosition()) && range.containsPosition(selections[i].getEndPosition());
					});
					// prepend current selection
					ranges[i].unshift(selections[i]);
				}


				this._state = ranges.map(ranges => new SelectionRanges(0, ranges));

				// listen to caret move and forget about state
				this._selectionListener?.dispose();
				this._selectionListener = this._editor.onDidChangeCursorPosition(() => {
					if (!this._ignoreSelection) {
						this._selectionListener?.dispose();
						this._state = undefined;
					}
				});
			});
		}

		if (!this._state) {
			// no state
			return;
		}
		this._state = this._state.map(state => state.mov(forward));
		const newSelections = this._state.map(state => Selection.fromPositions(state.ranges[state.index].getStartPosition(), state.ranges[state.index].getEndPosition()));
		this._ignoreSelection = true;
		try {
			this._editor.setSelections(newSelections);
		} finally {
			this._ignoreSelection = false;
		}
	}
}

abstract class AbstractSmartSelect extends EditorAction {

	private readonly _forward: boolean;

	constructor(forward: boolean, opts: IActionOptions) {
		super(opts);
		this._forward = forward;
	}

	async run(_accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const controller = SmartSelectController.get(editor);
		if (controller) {
			await controller.run(this._forward);
		}
	}
}

class GrowSelectionAction extends AbstractSmartSelect {
	constructor() {
		super(true, {
			id: 'editor.action.smartSelect.expand',
			label: nls.localize('smartSelect.expand', "Expand Selection"),
			alias: 'Expand Selection',
			precondition: undefined,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.Shift | KeyMod.Alt | KeyCode.RightArrow,
				mac: {
					primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyMod.Shift | KeyCode.RightArrow,
					secondary: [KeyMod.WinCtrl | KeyMod.Shift | KeyCode.RightArrow],
				},
				weight: KeybindingWeight.EditorContrib
			},
			menuOpts: {
				menuId: MenuId.MenubarSelectionMenu,
				group: '1_basic',
				title: nls.localize({ key: 'miSmartSelectGrow', comment: ['&& denotes a mnemonic'] }, "&&Expand Selection"),
				order: 2
			}
		});
	}
}

// renamed command id
CommandsRegistry.registerCommandAlias('editor.action.smartSelect.grow', 'editor.action.smartSelect.expand');

class ShrinkSelectionAction extends AbstractSmartSelect {
	constructor() {
		super(false, {
			id: 'editor.action.smartSelect.shrink',
			label: nls.localize('smartSelect.shrink', "Shrink Selection"),
			alias: 'Shrink Selection',
			precondition: undefined,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.Shift | KeyMod.Alt | KeyCode.LeftArrow,
				mac: {
					primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyMod.Shift | KeyCode.LeftArrow,
					secondary: [KeyMod.WinCtrl | KeyMod.Shift | KeyCode.LeftArrow],
				},
				weight: KeybindingWeight.EditorContrib
			},
			menuOpts: {
				menuId: MenuId.MenubarSelectionMenu,
				group: '1_basic',
				title: nls.localize({ key: 'miSmartSelectShrink', comment: ['&& denotes a mnemonic'] }, "&&Shrink Selection"),
				order: 3
			}
		});
	}
}

registerEditorContribution(SmartSelectController.ID, SmartSelectController, EditorContributionInstantiation.Lazy);
registerEditorAction(GrowSelectionAction);
registerEditorAction(ShrinkSelectionAction);

export interface SelectionRangesOptions {
	selectLeadingAndTrailingWhitespace: boolean;
	selectSubwords: boolean;
}

export async function provideSelectionRanges(registry: LanguageFeatureRegistry<languages.SelectionRangeProvider>, model: ITextModel, positions: Position[], options: SelectionRangesOptions, token: CancellationToken): Promise<Range[][]> {

	const providers = registry.all(model)
		.concat(new WordSelectionRangeProvider(options.selectSubwords)); // ALWAYS have word based selection range

	if (providers.length === 1) {
		// add word selection and bracket selection when no provider exists
		providers.unshift(new BracketSelectionRangeProvider());
	}

	const work: Promise<any>[] = [];
	const allRawRanges: Range[][] = [];

	for (const provider of providers) {

		work.push(Promise.resolve(provider.provideSelectionRanges(model, positions, token)).then(allProviderRanges => {
			if (arrays.isNonEmptyArray(allProviderRanges) && allProviderRanges.length === positions.length) {
				for (let i = 0; i < positions.length; i++) {
					if (!allRawRanges[i]) {
						allRawRanges[i] = [];
					}
					for (const oneProviderRanges of allProviderRanges[i]) {
						if (Range.isIRange(oneProviderRanges.range) && Range.containsPosition(oneProviderRanges.range, positions[i])) {
							allRawRanges[i].push(Range.lift(oneProviderRanges.range));
						}
					}
				}
			}
		}, onUnexpectedExternalError));
	}

	await Promise.all(work);

	return allRawRanges.map(oneRawRanges => {

		if (oneRawRanges.length === 0) {
			return [];
		}

		// sort all by start/end position
		oneRawRanges.sort((a, b) => {
			if (Position.isBefore(a.getStartPosition(), b.getStartPosition())) {
				return 1;
			} else if (Position.isBefore(b.getStartPosition(), a.getStartPosition())) {
				return -1;
			} else if (Position.isBefore(a.getEndPosition(), b.getEndPosition())) {
				return -1;
			} else if (Position.isBefore(b.getEndPosition(), a.getEndPosition())) {
				return 1;
			} else {
				return 0;
			}
		});

		// remove ranges that don't contain the former range or that are equal to the
		// former range
		const oneRanges: Range[] = [];
		let last: Range | undefined;
		for (const range of oneRawRanges) {
			if (!last || (Range.containsRange(range, last) && !Range.equalsRange(range, last))) {
				oneRanges.push(range);
				last = range;
			}
		}

		if (!options.selectLeadingAndTrailingWhitespace) {
			return oneRanges;
		}

		// add ranges that expand trivia at line starts and ends whenever a range
		// wraps onto the a new line
		const oneRangesWithTrivia: Range[] = [oneRanges[0]];
		for (let i = 1; i < oneRanges.length; i++) {
			const prev = oneRanges[i - 1];
			const cur = oneRanges[i];
			if (cur.startLineNumber !== prev.startLineNumber || cur.endLineNumber !== prev.endLineNumber) {
				// add line/block range without leading/failing whitespace
				const rangeNoWhitespace = new Range(prev.startLineNumber, model.getLineFirstNonWhitespaceColumn(prev.startLineNumber), prev.endLineNumber, model.getLineLastNonWhitespaceColumn(prev.endLineNumber));
				if (rangeNoWhitespace.containsRange(prev) && !rangeNoWhitespace.equalsRange(prev) && cur.containsRange(rangeNoWhitespace) && !cur.equalsRange(rangeNoWhitespace)) {
					oneRangesWithTrivia.push(rangeNoWhitespace);
				}
				// add line/block range
				const rangeFull = new Range(prev.startLineNumber, 1, prev.endLineNumber, model.getLineMaxColumn(prev.endLineNumber));
				if (rangeFull.containsRange(prev) && !rangeFull.equalsRange(rangeNoWhitespace) && cur.containsRange(rangeFull) && !cur.equalsRange(rangeFull)) {
					oneRangesWithTrivia.push(rangeFull);
				}
			}
			oneRangesWithTrivia.push(cur);
		}
		return oneRangesWithTrivia;
	});
}


CommandsRegistry.registerCommand('_executeSelectionRangeProvider', async function (accessor, ...args) {

	const [resource, positions] = args;
	assertType(URI.isUri(resource));

	const registry = accessor.get(ILanguageFeaturesService).selectionRangeProvider;
	const reference = await accessor.get(ITextModelService).createModelReference(resource);

	try {
		return provideSelectionRanges(registry, reference.object.textEditorModel, positions, { selectLeadingAndTrailingWhitespace: true, selectSubwords: true }, CancellationToken.None);
	} finally {
		reference.dispose();
	}
});
