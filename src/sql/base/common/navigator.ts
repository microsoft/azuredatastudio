/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INavigator as vsINavigator } from 'vs/base/common/navigator';

export interface INavigator<T> extends vsINavigator<T> {
	parent(): T | null;
}

export class MappedNavigator<T, R> implements INavigator<R> {

	constructor(protected navigator: INavigator<T>, private fn: (item: T | null) => R) {
	}

	current() { return this.fn(this.navigator.current()); }
	previous() { return this.fn(this.navigator.previous()); }
	first() { return this.fn(this.navigator.first()); }
	last() { return this.fn(this.navigator.last()); }
	next() { return this.fn(this.navigator.next()); }
	parent() { return this.fn(this.navigator.parent()); }
}
