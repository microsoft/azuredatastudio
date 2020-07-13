/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteBookDialogModel, RemoteBookDialog } from '../../dialog/remoteBookDialog';
import {IReleases, RemoteBookController } from '../../book/remoteBookController';
import * as should from 'should';
import * as request from 'request';
import * as sinon from 'sinon';
import * as nls from 'vscode-nls';
import * as utils from '../../common/utils';

const localize = nls.loadMessageBundle();
const msgReleaseNotFound = localize('msgReleaseNotFound', 'Releases not Found');

export interface IExpectedBookItem {
	title: string;
	url?: string;
	sections?: any[];
	external?: boolean;
	previousUri?: string | undefined;
	nextUri?: string | undefined;
}

describe('Add Remote Book Dialog', function () {
	let remoteBookDialogModel = new RemoteBookDialogModel();
	let remoteBookController = new RemoteBookController(remoteBookDialogModel);
	let remoteBookDialog = new RemoteBookDialog(remoteBookController);

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		let spy = sinon.spy();
		spy(remoteBookDialog, 'createDialog');
		await remoteBookDialog.createDialog();
		should(spy.calledOnce).be.true();
	});

	it('Verify that fetchReleases call populates model correctly', async function (): Promise<void> {
		let expectedBody = JSON.stringify([
			{
				name: 'Test release 1',
				assets_url: 'https://api.github.com/repos/microsoft/test/releases/1/assets'
			},
			{
				name: 'Test release 2',
				assets_url: 'https://api.github.com/repos/microsoft/test/releases/2/assets'
			},
			{
				name: 'Test release 3',
				assets_url: 'https://api.github.com/repos/microsoft/test/releases/3/assets'
			}
		]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases');
		let sinonTest = sinon.stub(request, 'get');
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		let result = await remoteBookController.fetchGithubReleases(expectedURL);
		should(result.length).be.equal(3, 'Result should be equal to the expectedBody');
		result.forEach(release => {
			should(release).have.property('name');
			should(release).have.property('assets_url');
		});
		let modelReleases = remoteBookDialogModel.releases;
		should(result).deepEqual(remoteBookController.getReleases());
		should(result).deepEqual(modelReleases);
		sinonTest.restore();
	});

	it('Verify that errorMessage is thrown, when fetchReleases call returns empty', async function (): Promise<void> {
		let expectedBody = JSON.stringify([]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases');
		let sinonTest = sinon.stub(request, 'get');
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);
		try {
			let result = await remoteBookController.fetchGithubReleases(expectedURL);
			should(result.length).be.equal(0, 'Result should be equal to the expectedBody');
		}
		catch(err) {
			should(err).be.equals(msgReleaseNotFound);
			should(remoteBookDialogModel.releases.length).be.equal(0);
		}
		sinonTest.restore();
	});

	it('Verify that fetchAssets call populates model correctly', async function (): Promise<void> {
		let expectedBody = JSON.stringify([
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1-EN.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-EN.zip',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.1-ES.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/2/test-1.1-ES.zip',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/3',
				name: 'test-1.2-EN.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.2-EN.zip',
			}
		]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease : IReleases = {
			name: 'Test Release',
			assets_url: expectedURL
		};
		let sinonTest = sinon.stub(request, 'get');
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		let result = await remoteBookController.fecthListAssets(expectedRelease);
		should(result.length).be.equal(3, 'Result should be equal to the expectedBody');
		result.forEach(release => {
			should(release).have.property('name');
			should(release).have.property('url');
			should(release).have.property('browser_download_url');
		});
		let modelAssets = remoteBookDialogModel.assets;
		should(result).deepEqual(remoteBookController.getAssets());
		should(result).deepEqual(modelAssets);
		sinonTest.restore();
	});

	it('Should get the books with the same format as the user OS platform', async function (): Promise<void> {
		let expectedBody = JSON.stringify([
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1-EN.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-EN.zip',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.1-ES.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/2/test-1.1-ES.zip',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/3',
				name: 'test-1.1-FR.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-FR.zip',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1-EN.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-EN.tgz',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.1-ES.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/2/test-1.1-ES.tar.gz',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/3',
				name: 'test-1.1-FR.zip',
				browser_download_url:  'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-FR.tgz',
			}
		]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease : IReleases = {
			name: 'Test Release',
			assets_url: expectedURL
		};
		let sinonTest = sinon.stub(request, 'get');
		let sinonTestUtils = sinon.stub(utils, 'getOSPlatform');
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);
		sinonTestUtils.returns(utils.Platform.Windows);

		let result = await remoteBookController.fecthListAssets(expectedRelease);
		should(result.length).be.equal(3, 'Result should be equal to 3 when users os platform is not Windows or Mac');
		result.forEach(asset => {
			should(asset).have.property('name');
			should(asset).have.property('url');
			should(asset).have.property('browser_download_url');
			should(asset.format).be.oneOf(['tgz', 'tar.gz']);
		});
		sinonTest.restore();
		sinonTestUtils.restore();
	});

	it('Should extract the folder containing books', async function (): Promise<void> {

	});
});

