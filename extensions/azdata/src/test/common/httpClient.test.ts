/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as nock from 'nock';
import * as os from 'os';
import * as should from 'should';
import * as sinon from 'sinon';
import { PassThrough } from 'stream';
import { HttpClient } from '../../common/httpClient';
import { Deferred } from '../../common/promise';

describe('HttpClient', function (): void {

	afterEach(function (): void {
		nock.cleanAll();
		nock.enableNetConnect();
		sinon.restore();
	});

	describe('downloadFile', function (): void {
		it('downloads file successfully', async function (): Promise<void> {
			nock('https://127.0.0.1')
				.get('/README.md')
				.replyWithFile(200, __filename);
			const downloadFolder = os.tmpdir();
			const downloadPath = await HttpClient.downloadFile('https://127.0.0.1/README.md', downloadFolder);
			// Verify file was downloaded correctly
			await fs.promises.stat(downloadPath);
		});

		it('errors on response stream error', async function (): Promise<void> {
			const downloadFolder = os.tmpdir();
			nock('https://127.0.0.1')
				.get('/')
				.replyWithError('Unexpected Error');
			const downloadPromise = HttpClient.downloadFile('https://127.0.0.1', downloadFolder);
			await should(downloadPromise).be.rejected();
		});

		it('rejects on non-OK status code', async function (): Promise<void> {
			const downloadFolder = os.tmpdir();
			nock('https://127.0.0.1')
				.get('/')
				.reply(404, '');
			const downloadPromise = HttpClient.downloadFile('https://127.0.0.1', downloadFolder);
			await should(downloadPromise).be.rejected();
		});

		it('errors on write stream error', async function (): Promise<void> {
			const downloadFolder = os.tmpdir();
			const mockWriteStream = new PassThrough();
			const deferredPromise = new Deferred();
			sinon.stub(fs, 'createWriteStream').callsFake(() => {
				deferredPromise.resolve();
				return <any>mockWriteStream;
			});
			nock('https://127.0.0.1')
				.get('/')
				.reply(200, '');
			const downloadPromise = HttpClient.downloadFile('https://127.0.0.1', downloadFolder);
			// Wait for the stream to be created before throwing the error or HttpClient will miss the event
			await deferredPromise;
			try {
				// Passthrough streams will throw the error we emit so just no-op and
				// let the HttpClient handler handle the error
				mockWriteStream.emit('error', 'Unexpected write error');
			} catch (err) { }
			await should(downloadPromise).be.rejected();
		});
	});

	describe('getTextContent', function (): void {
		it('Gets file contents correctly', async function (): Promise<void> {
			nock('https://127.0.0.1')
				.get('/arbitraryFile')
				.replyWithFile(200, __filename);
			const receivedContents = await HttpClient.getTextContent(`https://127.0.0.1/arbitraryFile`);
			should(receivedContents).equal((await fs.promises.readFile(__filename)).toString());
		});

		it('rejects on response error', async function (): Promise<void> {
			nock('https://127.0.0.1')
				.get('/')
				.replyWithError('Unexpected Error');
			const getFileContentsPromise = HttpClient.getTextContent('https://127.0.0.1/', );
			await should(getFileContentsPromise).be.rejected();
		});

		it('rejects on non-OK status code', async function (): Promise<void> {
			nock('https://127.0.0.1')
				.get('/')
				.reply(404, '');
			const getFileContentsPromise = HttpClient.getTextContent('https://127.0.0.1/', );
			await should(getFileContentsPromise).be.rejected();
		});
	});
});
