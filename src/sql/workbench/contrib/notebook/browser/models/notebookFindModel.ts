/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IModelDecorationsChangeAccessor } from 'vs/editor/common/model';
import { NotebookFindMatch } from 'sql/workbench/contrib/notebook/browser/find/notebookFindDecorations';
import { NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';

export interface INotebookFindModel {
	/** Get the find count */
	getFindCount(): number;
	/** Get the find index */
	getFindIndex(): number;
	/** find the next match */
	findNext(): Promise<NotebookRange>;
	/** find the previous match */
	findPrevious(): Promise<NotebookRange>;
	/** search the notebook model for the given exp up to maxMatch occurrences */
	find(exp: string, matchCase?: boolean, wholeWord?: boolean, maxMatches?: number): Promise<NotebookRange>;
	/** clear the results of the find */
	clearFind(): void;
	/** return the find results with their ranges */
	findArray: NotebookRange[];
	/**
	 * Get the range associated with a decoration.
	 * @param id The decoration id.
	 * @return The decoration range or null if the decoration was not found.
	 */
	getDecorationRange(id: string): NotebookRange | null;
	/**
	 * Get the range associated with a decoration.
	 * @param callback that accepts changeAccessor which applies the decorations
	 * @param ownerId the owner id
	 * @return The decoration range or null if the decoration was not found.
	 */
	changeDecorations<T>(callback: (changeAccessor: IModelDecorationsChangeAccessor) => T, ownerId: number): T | null;
	/**
	 * Get the maximum legal column for line at `lineNumber`
	 */
	getLineMaxColumn(lineNumber: number): number;
	/**
	 * Get the number of lines in the model.
	 */
	getLineCount(): number;
	findMatches: NotebookFindMatch[];
	findExpression: string;
	/** Emit event when the find count changes */
	onFindCountChange: Event<number>;
	/** Get the find index when range is given*/
	getIndexByRange(range: NotebookRange): number;
}
