/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteBookDialogModel, RemoteBookDialog } from '../../dialog/remoteBookDialog';
import { RemoteBookController } from '../../book/remoteBookController';
import * as should from 'should';
import * as request from 'request';
import * as sinon from 'sinon';

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
		sinon.stub(request, 'get').yields(null, { statusCode: 200 }, expectedBody);

		let result = await remoteBookController.fetchGithubReleases(expectedURL);
		should(result.length).be.equal(3, 'Result should be equal to the expectedBody');
		result.forEach(release => {
			should(release).have.property('name');
			should(release).have.property('assets_url');
		});
		let modelReleases = remoteBookDialogModel.releases;
		should(result).deepEqual(remoteBookController.getReleases());
		should(result).deepEqual(modelReleases);
	});

	it('Verify that fetchAssets call populates model correctly', async function (): Promise<void> {
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
		sinon.stub(request, 'get').yields(null, { statusCode: 200 }, expectedBody);

		let result = await remoteBookController.fetchGithubReleases(expectedURL);
		should(result.length).be.equal(3, 'Result should be equal to the expectedBody');
		result.forEach(release => {
			should(release).have.property('name');
			should(release).have.property('assets_url');
		});
		let modelReleases = remoteBookDialogModel.releases;
		should(result).deepEqual(remoteBookController.getReleases());
		should(result).deepEqual(modelReleases);
	});

	it('Should extract the folder containing books', async function (): Promise<void> {

	});
});

