/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as azExt from 'az-ext';
// import * as childProcess from '../common/childProcess';
// import * as sinon from 'sinon';
// import * as vscode from 'vscode';
// import * as TypeMoq from 'typemoq';
// import { getExtensionApi } from '../api';
// import { AzToolService } from '../services/azToolService';
// import { assertRejected } from './testUtils';
// import { AzTool } from '../azdata';

// describe('api', function (): void {
// 	afterEach(function (): void {
// 		sinon.restore();
// 	});
// 	describe('getExtensionApi', function (): void {
// 		it('throws when no az', async function (): Promise<void> {
// 			const azToolService = new AzToolService();
// 			const api = getExtensionApi(azToolService);
// 			await assertApiCalls(api, assertRejected);
// 		});

// 		it('succeed when az present and EULA accepted', async function (): Promise<void> {
// 			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
// 			mementoMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => true);
// 			const azTool = new AzTool('', '99.0.0');
// 			const azToolService = new AzToolService();
// 			azToolService.localAz = azTool;
// 			// Not using a mock here because it'll hang when resolving mocked objects
// 			const api = getExtensionApi(azToolService);
// 			sinon.stub(childProcess, 'executeCommand').callsFake(async (_command, args) => {
// 				// Version needs to be valid so it can be parsed correctly
// 				if (args[0] === '--version') {
// 					return { stdout: `99.0.0`, stderr: '' };
// 				}
// 				console.log(args[0]);
// 				return { stdout: `{ }`, stderr: '' };
// 			});
// 			await assertApiCalls(api, async (promise, message) => {
// 				try {
// 					await promise;
// 				} catch (err) {
// 					throw new Error(`API call to ${message} should have succeeded. ${err}`);
// 				}
// 			});
// 		});

// 		/**
// 		 * Asserts that calls to the Az API behave as expected
// 		 * @param api The API object to test the calls with
// 		 * @param assertCallback The function to assert that the results are as expected
// 		 */
// 		async function assertApiCalls(api: azExt.IExtension, assertCallback: (promise: Promise<any>, message: string) => Promise<void>): Promise<void> {
// 			await assertCallback(api.az.getPath(), 'getPath');
// 			await assertCallback(api.az.getSemVersion(), 'getSemVersion');
// 			await assertCallback(api.az.version(), 'version');

// 			await assertCallback(api.az.arcdata.dc.config.list(), 'arc dc config list');
// 			await assertCallback(api.az.arcdata.dc.config.show(), 'arc dc config show');

// 			await assertCallback(api.az.arcdata.dc.endpoint.list(), 'arc dc endpoint list');

// 			await assertCallback(api.az.sql.miarc.list(), 'arc sql mi list');
// 			await assertCallback(api.az.sql.miarc.delete(''), 'arc sql mi delete');
// 			await assertCallback(api.az.sql.miarc.show(''), 'arc sql mi show');
// 			await assertCallback(api.az.sql.miarc.edit('', {}), 'arc sql mi edit');
// 			await assertCallback(api.az.postgres.arcserver.list(), 'arc sql postgres server list');
// 			await assertCallback(api.az.postgres.arcserver.delete(''), 'arc sql postgres server delete');
// 			await assertCallback(api.az.postgres.arcserver.show(''), 'arc sql postgres server show');
// 			await assertCallback(api.az.postgres.arcserver.edit('', {}), 'arc sql postgres server edit');
// 		}
// 	});
// });
