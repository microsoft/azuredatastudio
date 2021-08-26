/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';
import { IModelDecorationsChangeAccessor, IModelDeltaDecoration, OverviewRulerLane, TrackedRangeStickiness, MinimapPosition, FindMatch } from 'vs/editor/common/model';
import { ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { overviewRulerFindMatchForeground, minimapFindMatch } from 'vs/platform/theme/common/colorRegistry';
import { themeColorFromId } from 'vs/platform/theme/common/themeService';
import { NotebookEditor } from 'sql/workbench/contrib/notebook/browser/notebookEditor';
import { Range } from 'vs/editor/common/core/range';
import { ScrollType } from 'vs/editor/common/editorCommon';
import { NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';

export class NotebookFindDecorations implements IDisposable {

	private _decorations: string[] = [];
	private _overviewRulerApproximateDecorations: string[] = [];
	private _findScopeDecorationIds: string[] = [];
	private _codeCellFindScopeDecorationIds: string[] = [];
	private _rangeHighlightDecorationId: string | null = null;
	private _highlightedDecorationId: string | null = null;
	private _startPosition: NotebookRange;
	private _currentMatch: NotebookRange;
	private _codeCellDecorations: Map<string, string[]> = new Map<string, string[]>();

	constructor(private readonly _editor: NotebookEditor) {
		this._startPosition = this._editor.getPosition();
	}

	public dispose(): void {
		this._editor.deltaDecorations(this._allDecorations(), []);

		this._decorations = [];
		this._overviewRulerApproximateDecorations = [];
		this._findScopeDecorationIds = [];
		this._codeCellDecorations = new Map<string, string[]>();
		this._codeCellFindScopeDecorationIds = [];
		this._rangeHighlightDecorationId = null;
		this._highlightedDecorationId = null;
	}

	public reset(): void {
		this._decorations = [];
		this._overviewRulerApproximateDecorations = [];
		this._findScopeDecorationIds = [];
		this._codeCellDecorations = new Map<string, string[]>();
		this._codeCellFindScopeDecorationIds = [];
		this._rangeHighlightDecorationId = null;
		this._highlightedDecorationId = null;
	}

	public getCount(): number {
		return this._decorations.length;
	}

	public getFindScope(): NotebookRange | null {
		if (this._currentMatch) {
			return this._currentMatch;
		}
		return null;
	}

	public getFindScopes(): NotebookRange[] | null {
		if (this._findScopeDecorationIds.length) {
			const scopes = this._findScopeDecorationIds.map(findScopeDecorationId =>
				this._editor.notebookFindModel.getDecorationRange(findScopeDecorationId)
			).filter(element => !!element);
			if (scopes.length) {
				return scopes as NotebookRange[];
			}
		}
		return null;
	}

	public getStartPosition(): NotebookRange {
		return this._startPosition;
	}

	public setStartPosition(newStartPosition: NotebookRange): void {
		if (newStartPosition) {
			this._startPosition = newStartPosition;
			this.setCurrentFindMatch(this._startPosition);
		}
	}

	public clearDecorations(): void {
		// clear markdown decorations
		let ranges = this.getFindScopes();
		if (ranges) {
			this._editor.updateDecorations(undefined, ranges);
		}
		// clear code cell decorations
		for (let cellGuid of this._codeCellDecorations.keys()) {
			this._editor.getCellEditor(cellGuid).getControl().changeDecorations((changeAccessor: IModelDecorationsChangeAccessor) => {
				this._codeCellDecorations.get(cellGuid).forEach(decorationId => changeAccessor.removeDecoration(decorationId));
				changeAccessor.deltaDecorations(this._codeCellFindScopeDecorationIds, []);
			});
		}
		// remove the current highlight
		this.removeLastDecoration();
	}

	public addDecorations(): void {
		let findScopes = this.getFindScopes();
		if (findScopes) {
			// add markdown decorations
			this._editor.updateDecorations(findScopes, undefined);
			// add code cell decorations
			this.setCodeCellDecorations(this._editor.notebookFindModel.findMatches, findScopes);
		}

	}

	public setCurrentFindMatch(nextMatch: NotebookRange | null): number {
		let newCurrentDecorationId: string | null = null;
		let matchPosition = 0;
		if (nextMatch) {
			for (let i = 0, len = this._decorations.length; i < len; i++) {
				let range = this._editor.notebookFindModel.getDecorationRange(this._decorations[i]);
				if (nextMatch.equalsRange(range)) {
					newCurrentDecorationId = this._decorations[i];
					matchPosition = (i + 1);
					break;
				}
			}
		}

		if (this._highlightedDecorationId !== null || newCurrentDecorationId !== null) {
			this.removeLastDecoration();
			if (this.checkValidEditor(nextMatch)) {
				this._editor.getCellEditor(nextMatch.cell.cellGuid).getControl().changeDecorations((changeAccessor: IModelDecorationsChangeAccessor) => {
					if (this._highlightedDecorationId !== null) {
						changeAccessor.changeDecorationOptions(this._highlightedDecorationId, NotebookFindDecorations._RANGE_HIGHLIGHT_DECORATION);
						this._highlightedDecorationId = null;
					}
					if (newCurrentDecorationId !== null) {
						this._highlightedDecorationId = newCurrentDecorationId;
						changeAccessor.changeDecorationOptions(this._highlightedDecorationId, NotebookFindDecorations._CURRENT_FIND_MATCH_DECORATION);
					}

					if (newCurrentDecorationId !== null) {
						let rng = this._editor.notebookFindModel.getDecorationRange(newCurrentDecorationId)!;
						if (rng.startLineNumber !== rng.endLineNumber && rng.endColumn === 1) {
							let lineBeforeEnd = rng.endLineNumber - 1;
							let lineBeforeEndMaxColumn = this._editor.notebookFindModel.getLineMaxColumn(lineBeforeEnd);
							rng = new NotebookRange(rng.cell, rng.startLineNumber, rng.startColumn, lineBeforeEnd, lineBeforeEndMaxColumn);
						}
						this._rangeHighlightDecorationId = changeAccessor.addDecoration(rng, NotebookFindDecorations._FIND_MATCH_DECORATION);
						this._revealRangeInCenterIfOutsideViewport(nextMatch);
						this._currentMatch = nextMatch;
					}
				});
			}
			else {
				this._editor.updateDecorations(nextMatch, undefined);
				this._currentMatch = nextMatch;
			}
		}

		return matchPosition;
	}

	private removeLastDecoration(): void {
		if (this._currentMatch && this._currentMatch.cell) {
			let prevEditor = this._currentMatch.cell.cellType === 'markdown' && !this._currentMatch.isMarkdownSourceCell ? undefined : this._editor.getCellEditor(this._currentMatch.cell.cellGuid);
			if (prevEditor) {
				prevEditor.getControl().changeDecorations((changeAccessor: IModelDecorationsChangeAccessor) => {
					changeAccessor.removeDecoration(this._rangeHighlightDecorationId);
					this._rangeHighlightDecorationId = null;
				});
			} else {
				if (this._currentMatch.cell.cellType === 'markdown') {
					this._editor.updateDecorations(undefined, this._currentMatch);
				}
			}
		}
	}

	private _revealRangeInCenterIfOutsideViewport(match: NotebookRange): void {
		let matchEditor = this._editor.getCellEditor(match.cell.cellGuid);
		// expand the cell if it's collapsed and scroll into view
		match.cell.isCollapsed = false;
		if (matchEditor) {
			matchEditor.getContainer().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			matchEditor.getControl().revealRangeInCenterIfOutsideViewport(match, ScrollType.Smooth);
		}
	}

	public checkValidEditor(range: NotebookRange): boolean {
		return range && range.cell && !!(this._editor.getCellEditor(range.cell.cellGuid)) && (range.cell.cellType === 'code' || range.isMarkdownSourceCell);
	}

	public set(findMatches: NotebookFindMatch[], findScopes: NotebookRange[] | null): void {
		if (findScopes) {
			this._editor.updateDecorations(findScopes, undefined);

			this._editor.changeDecorations((accessor) => {
				let findMatchesOptions = NotebookFindDecorations._FIND_MATCH_NO_OVERVIEW_DECORATION;
				// Find matches
				let newFindMatchesDecorations: IModelDeltaDecoration[] = new Array<IModelDeltaDecoration>(findMatches.length);
				for (let i = 0, len = findMatches.length; i < len; i++) {
					newFindMatchesDecorations[i] = {
						range: findMatches[i].range,
						options: findMatchesOptions
					};
				}
				this._decorations = accessor.deltaDecorations(this._decorations, newFindMatchesDecorations);

				// Find scope
				if (this._findScopeDecorationIds.length) {
					this._findScopeDecorationIds.forEach(findScopeDecorationId => accessor.removeDecoration(findScopeDecorationId));
					this._findScopeDecorationIds = [];
				}
				if (findScopes.length) {
					this._findScopeDecorationIds = findScopes.map(findScope => accessor.addDecoration(findScope, NotebookFindDecorations._FIND_SCOPE_DECORATION));
				}
			});

			this.setCodeCellDecorations(findMatches, findScopes);
		}
	}

	private setCodeCellDecorations(findMatches: NotebookFindMatch[], findScopes: NotebookRange[] | null): void {
		//get all code cells which have matches
		const codeCellsFindMatches = findScopes.filter((c, i, ranges) => {
			return ranges.indexOf(ranges.find(t => t.cell.cellGuid === c.cell.cellGuid && t.cell.cellType === 'code')) === i;
		});
		codeCellsFindMatches.forEach(findMatch => {
			this._editor.getCellEditor(findMatch.cell.cellGuid)?.getControl().changeDecorations((accessor) => {

				let findMatchesOptions: ModelDecorationOptions = NotebookFindDecorations._RANGE_HIGHLIGHT_DECORATION;
				let newOverviewRulerApproximateDecorations: IModelDeltaDecoration[] = [];

				let cellFindScopes = findScopes.filter(f => f.cell.cellGuid === findMatch.cell.cellGuid);
				let findMatchesInCell = findMatches?.filter(m => m.range.cell.cellGuid === findMatch.cell.cellGuid) || [];
				let _cellFindScopeDecorationIds: string[] = [];
				if (findMatchesInCell.length > 1000) {
					// we go into a mode where the overview ruler gets "approximate" decorations
					// the reason is that the overview ruler paints all the decorations in the file and we don't want to cause freezes
					findMatchesOptions = NotebookFindDecorations._FIND_MATCH_NO_OVERVIEW_DECORATION;

					// approximate a distance in lines where matches should be merged
					const lineCount = this._editor.notebookFindModel.getLineCount();
					const height = this._editor.getConfiguration().layoutInfo.height;
					const approxPixelsPerLine = height / lineCount;
					const mergeLinesDelta = Math.max(2, Math.ceil(3 / approxPixelsPerLine));

					// merge decorations as much as possible
					let prevStartLineNumber = findMatchesInCell[0].range.startLineNumber;
					let prevEndLineNumber = findMatchesInCell[0].range.endLineNumber;
					for (let i = 1, len = findMatchesInCell.length; i < len; i++) {
						const range = findMatchesInCell[i].range;
						if (prevEndLineNumber + mergeLinesDelta >= range.startLineNumber) {
							if (range.endLineNumber > prevEndLineNumber) {
								prevEndLineNumber = range.endLineNumber;
							}
						} else {
							newOverviewRulerApproximateDecorations.push({
								range: new Range(prevStartLineNumber, 1, prevEndLineNumber, 1),
								options: NotebookFindDecorations._FIND_MATCH_ONLY_OVERVIEW_DECORATION
							});
							prevStartLineNumber = range.startLineNumber;
							prevEndLineNumber = range.endLineNumber;
						}
					}

					newOverviewRulerApproximateDecorations.push({
						range: new Range(prevStartLineNumber, 1, prevEndLineNumber, 1),
						options: NotebookFindDecorations._FIND_MATCH_ONLY_OVERVIEW_DECORATION
					});
				}

				// Find matches
				let newFindMatchesDecorations: IModelDeltaDecoration[] = new Array<IModelDeltaDecoration>(findMatchesInCell.length);
				for (let i = 0, len = findMatchesInCell.length; i < len; i++) {
					newFindMatchesDecorations[i] = {
						range: findMatchesInCell[i].range,
						options: findMatchesOptions
					};
				}
				let decorations = accessor.deltaDecorations(this._decorations, newFindMatchesDecorations);
				this._codeCellDecorations.set(findMatch.cell.cellGuid, decorations);
				// Overview ruler approximate decorations
				this._overviewRulerApproximateDecorations = accessor.deltaDecorations(this._overviewRulerApproximateDecorations, newOverviewRulerApproximateDecorations);

				// Range highlight
				if (this._rangeHighlightDecorationId) {
					accessor.removeDecoration(this._rangeHighlightDecorationId);
					this._rangeHighlightDecorationId = null;
				}

				// Find scope
				if (_cellFindScopeDecorationIds.length) {
					_cellFindScopeDecorationIds.forEach(findScopeDecorationId => accessor.removeDecoration(findScopeDecorationId));
					_cellFindScopeDecorationIds = [];
				}
				if (cellFindScopes.length) {
					_cellFindScopeDecorationIds = cellFindScopes.map(findScope => accessor.addDecoration(findScope, NotebookFindDecorations._FIND_SCOPE_DECORATION));
					this._codeCellFindScopeDecorationIds.push(..._cellFindScopeDecorationIds);
				}
			});
		});
	}

	private _allDecorations(): string[] {
		let result: string[] = [];
		result = result.concat(this._decorations);
		result = result.concat(this._overviewRulerApproximateDecorations);
		if (this._findScopeDecorationIds.length) {
			result.push(...this._findScopeDecorationIds);
		}
		if (this._rangeHighlightDecorationId) {
			result.push(this._rangeHighlightDecorationId);
		}
		return result;
	}

	private static readonly _CURRENT_FIND_MATCH_DECORATION = ModelDecorationOptions.register({
		description: 'CURRENT_FIND_MATCH_DECORATION',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		zIndex: 13,
		className: 'currentFindMatch',
		showIfCollapsed: true,
		overviewRuler: {
			color: themeColorFromId(overviewRulerFindMatchForeground),
			position: OverviewRulerLane.Center
		},
		minimap: {
			color: themeColorFromId(minimapFindMatch),
			position: MinimapPosition.Inline
		}
	});

	private static readonly _FIND_MATCH_DECORATION = ModelDecorationOptions.register({
		description: 'FIND_MATCH_DECORATION',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		className: 'findMatch',
		showIfCollapsed: true,
		overviewRuler: {
			color: themeColorFromId(overviewRulerFindMatchForeground),
			position: OverviewRulerLane.Center
		},
		minimap: {
			color: themeColorFromId(minimapFindMatch),
			position: MinimapPosition.Inline
		}
	});

	private static readonly _FIND_MATCH_NO_OVERVIEW_DECORATION = ModelDecorationOptions.register({
		description: 'FIND_MATCH_NO_OVERVIEW_DECORATION',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		className: 'findMatch',
		showIfCollapsed: true
	});

	private static readonly _FIND_MATCH_ONLY_OVERVIEW_DECORATION = ModelDecorationOptions.register({
		description: 'FIND_MATCH_ONLY_OVERVIEW_DECORATION',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		overviewRuler: {
			color: themeColorFromId(overviewRulerFindMatchForeground),
			position: OverviewRulerLane.Center
		}
	});

	private static readonly _RANGE_HIGHLIGHT_DECORATION = ModelDecorationOptions.register({
		description: 'RANGE_HIGHLIGHT_DECORATION',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		className: 'rangeHighlight',
		isWholeLine: false
	});

	private static readonly _FIND_SCOPE_DECORATION = ModelDecorationOptions.register({
		description: 'FIND_SCOPE_DECORATION',
		className: 'findScope',
		isWholeLine: true
	});
}

export class NotebookFindMatch extends FindMatch {

	public override readonly range: NotebookRange;

	/**
	 * @internal
	 */
	constructor(range: NotebookRange, matches: string[] | null) {
		super(new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn), matches);
		this.range = range;
	}
}
