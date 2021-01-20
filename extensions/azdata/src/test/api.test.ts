/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { getExtensionApi } from '../api';
import { AzdataToolService } from '../services/azdataToolService';
import { assertRejected } from './testUtils';

describe('api', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});
	describe('getExtensionApi', function (): void {
		it('throws when no azdata', async function(): Promise<void> {
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const azdataToolService = new AzdataToolService();
			const api = getExtensionApi(mementoMock.object, azdataToolService, Promise.resolve(undefined));
			await assertRejected(api.isEulaAccepted(), 'isEulaAccepted');

			await assertRejected(api.azdata.getPath(), 'getPath');
			await assertRejected(api.azdata.getSemVersion(), 'getSemVersion');
			await assertRejected(api.azdata.login('', '', ''), 'login');
			await assertRejected(api.azdata.acquireSession('', '', ''), 'acquireSession');
			await assertRejected(api.azdata.version(), 'version');

			await assertRejected(api.azdata.arc.dc.create('', '', '', '', '', ''), 'arc dc create');

			await assertRejected(api.azdata.arc.dc.config.list(), 'arc dc config list');
			await assertRejected(api.azdata.arc.dc.config.show(), 'arc dc config show');

			await assertRejected(api.azdata.arc.dc.endpoint.list(), 'arc dc endpoint list');

			await assertRejected(api.azdata.arc.sql.mi.list(), 'arc sql mi list');
			await assertRejected(api.azdata.arc.sql.mi.delete(''), 'arc sql mi delete');
			await assertRejected(api.azdata.arc.sql.mi.show(''), 'arc sql mi show');

			await assertRejected(api.azdata.arc.postgres.server.list(), 'arc sql postgres server list');
			await assertRejected(api.azdata.arc.postgres.server.delete(''), 'arc sql postgres server delete');
			await assertRejected(api.azdata.arc.postgres.server.show(''), 'arc sql postgres server show');
			await assertRejected(api.azdata.arc.postgres.server.edit('', { }), 'arc sql postgres server edit');
		});
	});
});

