/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { DomActivityTracker } from 'vs/workbench/services/userActivity/browser/domActivityTracker';
import { UserActivityService } from 'vs/workbench/services/userActivity/common/userActivityService';
import * as sinon from 'sinon';
import * as assert from 'assert';

suite('DomActivityTracker', () => {
	let uas: UserActivityService;
	let dom: DomActivityTracker;
	let clock: sinon.SinonFakeTimers;
	const maxTimeToBecomeIdle = 3 * 30_000; // (MIN_INTERVALS_WITHOUT_ACTIVITY + 1) * CHECK_INTERVAL;

	setup(() => {
		clock = sinon.useFakeTimers();
		uas = new UserActivityService(new TestInstantiationService());
		dom = new DomActivityTracker(uas);
	});

	teardown(() => {
		dom.dispose();
		uas.dispose();
		clock.restore();
	});


	test('marks inactive on no input', () => {
		assert.equal(uas.isActive, true);
		clock.tick(maxTimeToBecomeIdle);
		assert.equal(uas.isActive, false);
	});

	test('preserves activity state when active', () => {
		assert.equal(uas.isActive, true);

		const div = 10;
		for (let i = 0; i < div; i++) {
			document.dispatchEvent(new MouseEvent('keydown'));
			clock.tick(maxTimeToBecomeIdle / div);
		}

		assert.equal(uas.isActive, true);
	});

	test('restores active state', () => {
		assert.equal(uas.isActive, true);
		clock.tick(maxTimeToBecomeIdle);
		assert.equal(uas.isActive, false);

		document.dispatchEvent(new MouseEvent('keydown'));
		assert.equal(uas.isActive, true);

		clock.tick(maxTimeToBecomeIdle);
		assert.equal(uas.isActive, false);
	});
});
