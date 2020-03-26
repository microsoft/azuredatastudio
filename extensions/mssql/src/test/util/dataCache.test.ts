/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataItemCache } from '../../util/dataCache';
import 'mocha';
import { should } from 'chai'; should();
import * as sinon from 'sinon';

describe('DataItemCache', function (): void {

	const testCacheItem = 'Test Cache Item';
	let fetchFunction: sinon.SinonSpy;
	let dataItemCache: DataItemCache<String>;

	beforeEach(function (): void {
		fetchFunction = sinon.spy(() => Promise.resolve(testCacheItem))
		dataItemCache = new DataItemCache<string>(fetchFunction, 1);
	});

	it('Should be initialized empty', function (): void {
		dataItemCache.should.have.property('cachedItem').and.be.undefined;
	});

	it('Should be initialized as expired', function (): void {
		dataItemCache.isCacheExpired().should.be.true;
	});

	it('Should not be expired immediately after first data fetch', async function (): Promise<void> {
		await dataItemCache.getData();

		dataItemCache.isCacheExpired().should.be.false;
	});

	it('Should return expected cached item from getValue()', async function (): Promise<void> {
		let actualValue = await dataItemCache.getData();

		actualValue.should.equal(testCacheItem);
	});

	it('Should be expired after data is fetched and TTL passes', async function (): Promise<void> {
		await dataItemCache.getData();
		await sleep(1.1);

		dataItemCache.isCacheExpired().should.be.true;
	});

	it('Should call fetch function once for consecutive getValue() calls prior to expiration', async function (): Promise<void> {
		await dataItemCache.getData();
		await dataItemCache.getData();
		await dataItemCache.getData();

		fetchFunction.calledOnce.should.be.true;
	});

	it('Should call fetch function twice for consecutive getValue() calls if TTL expires in between', async function (): Promise<void> {
		await dataItemCache.getData();
		await sleep(1.1);
		await dataItemCache.getData();

		fetchFunction.calledTwice.should.be.true;
	});
});

const sleep = (seconds: number) => {
	return new Promise(resolve => setTimeout(resolve, 1000 * seconds))
}
