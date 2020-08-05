/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { IPlatformService, CommandOptions } from '../services/platformService';
import { AzdataService } from '../services/azdataService';
import { BdcDeploymentType } from '../interfaces';

suite('azdata service Tests', function (): void {
	test('azdata service handles deployment types properly', async () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const azdataService = new AzdataService(mockPlatformService.object);
		mockPlatformService.setup((service) => service.runCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((command: string, options: CommandOptions | undefined) => {
			return new Promise<string>((resolve) => {
				resolve('{"result":[]}');
			});
		});

		azdataService.getDeploymentProfiles(BdcDeploymentType.ExistingAKS);
		azdataService.getDeploymentProfiles(BdcDeploymentType.ExistingARO);
		azdataService.getDeploymentProfiles(BdcDeploymentType.ExistingKubeAdm);
		azdataService.getDeploymentProfiles(BdcDeploymentType.ExistingOpenShift);
		azdataService.getDeploymentProfiles(BdcDeploymentType.NewAKS);

		should(azdataService.getDeploymentProfiles(<BdcDeploymentType>'no-such-type')).rejected();
		mockPlatformService.verify((service) => service.runCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(5));
	});

	test('azdata service returns correct deployment profiles', async () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const azdataService = new AzdataService(mockPlatformService.object);
		mockPlatformService.setup((service => service.storagePath())).returns(() => {
			return '';
		});
		mockPlatformService.setup((service => service.readTextFile(TypeMoq.It.isAnyString()))).returns((path: string) => {
			return new Promise<string>((resolve) => {
				resolve('{}');
			});
		});
		mockPlatformService.setup((service) => service.runCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((command: string, options: CommandOptions | undefined) => {
			if (command === 'azdata bdc config list -o json') {
				return Promise.resolve('{"result":["aks-1","profile-2"]}');
			} else if (command.startsWith('azdata bdc config init')) {
				return Promise.resolve('');
			}
			else {
				return Promise.reject(`unexpected command: ${command}`);
			}
		});
		const profiles = await azdataService.getDeploymentProfiles(BdcDeploymentType.NewAKS);
		should(profiles.length).be.exactly(1);
	});
});
