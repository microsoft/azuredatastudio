/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'mocha';
import { Deferred } from '../../common/promise';

describe('Deferred', () => {
	it('Then should be called upon resolution', function (done): void {
		const deferred = new Deferred();
		deferred.then(() => {
			done();
		});
		deferred.resolve();
	});
});
