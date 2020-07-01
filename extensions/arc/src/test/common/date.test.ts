/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { fromNow } from '../../common/date';

describe('fromNow Method Tests', function () {
	it('Future date', function (): void {
		should(fromNow(new Date().getTime() + 60000)).startWith('in');
	});

	it('Now', function (): void {
		should(fromNow(new Date())).equal('now');
	});

	it('< 1 min ago', function (): void {
		// 30 sec
		should(fromNow(new Date().getTime() - 30000)).endWith('secs');
		should(fromNow(new Date().getTime() - 30000, true)).endWith('secs ago');
	});

	it('< 1 hr ago', function (): void {
		// 1.5 min
		should(fromNow(new Date().getTime() - 90 * 1000)).endWith('min');
		should(fromNow(new Date().getTime() - 90 * 1000, true)).endWith('min ago');

		// 5 min
		should(fromNow(new Date().getTime() - 5 * 60 * 1000)).endWith('mins');
		should(fromNow(new Date().getTime() - 5 * 60 * 1000, true)).endWith('mins ago');
	});

	it('< 1 day ago', function (): void {
		// 1.5 hrs
		should(fromNow(new Date().getTime() - 90 * 60 * 1000)).endWith('hr');
		should(fromNow(new Date().getTime() - 90 * 60 * 1000, true)).endWith('hr ago');

		// 5 hrs
		should(fromNow(new Date().getTime() -  5 * 60 * 60 * 1000)).endWith('hrs');
		should(fromNow(new Date().getTime() - 5 * 60 * 60 * 1000, true)).endWith('hrs ago');
	});

	it('< 1 week ago', function (): void {
		// 30 hours
		should(fromNow(new Date().getTime() - 30 * 60 * 60 * 1000)).endWith('day');
		should(fromNow(new Date().getTime() - 30 * 60 * 60 * 1000, true)).endWith('day ago');

		// 3 days
		should(fromNow(new Date().getTime() -  3 * 24 * 60 * 60 * 1000)).endWith('days');
		should(fromNow(new Date().getTime() - 3 * 24 * 60 * 60 * 1000, true)).endWith('days ago');
	});

	it('< 1 month ago', function (): void {
		// 10 days
		should(fromNow(new Date().getTime() - 10 * 24 * 60 * 60 * 1000)).endWith('wk');
		should(fromNow(new Date().getTime() - 10 * 24 * 60 * 60 * 1000, true)).endWith('wk ago');

		// 20 days
		should(fromNow(new Date().getTime() -  20 * 24 * 60 * 60 * 1000)).endWith('wks');
		should(fromNow(new Date().getTime() - 20 * 24 * 60 * 60 * 1000, true)).endWith('wks ago');
	});

	it('< 1 year ago', function (): void {
		// 45 days
		should(fromNow(new Date().getTime() - 45 * 24 * 60 * 60 * 1000)).endWith('mo');
		should(fromNow(new Date().getTime() - 45 * 24 * 60 * 60 * 1000, true)).endWith('mo ago');

		// 90 days
		should(fromNow(new Date().getTime() -  90 * 24 * 60 * 60 * 1000)).endWith('mos');
		should(fromNow(new Date().getTime() - 90 * 24 * 60 * 60 * 1000, true)).endWith('mos ago');
	});

	it('> 1 year ago', function (): void {
		// 400 days
		should(fromNow(new Date().getTime() - 400 * 24 * 60 * 60 * 1000)).endWith('yr');
		should(fromNow(new Date().getTime() - 400 * 24 * 60 * 60 * 1000, true)).endWith('yr ago');

		// 1000
		should(fromNow(new Date().getTime() -  1000 * 24 * 60 * 60 * 1000)).endWith('yrs');
		should(fromNow(new Date().getTime() - 1000 * 24 * 60 * 60 * 1000, true)).endWith('yrs ago');
	});

});
