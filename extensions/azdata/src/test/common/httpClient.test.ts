/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import { HttpClient } from '../../common/httpClient';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as uuid from 'uuid';
import * as nock from 'nock';
import * as sinon from 'sinon';
import { PassThrough } from 'stream';

describe('HttpClient', function () {

	let outputChannelMock: TypeMoq.IMock<vscode.OutputChannel>;

	before(function (): void {
		outputChannelMock = TypeMoq.Mock.ofType<vscode.OutputChannel>();
	});

	afterEach(function (): void {
		nock.cleanAll();
		nock.enableNetConnect();
	});

	it('downloads file successfully', async function (): Promise<void> {
		const downloadPath = path.join(os.tmpdir(), `azdata-httpClientTest-${uuid.v4()}.txt`);
		await HttpClient.download('https://raw.githubusercontent.com/microsoft/azuredatastudio/main/README.md', downloadPath, outputChannelMock.object);
		// Verify file was downloaded correctly
		await fs.promises.stat(downloadPath);
	});

	it('errors on response stream error', async function (): Promise<void> {
		const downloadPath = path.join(os.tmpdir(), `azdata-httpClientTest-error-${uuid.v4()}.txt`);
		nock('https://127.0.0.1')
			.get('/')
			.replyWithError('Unexpected Error');
		const downloadPromise = HttpClient.download('https://127.0.0.1', downloadPath, outputChannelMock.object);

		await should(downloadPromise).be.rejected();
	});

	it('errors on write stream error', async function (): Promise<void> {
		const downloadPath = path.join(os.tmpdir(), `azdata-httpClientTest-error-${uuid.v4()}.txt`);
		const mockWriteStream = new PassThrough();
		sinon.stub(fs, 'createWriteStream').returns(<any>mockWriteStream);
		nock('https://127.0.0.1')
			.get('/')
			.reply(200, '');
		const downloadPromise = HttpClient.download('https://127.0.0.1', downloadPath, outputChannelMock.object);
		try {
			// Passthrough streams will throw the error we emit so just no-op and
			// let the HttpClient handler handle the error
			mockWriteStream.emit('error', 'Unexpected write error');
		} catch (err) { }
		await should(downloadPromise).be.rejected();
	});
});
