/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import { HttpClient } from '../../common/httpClient';
import * as os from 'os';
import * as fs from 'fs';
import * as nock from 'nock';
import * as sinon from 'sinon';
import { PassThrough } from 'stream';
import { Deferred } from '../../common/promise';

describe('HttpClient', function (): void {

	let outputChannelMock: TypeMoq.IMock<vscode.OutputChannel>;

	before(function (): void {
		outputChannelMock = TypeMoq.Mock.ofType<vscode.OutputChannel>();
	});

	afterEach(function (): void {
		nock.cleanAll();
		nock.enableNetConnect();
	});

	describe('download', function(): void {
		it('downloads file successfully', async function (): Promise<void> {
			nock('https://127.0.0.1')
				.get('/README.md')
				.replyWithFile(200, __filename);
			const downloadFolder = os.tmpdir();
			const downloadPath = await HttpClient.download('https://127.0.0.1/README.md', downloadFolder, outputChannelMock.object);
			// Verify file was downloaded correctly
			await fs.promises.stat(downloadPath);
		});

		it('errors on response stream error', async function (): Promise<void> {
			const downloadFolder = os.tmpdir();
			nock('https://127.0.0.1')
				.get('/')
				.replyWithError('Unexpected Error');
			const downloadPromise = HttpClient.download('https://127.0.0.1', downloadFolder, outputChannelMock.object);

			await should(downloadPromise).be.rejected();
		});

		it('rejects on non-OK status code', async function (): Promise<void> {
			const downloadFolder = os.tmpdir();
			nock('https://127.0.0.1')
				.get('/')
				.reply(404, '');
			const downloadPromise = HttpClient.download('https://127.0.0.1', downloadFolder, outputChannelMock.object);

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
			const downloadPromise = HttpClient.download('https://127.0.0.1', downloadFolder, outputChannelMock.object);
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

	describe('getFilename', function(): void {
		it('Gets filename correctly', async function (): Promise<void> {
			const filename = 'azdata-cli-20.0.0.msi';
			nock('https://127.0.0.1')
				.get(`/${filename}`)
				.reply(200);
			const receivedFilename = await HttpClient.getFilename(`https://127.0.0.1/${filename}`, outputChannelMock.object);

			should(receivedFilename).equal(filename);
		});

		it('errors on response error', async function (): Promise<void> {
			nock('https://127.0.0.1')
				.get('/')
				.replyWithError('Unexpected Error');
			const getFilenamePromise = HttpClient.getFilename('https://127.0.0.1', outputChannelMock.object);

			await should(getFilenamePromise).be.rejected();
		});

		it('rejects on non-OK status code', async function (): Promise<void> {
			nock('https://127.0.0.1')
				.get('/')
				.reply(404, '');
			const getFilenamePromise = HttpClient.getFilename('https://127.0.0.1', outputChannelMock.object);

			await should(getFilenamePromise).be.rejected();
		});
	});

});
