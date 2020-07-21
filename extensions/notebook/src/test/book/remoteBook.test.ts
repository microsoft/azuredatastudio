/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteBookDialogModel, RemoteBookDialog } from '../../dialog/remoteBookDialog';
import { IRelease, RemoteBookController } from '../../book/remoteBookController';
import * as should from 'should';
import * as request from 'request';
import * as sinon from 'sinon';
import * as nls from 'vscode-nls';
import * as utils from '../../common/utils';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as uuid from 'uuid';
import AdmZip = require('adm-zip');

const localize = nls.loadMessageBundle();
const msgReleaseNotFound = localize('msgReleaseNotFound', "Releases not Found");
const msgBookNotFound = localize('msgBookNotFound', "Books not Found");


export interface IExpectedBookItem {
	title: string;
	url?: string;
	sections?: any[];
	external?: boolean;
	previousUri?: string | undefined;
	nextUri?: string | undefined;
}

describe('Add Remote Book Dialog', function () {
	let model = new RemoteBookDialogModel();
	let controller = new RemoteBookController(model);
	let dialog = new RemoteBookDialog(controller);
	let sinonTest: sinon.SinonStub;

	beforeEach(function (): void {
		sinonTest = sinon.stub(request, 'get');
	});

	afterEach(function (): void {
		sinonTest.restore();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const spy = sinon.spy(dialog, 'createDialog');
		await dialog.createDialog();
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

		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		let result = await controller.getReleases(expectedURL);

		should(result.length).be.equal(3, 'Result should be equal to the expectedBody');

		result.forEach(release => {
			should(release).have.property('name');
			should(release).have.property('assetsUrl');
		});
		let modelReleases = model.releases;
		should(result).deepEqual(await controller.getReleases());
		should(result).deepEqual(modelReleases);
	});

	it('Verify that errorMessage is thrown, when fetchReleases call returns empty', async function (): Promise<void> {
		let expectedBody = JSON.stringify([]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases');
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		try {
			let result = await controller.getReleases(expectedURL);
			should(result.length).be.equal(0, 'Result should be equal to the expectedBody');
		}
		catch (err) {
			should(err.message).be.equals(msgReleaseNotFound);
			should(model.releases.length).be.equal(0);
		}
	});

	it('Verify that fetchAssets call populates model correctly', async function (): Promise<void> {
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
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/3',
				name: 'test-1.2-EN.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.2-EN.zip',
			}
		]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		let result = await controller.getAssets(expectedRelease);
		should(result.length).be.equal(3, 'Result should be equal to the expectedBody');
		result.forEach(release => {
			should(release).have.property('name');
			should(release).have.property('url');
			should(release).have.property('browserDownloadUrl');
		});
		let modelAssets = model.assets;
		should(result).deepEqual(await controller.getAssets());
		should(result).deepEqual(modelAssets);
	});

	it('Should get the books with the same format as the user OS platform', async function (): Promise<void> {
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
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		let sinonTestUtils = sinon.stub(utils, 'getOSPlatform').returns((utils.Platform.Linux));

		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		let result = await controller.getAssets(expectedRelease);
		should(result.length).be.equal(3, 'Should get the files based on the OS platform');
		result.forEach(asset => {
			should(asset).have.property('name');
			should(asset).have.property('url');
			should(asset).have.property('browserDownloadUrl');
			should(asset.format).be.oneOf(['tgz', 'tar.gz']);
		});
		sinonTestUtils.restore();
	});

	it('Should extract the folder containing books', async function (): Promise<void> {
		// Create local file containing books
		let bookFolderPath: string;
		let rootFolderPath: string;
		let expectedNotebook1: IExpectedBookItem;
		let expectedNotebook2: IExpectedBookItem;
		let expectedExternalLink: IExpectedBookItem;
		//let expectedBook: IExpectedBookItem;
		rootFolderPath = path.join(os.tmpdir(), `BookTestData_${uuid.v4()}`);
		bookFolderPath = path.join(rootFolderPath, `Book`);
		let dataFolderPath: string = path.join(bookFolderPath, '_data');
		let contentFolderPath: string = path.join(bookFolderPath, 'content');
		let configFile: string = path.join(bookFolderPath, '_config.yml');
		let tableOfContentsFile: string = path.join(dataFolderPath, 'toc.yml');
		let notebook1File: string = path.join(contentFolderPath, 'notebook1.ipynb');
		let notebook2File: string = path.join(contentFolderPath, 'notebook2.ipynb');

		expectedNotebook1 = {
			title: 'Notebook1',
			url: '/notebook1',
			previousUri: undefined,
			nextUri: notebook2File.toLocaleLowerCase()
		};
		expectedNotebook2 = {
			title: 'Notebook2',
			url: '/notebook2',
			previousUri: notebook1File.toLocaleLowerCase()
		};
		expectedExternalLink = {
			title: 'GitHub',
			url: 'https://github.com/',
			external: true
		};
		let expectedBook: IExpectedBookItem = {
			sections: [expectedNotebook1, expectedNotebook2, expectedExternalLink],
			title: 'Test Book'
		};

		await fs.mkdir(rootFolderPath);
		await fs.mkdir(bookFolderPath);
		await fs.mkdir(dataFolderPath);
		await fs.mkdir(contentFolderPath);
		await fs.writeFile(configFile, 'title: Test Book');
		await fs.writeFile(tableOfContentsFile, '- title: Notebook1\n  url: /notebook1\n  sections:\n  - title: Notebook2\n    url: /notebook2\n');
		await fs.writeFile(notebook1File, '');
		await fs.writeFile(notebook2File, '');

		// Create zip file
		let zip = new AdmZip();
		zip.addLocalFolder(bookFolderPath);
		zip.writeZip(path.join(rootFolderPath, `Book.zip`));
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
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		try {
			let result = await controller.getAssets(expectedRelease);
			should(result.length).be.equal(0, 'Should be empty when the naming convention is not being followed');
		}
		catch (err) {
			should(err.message).be.equals(msgBookNotFound);
			should(model.releases.length).be.equal(0);
		}
	});

	it('Should throw an error if no books are found', async function (): Promise<void> {
		let expectedBody = JSON.stringify([]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		try {
			let result = await controller.getAssets(expectedRelease);
			should(result.length).be.equal(0, 'Should be empty since no assets were returned');
		}
		catch (err) {
			should(err.message).be.equals(msgBookNotFound);
			should(model.releases.length).be.equal(0);
		}
	});
});

