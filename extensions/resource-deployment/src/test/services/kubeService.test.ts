/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import 'mocha';
import * as path from 'path';
import * as sinon from 'sinon';
import * as yamljs from 'yamljs';
import { tryExecuteAction } from '../../common/utils';
import { getDefaultKubeConfigPath, getKubeConfigClusterContexts, KubeClusterContext, KubeService } from '../../services/kubeService';
import should = require('should');

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

	describe('getKubeConfigClusterContexts', () => {
		it('success', async () => {
			sinon.stub(fs.promises, 'access').withArgs(configFile).resolves(); //resolving access to file, mocks its existence
			sinon.stub(yamljs, 'load').returns(<any>kubeConfig);
			const verifyConfigs = (configs: KubeClusterContext[]) => {
				configs.length.should.equal(2);
				configs[0].name.should.equal('docker-for-desktop');
				configs[0].isCurrentContext = true;
				configs[1].name.should.equal('kubernetes-admin@kubernetes');
				configs[1].isCurrentContext = false;
			};
			verifyConfigs(await getKubeConfigClusterContexts(configFile));
			verifyConfigs(await kubeService.getClusterContexts(configFile));
		});
		it('errors with empty array', async () => {
			// let enoentError = new Error();
			// ;
			sinon.stub(fs.promises, 'access').withArgs(configFile).rejects(Object.assign(new Error(), { code: 'ENOENT' })); //resolving access to file, mocks its existence
			const verifyConfigs = (configs: KubeClusterContext[]) => {
				configs.length.should.equal(0);
			};
			verifyConfigs(await getKubeConfigClusterContexts(configFile));
			verifyConfigs(await kubeService.getClusterContexts(configFile));
		});
		it('throws error when unable to access file', async () => {
			sinon.stub(fs.promises, 'access').withArgs(configFile).rejects(new Error()); //resolving access to file, mocks its existence
			should((await tryExecuteAction(() => getKubeConfigClusterContexts(configFile))).error).not.be.undefined();
			should((await tryExecuteAction(() => kubeService.getClusterContexts(configFile))).error).not.be.undefined();

		});
	});
});
