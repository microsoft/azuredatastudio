/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import { createViewContext } from './utils';
import { DashboardWidget } from '../../views/widgets/dashboardWidget';
import { PredictService } from '../../prediction/predictService';

interface TestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
	predictService: TypeMoq.IMock<PredictService>;
}


function createContext(): TestContext {

	let viewTestContext = createViewContext();

	return {
		apiWrapper: viewTestContext.apiWrapper,
		view: viewTestContext.view,
		onClick: viewTestContext.onClick,
		predictService: TypeMoq.Mock.ofType(PredictService)
	};
}

describe('Dashboard widget', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();

		testContext.apiWrapper.setup(x => x.registerWidget(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async ( handler) => {
			await handler(testContext.view);
		});

		testContext.apiWrapper.setup(x => x.openExternal(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));

		testContext.predictService.setup(x => x.serverSupportOnnxModel()).returns(() => Promise.resolve(true));
		const dashboard = new DashboardWidget(testContext.apiWrapper.object, '', testContext.predictService.object);
		await dashboard.register();
		testContext.onClick.fire(undefined);
		testContext.apiWrapper.verify(x => x.openExternal(TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
	});
});
