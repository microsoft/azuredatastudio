/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Emitter, Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';

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

/**
 * Implementation of vs/base/common/event/debounceEvent that is clearable
 */
export function debounceEvent<T>(event: Event<T>, merger: (last: T, event: T) => T, delay?: number, leading?: boolean): { clear: () => void; event: Event<T> };
export function debounceEvent<I, O>(event: Event<I>, merger: (last: O, event: I) => O, delay?: number, leading?: boolean): { clear: () => void; event: Event<O> };
export function debounceEvent<I, O>(event: Event<I>, merger: (last: O, event: I) => O, delay: number = 100, leading = false): { clear: () => void; event: Event<O> } {

	let subscription: IDisposable;
	let output: O = undefined;
	let handle: any = undefined;
	let numDebouncedCalls = 0;

	const clear = () => output = undefined;

	const emitter = new Emitter<O>({
		onFirstListenerAdd() {
			subscription = event(cur => {
				numDebouncedCalls++;
				output = merger(output, cur);

				if (leading && !handle) {
					emitter.fire(output);
				}

				clearTimeout(handle);
				handle = setTimeout(() => {
					let _output = output;
					output = undefined;
					handle = undefined;
					if (!leading || numDebouncedCalls > 1) {
						emitter.fire(_output);
					}

					numDebouncedCalls = 0;
				}, delay);
			});
		},
		onLastListenerRemove() {
			subscription.dispose();
		}
	});

	return {
		event: emitter.event,
		clear
	};
}

