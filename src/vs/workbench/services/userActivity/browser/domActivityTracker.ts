/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { IntervalTimer } from 'vs/base/common/async';
import { Disposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { IUserActivityService } from 'vs/workbench/services/userActivity/common/userActivityService';

/**
 * This uses a time interval and checks whether there's any activity in that
 * interval. A naive approach might be to use a debounce whenever an event
 * happens, but this has some scheduling overhead. Instead, the tracker counts
 * how many intervals have elapsed since any activity happened.
 *
 * If there's more than `MIN_INTERVALS_WITHOUT_ACTIVITY`, then say the user is
 * inactive. Therefore the maximum time before an inactive user is detected
 * is `CHECK_INTERVAL * (MIN_INTERVALS_WITHOUT_ACTIVITY + 1)`.
 */
const CHECK_INTERVAL = 30_000;

/** See {@link CHECK_INTERVAL} */
const MIN_INTERVALS_WITHOUT_ACTIVITY = 2;

const eventListenerOptions: AddEventListenerOptions = {
	passive: true, /** does not preventDefault() */
	capture: true, /** should dispatch first (before anyone stopPropagation()) */
};

export class DomActivityTracker extends Disposable {
	constructor(userActivityService: IUserActivityService) {
		super();

		let intervalsWithoutActivity = MIN_INTERVALS_WITHOUT_ACTIVITY;
		const intervalTimer = this._register(new IntervalTimer());
		const activeMutex = this._register(new MutableDisposable());
		activeMutex.value = userActivityService.markActive();

		const onInterval = () => {
			if (++intervalsWithoutActivity === MIN_INTERVALS_WITHOUT_ACTIVITY) {
				activeMutex.clear();
				intervalTimer.cancel();
			}
		};

		const onActivity = () => {
			// if was inactive, they've now returned
			if (intervalsWithoutActivity === MIN_INTERVALS_WITHOUT_ACTIVITY) {
				activeMutex.value = userActivityService.markActive();
				intervalTimer.cancelAndSet(onInterval, CHECK_INTERVAL);
			}

			intervalsWithoutActivity = 0;
		};

		this._register(dom.addDisposableListener(document, 'touchstart', onActivity, eventListenerOptions));
		this._register(dom.addDisposableListener(document, 'mousedown', onActivity, eventListenerOptions));
		this._register(dom.addDisposableListener(document, 'keydown', onActivity, eventListenerOptions));

		onActivity();
	}
}
