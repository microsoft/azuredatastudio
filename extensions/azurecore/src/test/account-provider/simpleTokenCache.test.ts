/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';

import { SimpleTokenCache } from '../../account-provider/simpleTokenCache';

// These tests don't work on Linux systems because gnome-keyring doesn't like running on headless machines.
describe('AccountProvider.SimpleTokenCache @UNSTABLE@ @REL@', function (): void {
	it('Can save and load credentials', async function (): Promise<void> {
		const tokenCacheKey = 'azureTokenCache-testkey';
		const tokenCachePassword = 'azureTokenCache-testpassword';
		const tokenCache = new SimpleTokenCache('testTokenService');

		const result = await tokenCache.saveCredential(tokenCacheKey, tokenCachePassword);
		should(result).not.be.true('TokenResponse not added correctly');

		const results = await tokenCache.getCredential(tokenCacheKey);
		should(results).equal(tokenCachePassword);
	});
	it('Can save and clear credentials', async function (): Promise<void> {
		const tokenCacheKey = 'azureTokenCache-testkey';
		const tokenCachePassword = 'azureTokenCache-testpassword';
		const tokenCache = new SimpleTokenCache('testTokenService');

		const addResult = await tokenCache.saveCredential(tokenCacheKey, tokenCachePassword);
		should(addResult).not.be.false('TokenResponse not added correctly');

		const clearResult = await tokenCache.clearCredential(tokenCacheKey);
		should(clearResult).not.be.false('TokenResponse not cleared correctly');

		const results = await tokenCache.getCredential(tokenCacheKey);
		should(results).equal(null);
	});
});
