/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { QueryRunner } from '../../common/queryRunner';
import { ApiWrapper } from '../../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { PackageManagementService } from '../../packageManagement/packageManagementService';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
}

function createContext(): TestContext {
	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner)
	};
}

describe('Package Management Service', () => {
	it('isMachineLearningServiceEnabled should return true if external script is enabled', async function (): Promise<void> {
		const context = createContext();
		context.queryRunner.setup(x => x.isMachineLearningServiceEnabled(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		let serverConfigManager = new PackageManagementService(context.apiWrapper.object, context.queryRunner.object);
		let connection = new azdata.connection.ConnectionProfile();
		should.equal(await serverConfigManager.isMachineLearningServiceEnabled(connection), true);
	});

	it('isRInstalled should return true if R is installed', async function (): Promise<void> {
		const context = createContext();
		context.queryRunner.setup(x => x.isRInstalled(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		let serverConfigManager = new PackageManagementService(context.apiWrapper.object, context.queryRunner.object);
		let connection = new azdata.connection.ConnectionProfile();
		should.equal(await serverConfigManager.isRInstalled(connection), true);
	});

	it('isPythonInstalled should return true if Python is installed', async function (): Promise<void> {
		const context = createContext();
		context.queryRunner.setup(x => x.isPythonInstalled(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		let serverConfigManager = new PackageManagementService(context.apiWrapper.object, context.queryRunner.object);
		let connection = new azdata.connection.ConnectionProfile();
		should.equal(await serverConfigManager.isPythonInstalled(connection), true);
	});

	it('enableExternalScriptConfig should show error message if did not updated successfully', async function (): Promise<void> {
		const context = createContext();
		context.queryRunner.setup(x => x.updateExternalScriptConfig(TypeMoq.It.isAny(), true)).returns(() => Promise.resolve());
		context.queryRunner.setup(x => x.isMachineLearningServiceEnabled(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
		context.apiWrapper.setup(x => x.showInfoMessage(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
		context.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
		context.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			label: 'Yes'
		}));
		let serverConfigManager = new PackageManagementService(context.apiWrapper.object, context.queryRunner.object);
		let connection = new azdata.connection.ConnectionProfile();
		await serverConfigManager.enableExternalScriptConfig(connection);

		context.apiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});
