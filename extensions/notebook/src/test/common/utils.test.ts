/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import { promises as fs } from 'fs';
import * as uuid from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as utils from '../../common/utils';
import { MockOutputChannel } from './stubs';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';

describe('Utils Tests', function () {

	it('getKnoxUrl', () => {
		const host = '127.0.0.1';
		const port = '8080';
		should(utils.getKnoxUrl(host, port)).endWith('/gateway');
	});

	it('getLivyUrl', () => {
		const host = '127.0.0.1';
		const port = '8080';
		should(utils.getLivyUrl(host, port)).endWith('/gateway/default/livy/v1/');
	});

	it('mkDir', async () => {
		const dirPath = path.join(os.tmpdir(), uuid.v4());
		await should(fs.stat(dirPath)).be.rejected();
		await utils.mkDir(dirPath, new MockOutputChannel());
		should.exist(await fs.stat(dirPath), `Folder ${dirPath} did not exist after creation`);
	});

	it('getErrorMessage Error', () => {
		const errMsg = 'Test Error';
		should(utils.getErrorMessage(new Error(errMsg))).equal(errMsg);
	});

	it('getErrorMessage string', () => {
		const errMsg = 'Test Error';
		should(utils.getErrorMessage(errMsg)).equal(errMsg);
	});

	it('getOSPlatform', async () => {
		should(utils.getOSPlatform()).not.throw();
	});

	it('getOSPlatformId', async () => {
		should(utils.getOSPlatformId()).not.throw();
	});

	describe('comparePackageVersions', () => {
		const version1 = '1.0.0.0';
		const version1Revision = '1.0.0.1';
		const version2 = '2.0.0.0';
		const shortVersion1 = '1';

		it('same id', () => {
			should(utils.comparePackageVersions(version1, version1)).equal(0);
		});

		it('first version lower', () => {
			should(utils.comparePackageVersions(version1, version2)).equal(-1);
		});

		it('second version lower', () => {
			should(utils.comparePackageVersions(version2, version1)).equal(1);
		});

		it('short first version is padded correctly', () => {
			should(utils.comparePackageVersions(shortVersion1, version1)).equal(0);
		});

		it('short second version is padded correctly when', () => {
			should(utils.comparePackageVersions(version1, shortVersion1)).equal(0);
		});

		it('correctly compares version with only minor version difference', () => {
			should(utils.comparePackageVersions(version1Revision, version1)).equal(1);
		});
	});

	describe('sortPackageVersions', () => {

		it('empty', () => {
			should(utils.sortPackageVersions([])).deepEqual([]);
		});

		it('single', () => {
			const single = ['1'];
			should(utils.sortPackageVersions(single)).deepEqual(single);
		});

		it('inorder', () => {
			const inorder = ['1', '2', '3'];
			should(utils.sortPackageVersions(inorder)).deepEqual(inorder);
		});

		it('inorder descending', () => {
			const inorder = ['1', '2', '3'];
			const inorderSortedDescending = ['3', '2', '1'];
			should(utils.sortPackageVersions(inorder, false)).deepEqual(inorderSortedDescending);
		});

		it('reverse order', () => {
			const reverseOrder = ['3', '2', '1'];
			const reverseOrderSorted = ['1', '2', '3'];
			should(utils.sortPackageVersions(reverseOrder)).deepEqual(reverseOrderSorted);
		});

		it('reverse order descending', () => {
			const reverseOrder = ['3', '2', '1'];
			const reverseOrderSortedDescending = ['3', '2', '1'];
			should(utils.sortPackageVersions(reverseOrder, false)).deepEqual(reverseOrderSortedDescending);
		});

		it('random', () => {
			const random = ['1', '42', '100', '0'];
			const randomSorted = ['0', '1', '42', '100'];
			should(utils.sortPackageVersions(random)).deepEqual(randomSorted);
		});

		it('random descending', () => {
			const random = ['1', '42', '100', '0'];
			const randomSortedDescending = ['100', '42', '1', '0'];
			should(utils.sortPackageVersions(random, false)).deepEqual(randomSortedDescending);
		});

		it('different lengths', () => {
			const random = ['1.0.0', '42', '100.0', '0.1', '1.0.1'];
			const randomSorted = ['0.1', '1.0.0', '1.0.1', '42', '100.0']
			should(utils.sortPackageVersions(random)).deepEqual(randomSorted);
		});
	});

	describe('getClusterEndpoints', () => {

	});

	describe('getLinkBearerToken', () => {
		describe('properly retrieves token for ADO with single account and tenant', () => {
			let singleTenant: { displayName: string, id: string } = {
				displayName: 'Microsoft',
				id: 'tenantId'
			};
			let singleAccount: azdata.Account = {
				displayInfo: {
					accountType: 'any',
					contextualDisplayName: 'joberume@microsoft.com',
					displayName: 'joberume@microsoft.com',
					userId: 'id'
				},
				isStale: false,
				key: {
					accountId: 'accountId',
					providerId: 'providerId'
				},
				properties: {
					tenants: [singleTenant]
				}
			};

			let accounts: azdata.Account[] = [singleAccount];
			let linkBearerToken: string = 'AAAAAAAAAAAAAAAAAAAAAMLheAAAAAAA0%2BuSeid';
			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);

			mockApiWrapper.setup(api => api.getAllAccounts()).returns(() => Promise.resolve(accounts));
			mockApiWrapper.setup(api => api.getBearerToken(singleAccount, azdata.AzureResource.AzureDevOps)).returns(() => Promise.resolve({ [singleTenant.id]: { token: linkBearerToken } }));

			let retrievedBearerToken = utils.getLinkBearerToken(azdata.AzureResource.AzureDevOps);

			should(retrievedBearerToken).be.equal(linkBearerToken);
		});
	});
});
