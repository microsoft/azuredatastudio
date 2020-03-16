/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import axios from 'axios';

import { SimpleWebServer } from '../../../account-provider/auths/simpleWebServer';

// These tests don't work on Linux systems because gnome-keyring doesn't like running on headless machines.
describe('AccountProvider.SimpleWebServer', function (): void {
	it('Starts up and returns a port', async function (): Promise<void> {
		const server = new SimpleWebServer();
		const port = await server.startup();
		should(port).be.any.String().and.not.be.undefined().and.not.be.null();
	});

	it('Responds to GET requests', async function (): Promise<void> {
		const msg = 'Hello World';
		const status  = 200;

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

});
