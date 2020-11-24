/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import 'mocha';
import * as path from 'path';
import * as sinon from 'sinon';
import * as yamljs from 'yamljs';
import { getDefaultKubeConfigPath, getKubeConfigClusterContexts, KubeClusterContext } from '../../common/kubeUtils';
import { tryExecuteAction } from '../../common/utils';

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
describe('KubeUtils', function (): void {
	const configFile = 'kubeConfig';

	afterEach('KubeUtils cleanup', () => {
		sinon.restore();
	});

	it('getDefaultKubeConfigPath', async () => {
		getDefaultKubeConfigPath().should.endWith(path.join('.kube', 'config'));
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
		});
		it('throws error when unable to access file with non ENOENT error', async () => {
			const error = new Error('unknown error accessing file');
			sinon.stub(yamljs, 'load').throws(error); //rejecting access to file, fakes its non-existence
			((await tryExecuteAction(() => getKubeConfigClusterContexts(configFile))).error).should.equal(error, `test: getKubeConfigClusterContexts failed`);
		});
	});
});
