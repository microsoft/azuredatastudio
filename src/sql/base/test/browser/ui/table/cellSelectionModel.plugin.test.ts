/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';

let cellSelectionModel: CellSelectionModel<any> = new CellSelectionModel();
suite('Cell Selection Model Tests', () => {
	test('Merge Selections Test - Empty with single', () => {
		let initialSelection = new Array<Slick.Range>();
		let addedRange = new Slick.Range(3, 4);
		let result = cellSelectionModel.insertIntoSelections(initialSelection, addedRange);

		assert.equal(result[0], addedRange, 'Empty selection should contain a single selection after getting inserted and merged');
	});
	test('Merge Selections Test - Empty with single', () => {
		let initialSelection = new Array<Slick.Range>();
		let addedRange = new Slick.Range(3, 4);
		let result = cellSelectionModel.insertIntoSelections(initialSelection, addedRange);

		assert.equal(result[0], addedRange, 'Empty selection should contain a single selection after getting inserted and merged');
	});
});
