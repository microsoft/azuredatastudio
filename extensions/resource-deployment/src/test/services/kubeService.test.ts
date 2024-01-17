/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import 'mocha';
import * as path from 'path';
import * as sinon from 'sinon';
import * as yamljs from 'yamljs';
import { tryExecuteAction } from '../../common/utils';
import { getDefaultKubeConfigPath, getKubeConfigClusterContexts, KubeClusterContext, KubeService } from '../../services/kubeService';

const kubeConfig =
{
	'contexts': [
		{
			'context': {
				'cluster': 'docker-desktop',
				'user': 'docker-desktop'
			},
			'name': 'docker-for-desktop'
		},
		{
			'context': {
				'cluster': 'kubernetes',
				'user': 'kubernetes-admin'
			},
			'name': 'kubernetes-admin@kubernetes'
		}
	],
	'current-context': 'docker-for-desktop'
};
describe('KubeService', function (): void {
	const kubeService: KubeService = new KubeService();
	const configFile = 'kubeConfig';

	afterEach('NotebookService cleanup', () => {
		sinon.restore();
	});

	it('getDefaultKubeConfigPath', async () => {
		getDefaultKubeConfigPath().should.endWith(path.join('.kube', 'config'));
		kubeService.getDefaultConfigPath().should.endWith(path.join('.kube', 'config'));
	});

	describe('get Kube Config Cluster Contexts', () => {
		it('success', async () => {
			sinon.stub(fs.promises, 'access').withArgs(configFile).resolves(); //resolving access to file, mocks its existence
			sinon.stub(yamljs, 'load').returns(<any>kubeConfig);
			const verifyContexts = (contexts: KubeClusterContext[], testName: string) => {
				contexts.length.should.equal(2, `test: ${testName} failed`);
				contexts[0].name.should.equal('docker-for-desktop', `test: ${testName} failed`);
				contexts[0].isCurrentContext.should.be.true(`test: ${testName} failed`);
				contexts[1].name.should.equal('kubernetes-admin@kubernetes', `test: ${testName} failed`);
				contexts[1].isCurrentContext.should.be.false(`test: ${testName} failed`);
			};
			verifyContexts(await getKubeConfigClusterContexts(configFile), 'getKubeConfigClusterContexts');
			verifyContexts(await kubeService.getClusterContexts(configFile), 'getClusterContexts');
		});
		it('errors with empty array on ENOENT error', async () => {
			sinon.stub(fs.promises, 'access').withArgs(configFile).rejects(Object.assign(new Error(), { code: 'ENOENT' })); //rejecting access to file, fakes its non-existence with specific error
			const verifyContexts = (contexts: KubeClusterContext[], testName: string) => {
				contexts.length.should.equal(0, `test: ${testName} failed`);
			};
			verifyContexts(await getKubeConfigClusterContexts(configFile), 'getKubeConfigClusterContexts');
			verifyContexts(await kubeService.getClusterContexts(configFile), 'getClusterContexts');
		});
		it('throws error when unable to access file with non ENOENT error', async () => {
			const error = new Error('unknown error accessing file');
			sinon.stub(fs.promises, 'access').withArgs(configFile).rejects(error); //rejecting access to file, fakes its non-existence
			((await tryExecuteAction(() => getKubeConfigClusterContexts(configFile))).error).should.equal(error, `test: getKubeConfigClusterContexts failed`);
			((await tryExecuteAction(() => kubeService.getClusterContexts(configFile))).error).should.equal(error, `test: getClusterContexts failed`);
		});
	});
});
