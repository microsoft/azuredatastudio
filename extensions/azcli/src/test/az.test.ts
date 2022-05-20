/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as childProcess from '../common/childProcess';
import * as az from '../az';

describe('az', function () {
	afterEach(function (): void {
		sinon.restore();
	});
	describe('azTool', function (): void {
		const azTool = new az.AzTool('my path', '2.26.0', '1.0.0');
		let executeCommandStub: sinon.SinonStub;
		const namespace = 'arc';
		const name = 'arcdc';

		beforeEach(function (): void {
			executeCommandStub = sinon.stub(childProcess, 'executeCommand').resolves({ stdout: '{}', stderr: '' });
		});

		describe('arcdata', function (): void {
			describe('dc', function (): void {
				describe('endpoint', async function (): Promise<void> {
					it('list', async function (): Promise<void> {
						await azTool.arcdata.dc.endpoint.list(namespace);
						verifyExecuteCommandCalledWithArgs(['arcdata', 'dc', 'endpoint', 'list', '--k8s-namespace', namespace, '--use-k8s']);
					});
				});
				describe('config', async function (): Promise<void> {
					it('list', async function (): Promise<void> {
						await azTool.arcdata.dc.config.list();
						verifyExecuteCommandCalledWithArgs(['arcdata', 'dc', 'config', 'list']);
					});
					it('show', async function (): Promise<void> {
						await azTool.arcdata.dc.config.show(namespace);
						verifyExecuteCommandCalledWithArgs(['arcdata', 'dc', 'config', 'show', '--k8s-namespace', namespace, '--use-k8s']);
					});
				});
			});
		});

		describe('postgres', function (): void {
			describe('arc-server', function (): void {
				it('delete', async function (): Promise<void> {
					await azTool.postgres.arcserver.delete(name, namespace);
					verifyExecuteCommandCalledWithArgs(['postgres', 'arc-server', 'delete', name, '--k8s-namespace', namespace]);
				});
				it('list', async function (): Promise<void> {
					await azTool.postgres.arcserver.list(namespace);
					verifyExecuteCommandCalledWithArgs(['postgres', 'arc-server', 'list', '--k8s-namespace', namespace]);
				});
				it('show', async function (): Promise<void> {
					await azTool.postgres.arcserver.show(name, namespace);
					verifyExecuteCommandCalledWithArgs(['postgres', 'arc-server', 'show', name, '--k8s-namespace', namespace]);
				});
				it.skip('edit', async function (): Promise<void> {
					const args = {
						adminPassword: true,
						coresLimit: 'myCoresLimit',
						coresRequest: 'myCoresRequest',
						engineSettings: 'myEngineSettings',
						extensions: 'myExtensions',
						memoryLimit: 'myMemoryLimit',
						memoryRequest: 'myMemoryRequest',
						noWait: true,
						port: 1337,
						replaceEngineSettings: true,
						workers: 2
					};
					await azTool.postgres.arcserver.edit(name, args, namespace);
					verifyExecuteCommandCalledWithArgs([
						'postgres', 'arc-server', 'edit',
						name,
						'--admin-password',
						args.coresLimit,
						args.coresRequest,
						args.engineSettings,
						args.extensions,
						args.memoryLimit,
						args.memoryRequest,
						'--no-wait',
						args.port.toString(),
						'--replace-engine-settings',
						args.workers.toString()]);
				});
				it('edit no optional args', async function (): Promise<void> {
					await azTool.postgres.arcserver.edit(name, {}, namespace);
					verifyExecuteCommandCalledWithArgs([
						'postgres', 'arc-server', 'edit',
						name]);
					verifyExecuteCommandCalledWithoutArgs([
						'--admin-password',
						'--cores-limit',
						'--cores-request',
						'--engine-settings',
						'--extensions',
						'--memory-limit',
						'--memory-request',
						'--no-wait',
						'--port',
						'--replace-engine-settings',
						'--workers']);
				});
			});
		});
		describe('sql', function (): void {
			describe('mi-arc', function (): void {
				it('delete', async function (): Promise<void> {
					// Assume indirect mode
					await azTool.sql.miarc.delete(name, {resourceGroup: undefined, namespace: namespace});
					verifyExecuteCommandCalledWithArgs(['sql', 'mi-arc', 'delete', name, '--k8s-namespace', namespace, '--use-k8s']);
				});
				it('list', async function (): Promise<void> {
					// Assume indirect mode
					await azTool.sql.miarc.list({resourceGroup: undefined, namespace: namespace});
					verifyExecuteCommandCalledWithArgs(['sql', 'mi-arc', 'list', '--k8s-namespace', namespace, '--use-k8s']);
				});
				it('show', async function (): Promise<void> {
					// Assume indirect mode
					await azTool.sql.miarc.show(name, {resourceGroup: undefined, namespace: namespace});
					verifyExecuteCommandCalledWithArgs(['sql', 'mi-arc', 'show', name, '--k8s-namespace', namespace, '--use-k8s']);
				});
			});
		});

		it.skip('version', async function (): Promise<void> {
			executeCommandStub.resolves({ stdout: '1.0.0', stderr: '' });
			await azTool.version();
			verifyExecuteCommandCalledWithArgs(['--version']);
		});

		/**
		 * Verifies that the specified args were included in the call to executeCommand
		 * @param args The args to check were included in the execute command call
		 */
		function verifyExecuteCommandCalledWithArgs(args: string[], callIndex = 0): void {
			const commandArgs = executeCommandStub.args[callIndex][1] as string[];
			args.forEach(arg => should(commandArgs).containEql(arg));
		}

		/**
		 * Verifies that the specified args weren't included in the call to executeCommand
		 * @param args The args to check weren't included in the execute command call
		 */
		function verifyExecuteCommandCalledWithoutArgs(args: string[]): void {
			const commandArgs = executeCommandStub.args[0][1] as string[];
			args.forEach(arg => should(commandArgs).not.containEql(arg));
		}
	});
});
