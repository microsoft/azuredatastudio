/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import axios from 'axios';

import { SimpleWebServer } from '../../../account-provider/utils/simpleWebServer';

let server: SimpleWebServer;

// These tests don't work on Linux systems because gnome-keyring doesn't like running on headless machines.
describe('AccountProvider.SimpleWebServer', function (): void {
	beforeEach(async function (): Promise<void> {
		server = new SimpleWebServer();
	});

	it('Starts up and returns a port', async function (): Promise<void> {
		const port = await server.startup();
		should(port).be.any.String().and.not.be.undefined().and.not.be.null();
	});

	it('Double startup should fail', async function (): Promise<void> {
		await server.startup();
		server.startup().should.be.rejected();
	});

	it('404 on unknown requests', async function (): Promise<void> {
		const status = 404;

		const server = new SimpleWebServer();
		const port = await server.startup();
		try {
			const result = await axios.get(`http://localhost:${port}/hello`);
			should(result).be.undefined();
		} catch (ex) {
			should(ex.response.status).equal(status);
		}
	});

	it('Responds to GET requests', async function (): Promise<void> {
		const msg = 'Hello World';
		const status = 200;

		const server = new SimpleWebServer();
		const port = await server.startup();
		server.on('/hello', (req, reqUrl, res) => {
			res.writeHead(status);
			res.write(msg);
			res.end();
		});

		const response = await axios.get(`http://localhost:${port}/hello`);
		should(response.status).equal(status);
		should(response.data).equal(msg);
	});

	it('Server shuts off', async function (): Promise<void> {
		await server.startup();
		server.shutdown().should.not.be.rejected();
	});

});
