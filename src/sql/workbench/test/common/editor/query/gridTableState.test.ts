/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import * as assert from 'assert';
import { isUndefined } from 'vs/base/common/types';
import { Event } from 'vs/base/common/event';

suite('Grid Table State', () => {
	test('inital state is correct', () => {
		const resultId = 0;
		const batchId = 0;
		const state = new GridTableState(resultId, batchId);

		assert.equal(state.resultId, resultId);
		assert.equal(state.batchId, batchId);
		assert(isUndefined(state.canBeMaximized));
		assert(isUndefined(state.maximized));
		assert.equal(state.scrollPositionX, 0);
		assert.equal(state.scrollPositionY, 0);
		assert(isUndefined(state.columnSizes));
		assert(isUndefined(state.selection));
		assert(isUndefined(state.activeCell));
	});

	test('does set properties correctly', async () => {
		const state = new GridTableState(0, 0);
		let event = await new Promise<boolean>(resolve => {
			Event.once(state.onCanBeMaximizedChange)(e => resolve(e));
			state.canBeMaximized = true;
		});

		assert.equal(event, true);
		assert.equal(state.canBeMaximized, true);

		event = await new Promise<boolean>(resolve => {
			Event.once(state.onCanBeMaximizedChange)(e => resolve(e));
			state.canBeMaximized = false;
		});

		assert.equal(event, false);
		assert.equal(state.canBeMaximized, false);

		event = await new Promise<boolean>(resolve => {
			Event.once(state.onMaximizedChange)(e => resolve(e));
			state.maximized = true;
		});

		assert.equal(event, true);
		assert.equal(state.maximized, true);

		event = await new Promise<boolean>(resolve => {
			Event.once(state.onMaximizedChange)(e => resolve(e));
			state.maximized = false;
		});

		assert.equal(event, false);
		assert.equal(state.maximized, false);
	});
});
