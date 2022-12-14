/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DECORATIONS } from 'vs/editor/browser/widget/diffEditorWidget';
import { IModelDeltaDecoration } from 'vs/editor/common/model';
import { OverviewRulerZone } from 'vs/editor/common/viewModel/overviewZoneManager';

/**
 * Reverses the decorations of the given array of decorations, so that deletes and inserts are swapped
 * @param decorations
 */
export function reverseDecorations(decorations: IModelDeltaDecoration[]): void {
	for (let dec of decorations) {
		switch (dec.options.description) {
			case 'diff-editor-char-delete': {
				dec.options = DECORATIONS.charInsert;
				break;
			}
			case 'diff-editor-char-delete-whole-line': {
				dec.options = DECORATIONS.charInsertWholeLine;
				break;
			}
			case 'diff-editor-char-insert': {
				dec.options = DECORATIONS.charDelete;
				break;
			}
			case 'diff-editor-char-insert-whole-line': {
				dec.options = DECORATIONS.charDeleteWholeLine;
				break;
			}
			case 'diff-editor-line-insert': {
				dec.options = DECORATIONS.lineDelete;
				break;
			}
			case 'diff-editor-line-insert-with-sign': {
				dec.options = DECORATIONS.lineDeleteWithSign;
				break;
			}
			case 'diff-editor-line-delete': {
				dec.options = DECORATIONS.lineInsert;
				break;
			}
			case 'diff-editor-line-delete-with-sign': {
				dec.options = DECORATIONS.lineInsertWithSign;
				break;
			}
		}
	}
}

/**
 * Sets the overview zones to the provided color
 * @param zones Array of zones to update
 * @param color Color to set the overview zones to
 * @returns
 */
export function setOverviewZonesColor(zones: OverviewRulerZone[], color: string): OverviewRulerZone[] {
	let reversedZones = [];

	for (const zone of zones) {
		// There color of an overview zone is readonly, so create a new one with the updated color
		reversedZones.push(new OverviewRulerZone(zone.startLineNumber, zone.endLineNumber, zone.heightInLines, color));
	}

	return reversedZones;
}
