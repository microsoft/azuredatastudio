/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import { HttpClient } from '../common/httpClient';
import { getPlatformReleaseVersion, getPlatformDownloadLink, AzdataReleaseInfo } from '../azdataReleaseInfo';

const emptyReleaseJson = {
	win32: {},
	darwin: {},
	linux: {}
};

const releaseVersion = '999.999.999';
const releaseLink = 'https://microsoft.com';

const validReleaseJson: AzdataReleaseInfo = {
	win32: {
		version: releaseVersion,
		link: releaseLink
	},
	darwin: {
		version: releaseVersion,
		link: releaseLink
	},
	linux: {
		version: releaseVersion,
		link: releaseLink
	}
};

describe('azdataReleaseInfo', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});

	describe('getPlatformReleaseVersion', function(): void {
		it('gets version successfully', async function(): Promise<void> {
			sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(validReleaseJson));
			const version = await getPlatformReleaseVersion();
			should(version.format()).equal(releaseVersion);
		});

		it('throws with invalid JSON', async function (): Promise<void> {
			sinon.stub(HttpClient, 'getTextContent').resolves('invalid JSON');
			await should(getPlatformReleaseVersion()).be.rejected();
		});

		it('throws when no version', async function (): Promise<void> {
			sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(emptyReleaseJson));
			await should(getPlatformReleaseVersion()).be.rejected();
		});
	});

	describe('getPlatformDownloadLink', function(): void {
		it('gets link successfully', async function(): Promise<void> {
			sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(validReleaseJson));
			const link = await getPlatformDownloadLink();
			should(link).equal(releaseLink);
		});

		it('throws with invalid JSON', async function (): Promise<void> {
			sinon.stub(HttpClient, 'getTextContent').resolves('invalid JSON');
			await should(getPlatformDownloadLink()).be.rejected();
		});

		it('throws when no version', async function (): Promise<void> {
			sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(emptyReleaseJson));
			await should(getPlatformDownloadLink()).be.rejected();
		});
	});
});
