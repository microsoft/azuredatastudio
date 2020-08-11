/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteBookDialogModel } from '../../dialog/remoteBookDialogModel';
import { IRelease, RemoteBookController } from '../../book/remoteBookController';
import * as should from 'should';
import * as request from 'request';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MockExtensionContext } from '../common/stubs';
import { AppContext } from '../../common/appContext';
import * as loc from '../../common/localizedConstants';

describe('Remote Book Controller', function () {
	let mockExtensionContext: vscode.ExtensionContext = new MockExtensionContext();
	let appContext = new AppContext(mockExtensionContext);
	let model = new RemoteBookDialogModel();
	let controller = new RemoteBookController(model, appContext.outputChannel);
	let getStub : sinon.SinonStub;

	beforeEach(function (): void {
		getStub = sinon.stub(request, 'get');
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Verify that errorMessage is thrown, when fetchReleases call returns empty', async function (): Promise<void> {
		let expectedBody = JSON.stringify([]);
		let expectedURL = vscode.Uri.parse('https://api.github.com/repos/microsoft/test/releases');
		getStub.yields(null, { statusCode: 200 }, expectedBody);

		try {
			await controller.getReleases(expectedURL);
		}
		catch (err) {
			should(err.message).be.equals(loc.msgReleaseNotFound);
			should(model.releases.length).be.equal(0);
		}
	});

	it('Should get the books', async function (): Promise<void> {
		let expectedBody = JSON.stringify([
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1-EN.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-EN.zip',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.1-ES.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/2/test-1.1-ES.zip',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1-EN.tgz',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-EN.tgz',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.1-ES.tar.gz',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/2/test-1.1-ES.tar.gz',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/3',
				name: 'test-1.1-FR.tgz',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-FR.tgz',
			}
		]);
		let expectedURL = vscode.Uri.parse('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		getStub.yields(null, { statusCode: 200 }, expectedBody);

		let result = await controller.getAssets(expectedRelease);
		should(result.length).be.above(0, 'Result should contain assets');
		result.forEach(asset => {
			should(asset).have.property('name');
			should(asset).have.property('url');
			should(asset).have.property('browserDownloadUrl');
		});
	});

	it('Should throw an error if the book object does not follow the name-version-lang format', async function (): Promise<void> {
		let expectedBody = JSON.stringify([
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1.zip',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.2.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.2.zip',
			},
		]);
		let expectedURL = vscode.Uri.parse('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		getStub.yields(null, { statusCode: 200 }, expectedBody);

		try {
			await controller.getAssets(expectedRelease);
		}
		catch (err) {
			should(err.message).be.equals(loc.msgBookNotFound);
			should(model.releases.length).be.equal(0);
		}
	});
});

