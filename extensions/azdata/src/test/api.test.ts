/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as childProcess from '../common/childProcess';
import * as sinon from 'sinon';
import * as should from 'should';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { getExtensionApi, throwIfNoAzdataOrEulaNotAccepted } from '../api';
import { AzdataToolService } from '../services/azdataToolService';
import { assertRejected } from './testUtils';
import { AzdataTool, IAzdataTool, AzdataDeployOption } from '../azdata';

describe('api', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});
	describe('throwIfNoAzdataOrEulaNotAccepted', function (): void {
		it('throws when no azdata', function (): void {
			should(() => throwIfNoAzdataOrEulaNotAccepted(undefined, false)).throw();
		});
		it('throws when EULA not accepted', function (): void {
			should(() => throwIfNoAzdataOrEulaNotAccepted(TypeMoq.Mock.ofType<IAzdataTool>().object, false)).throw();
		});
		it('passes with AzdataTool and EULA accepted', function (): void {
			throwIfNoAzdataOrEulaNotAccepted(TypeMoq.Mock.ofType<IAzdataTool>().object, true);
		});
	});
	describe('getExtensionApi', function (): void {
		it('throws when no azdata', async function (): Promise<void> {
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const azdataToolService = new AzdataToolService();
			const api = getExtensionApi(mementoMock.object, azdataToolService, Promise.resolve(undefined));
			await assertRejected(api.isEulaAccepted(), 'isEulaAccepted');
			await assertApiCalls(api, assertRejected);
		});

		it('throws when EULA not accepted', async function (): Promise<void> {
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			mementoMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => false);
			const azdataToolService = new AzdataToolService();
			// Not using a mock here because it'll hang when resolving mocked objects
			const api = getExtensionApi(mementoMock.object, azdataToolService, Promise.resolve(new AzdataTool('', '1.0.0')));
			should(await api.isEulaAccepted()).be.false('EULA should not be accepted');
			await assertApiCalls(api, assertRejected);
		});

		it('succeed when azdata present and EULA accepted', async function (): Promise<void> {
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			mementoMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => true);
			const azdataTool = new AzdataTool('', '99.0.0');
			const azdataToolService = new AzdataToolService();
			azdataToolService.localAzdata = azdataTool;
			// Not using a mock here because it'll hang when resolving mocked objects
			const api = getExtensionApi(mementoMock.object, azdataToolService, Promise.resolve(azdataTool));
			should(await api.isEulaAccepted()).be.true('EULA should be accepted');
			sinon.stub(childProcess, 'executeCommand').callsFake(async (_command, args) => {
				// Version needs to be valid so it can be parsed correctly
				if (args[0] === '--version') {
					return { stdout: `99.0.0`, stderr: '' };
				}
				console.log(args[0]);
				return { stdout: `{ }`, stderr: '' };
			});
			await assertApiCalls(api, async (promise, message) => {
				try {
					await promise;
				} catch (err) {
					throw new Error(`API call to ${message} should have succeeded. ${err}`);
				}
			});
		});

		it('promptForEula', async function (): Promise<void> {
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			mementoMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => true);
			const azdataToolService = new AzdataToolService();
			// Not using a mock here because it'll hang when resolving mocked objects
			const api = getExtensionApi(mementoMock.object, azdataToolService, Promise.resolve(new AzdataTool('', '1.0.0')));
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => AzdataDeployOption.dontPrompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
			should(await api.promptForEula()).be.false();
			should(showErrorMessageStub.called).be.true('User should have been prompted to accept');
		});

		/**
		 * Asserts that calls to the Azdata API behave as expected
		 * @param api The API object to test the calls with
		 * @param assertCallback The function to assert that the results are as expected
		 */
		async function assertApiCalls(api: azdataExt.IExtension, assertCallback: (promise: Promise<any>, message: string) => Promise<void>): Promise<void> {
			await assertCallback(api.azdata.getPath(), 'getPath');
			await assertCallback(api.azdata.getSemVersion(), 'getSemVersion');
			await assertCallback(api.azdata.login({ endpoint: 'https://127.0.0.1' }, '', ''), 'login');
			await assertCallback(api.azdata.login({ namespace: 'namespace' }, '', ''), 'login');
			await assertCallback(api.azdata.version(), 'version');

			await assertCallback(api.azdata.arc.dc.create('', '', '', '', '', ''), 'arc dc create');

			await assertCallback(api.azdata.arc.dc.config.list(), 'arc dc config list');
			await assertCallback(api.azdata.arc.dc.config.show(), 'arc dc config show');

			await assertCallback(api.azdata.arc.dc.endpoint.list(), 'arc dc endpoint list');

			await assertCallback(api.azdata.arc.sql.mi.list(), 'arc sql mi list');
			await assertCallback(api.azdata.arc.sql.mi.delete(''), 'arc sql mi delete');
			await assertCallback(api.azdata.arc.sql.mi.show(''), 'arc sql mi show');
			await assertCallback(api.azdata.arc.sql.mi.edit('', {}), 'arc sql mi edit');
			await assertCallback(api.azdata.arc.postgres.server.list(), 'arc sql postgres server list');
			await assertCallback(api.azdata.arc.postgres.server.delete(''), 'arc sql postgres server delete');
			await assertCallback(api.azdata.arc.postgres.server.show(''), 'arc sql postgres server show');
			await assertCallback(api.azdata.arc.postgres.server.edit('', {}), 'arc sql postgres server edit');
		}
	});
});

