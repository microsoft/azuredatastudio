/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Emitter, Event } from 'vs/base/common/event';

/**
 * Implementation of vs/base/common/event/echo that is clearable
 * Similar to `buffer` but it buffers indefinitely and repeats
 * the buffered events to every new listener.
 */
export function echo<T>(event: Event<T>, nextTick = false, buffer: T[] = []): { clear: () => void; event: Event<T> } {
	buffer = buffer.slice();

	event(e => {
		buffer.push(e);
		emitter.fire(e);
	});

	const flush = (listener: (e: T) => any, thisArgs?: any) => buffer.forEach(e => listener.call(thisArgs, e));
	const clear = () => buffer = [];

	const emitter = new Emitter<T>({
		onListenerDidAdd(emitter, listener: (e: T) => any, thisArgs?: any) {
			if (nextTick) {
				setTimeout(() => flush(listener, thisArgs));
			} else {
				flush(listener, thisArgs);
			}
		}
	});

	return {
		event: emitter.event,
		clear
	};
}
