/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import { HttpClient } from '../common/httpClient';
import { getPlatformReleaseVersion, getPlatformDownloadLink } from '../azdataReleaseInfo';

const emptyReleaseJson = {
	win32: {},
	darwin: {},
	linux: {}
};

describe('azdataReleaseInfo', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});

	it('getAzdataReleaseInfo throws with invalid JSON', async function (): Promise<void> {
		sinon.stub(HttpClient, 'getTextContent').resolves('invalid JSON');
		await should(getPlatformReleaseVersion()).be.rejected();
	});

	it('getPlatformReleaseVersion throws when no version', async function (): Promise<void> {

		sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(emptyReleaseJson));
		await should(getPlatformReleaseVersion()).be.rejected();
	});

	it('getPlatformDownloadLink throws when no download link', async function (): Promise<void> {
		sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(emptyReleaseJson));
		await should(getPlatformDownloadLink()).be.rejected();
	});
});
