/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { findLast } from 'vs/base/common/arrays';
import { derived, derivedObservableWithWritableCache, IReader, ITransaction, observableValue, transaction } from 'vs/base/common/observable';
import { ScrollType } from 'vs/editor/common/editorCommon';
import { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';
import { MergeEditorModel } from 'vs/workbench/contrib/mergeEditor/browser/model/mergeEditorModel';
import { ModifiedBaseRange, ModifiedBaseRangeState } from 'vs/workbench/contrib/mergeEditor/browser/model/modifiedBaseRange';
import { CodeEditorView } from 'vs/workbench/contrib/mergeEditor/browser/view/editors/codeEditorView';
import { InputCodeEditorView } from 'vs/workbench/contrib/mergeEditor/browser/view/editors/inputCodeEditorView';
import { ResultCodeEditorView } from 'vs/workbench/contrib/mergeEditor/browser/view/editors/resultCodeEditorView';

export class MergeEditorViewModel {
	private readonly lastFocusedEditor = derivedObservableWithWritableCache<
		CodeEditorView | undefined
	>('lastFocusedEditor', (reader, lastValue) => {
		const editors = [
			this.inputCodeEditorView1,
			this.inputCodeEditorView2,
			this.resultCodeEditorView,
		];
		return editors.find((e) => e.isFocused.read(reader)) || lastValue;
	});

	private readonly manuallySetActiveModifiedBaseRange = observableValue<
		ModifiedBaseRange | undefined
	>('manuallySetActiveModifiedBaseRange', undefined);

	private getRange(editor: CodeEditorView, modifiedBaseRange: ModifiedBaseRange, reader: IReader | undefined): LineRange {
		if (editor === this.resultCodeEditorView) {
			return this.model.getRangeInResult(modifiedBaseRange.baseRange, reader);
		} else {
			const input = editor === this.inputCodeEditorView1 ? 1 : 2;
			return modifiedBaseRange.getInputRange(input);
		}
	}

	public readonly activeModifiedBaseRange = derived(
		'activeModifiedBaseRange',
		(reader) => {
			const focusedEditor = this.lastFocusedEditor.read(reader);
			if (!focusedEditor) {
				return this.manuallySetActiveModifiedBaseRange.read(reader);
			}
			const cursorLineNumber = focusedEditor.cursorLineNumber.read(reader);
			if (!cursorLineNumber) {
				return undefined;
			}

			const modifiedBaseRanges = this.model.modifiedBaseRanges.read(reader);
			return modifiedBaseRanges.find((r) => {
				const range = this.getRange(focusedEditor, r, reader);
				return range.isEmpty
					? range.startLineNumber === cursorLineNumber
					: range.contains(cursorLineNumber);
			});
		}
	);

	constructor(
		public readonly model: MergeEditorModel,
		private readonly inputCodeEditorView1: InputCodeEditorView,
		private readonly inputCodeEditorView2: InputCodeEditorView,
		private readonly resultCodeEditorView: ResultCodeEditorView
	) { }

	public setState(
		baseRange: ModifiedBaseRange,
		state: ModifiedBaseRangeState,
		tx: ITransaction
	): void {
		this.manuallySetActiveModifiedBaseRange.set(baseRange, tx);
		this.lastFocusedEditor.clearCache(tx);
		this.model.setState(baseRange, state, true, tx);
	}

	private goToConflict(getModifiedBaseRange: (editor: CodeEditorView, curLineNumber: number) => ModifiedBaseRange | undefined): void {
		const lastFocusedEditor = this.lastFocusedEditor.get();
		if (!lastFocusedEditor) {
			return;
		}
		const curLineNumber = lastFocusedEditor.editor.getPosition()?.lineNumber;
		if (curLineNumber === undefined) {
			return;
		}
		const modifiedBaseRange = getModifiedBaseRange(lastFocusedEditor, curLineNumber);
		if (modifiedBaseRange) {
			const range = this.getRange(lastFocusedEditor, modifiedBaseRange, undefined);
			lastFocusedEditor.editor.setPosition({
				lineNumber: range.startLineNumber,
				column: lastFocusedEditor.editor.getModel()!.getLineFirstNonWhitespaceColumn(range.startLineNumber),
			});
			lastFocusedEditor.editor.revealLinesNearTop(range.startLineNumber, range.endLineNumberExclusive, ScrollType.Smooth);
		}
	}

	public goToNextModifiedBaseRange(onlyConflicting: boolean): void {
		this.goToConflict(
			(e, l) =>
				this.model.modifiedBaseRanges
					.get()
					.find(
						(r) =>
							(!onlyConflicting || r.isConflicting) &&
							this.getRange(e, r, undefined).startLineNumber > l
					) ||
				this.model.modifiedBaseRanges
					.get()
					.find((r) => !onlyConflicting || r.isConflicting)
		);
	}

	public goToPreviousModifiedBaseRange(onlyConflicting: boolean): void {
		this.goToConflict(
			(e, l) =>
				findLast(
					this.model.modifiedBaseRanges.get(),
					(r) =>
						(!onlyConflicting || r.isConflicting) &&
						this.getRange(e, r, undefined).endLineNumberExclusive < l
				) ||
				findLast(
					this.model.modifiedBaseRanges.get(),
					(r) => !onlyConflicting || r.isConflicting
				)
		);
	}

	public toggleActiveConflict(inputNumber: 1 | 2): void {
		const activeModifiedBaseRange = this.activeModifiedBaseRange.get();
		if (!activeModifiedBaseRange) {
			return;
		}
		transaction(tx => {
			/** @description Toggle Active Conflict */
			this.setState(
				activeModifiedBaseRange,
				this.model.getState(activeModifiedBaseRange).get().toggle(inputNumber),
				tx
			);
		});
	}

	public acceptAll(inputNumber: 1 | 2): void {
		transaction(tx => {
			/** @description Toggle Active Conflict */
			for (const range of this.model.modifiedBaseRanges.get()) {
				this.setState(
					range,
					this.model.getState(range).get().withInputValue(inputNumber, true),
					tx
				);
			}
		});
	}
}
