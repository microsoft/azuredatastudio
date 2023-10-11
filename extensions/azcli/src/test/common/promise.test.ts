/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { Deferred } from '../../common/promise';

describe('DeferredPromise', function (): void {

	it('Resolves correctly', async function(): Promise<void> {
		const deferred = new Deferred();
		deferred.resolve();
		await should(deferred.promise).be.resolved();
	});

	it('Rejects correctly', async function(): Promise<void> {
		const deferred = new Deferred();
		deferred.reject();
		await should(deferred.promise).be.rejected();
	});

	it('Chains then correctly', function(done): void {
		const deferred = new Deferred();
		deferred.then( () => {
			done();
		});
		deferred.resolve();
	});
});
