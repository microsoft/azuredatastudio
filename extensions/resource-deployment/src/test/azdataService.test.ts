/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as TypeMoq from 'typemoq';
import assert = require('assert');
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

		try {
			azdataService.getDeploymentProfiles(<BdcDeploymentType>'no-such-type');
			throw new Error('Expecting an error but the error is not thrown');
		}
		catch {
		}

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
			return new Promise<string>((resolve, reject) => {
				if (command === 'azdata bdc config list -o json') {
					resolve('{"result":["aks-1","profile-2"]}');
				} else if (command.startsWith('azdata bdc config init')) {
					resolve(undefined);
				}
				else {
					reject(`unexpected command: ${command}`);
				}
			});
		});
		const profiles = await azdataService.getDeploymentProfiles(BdcDeploymentType.NewAKS);
		assert(profiles.length === 1);
	});

	test('get bdc endpoints', async () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const azdataService = new AzdataService(mockPlatformService.object);
		const testClusterName = 'testnamespace';
		mockPlatformService.setup((service) => service.runCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((command: string, options: CommandOptions | undefined) => {
			return new Promise<string>((resolve, reject) => {
				if (command === `azdata login -n ${testClusterName}`) {
					resolve('');
				} else if (command === 'azdata bdc endpoint list') {
					resolve(`[{
							"name":"control",
							"endpoint":""
					},
						{
							"name":"sql",
							"endpoint":""
						}
					]`);
				} else {
					reject(`unexpected command:${command}`);
				}
			});
		});
		const endpoints = await azdataService.getEndpoints(testClusterName, '', '');
		assert(endpoints.length === 2, 'there should be 2 endpoints returned');
		mockPlatformService.verify(service => service.runCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(2));
	});
});
