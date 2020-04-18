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

interface TestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
}


function createContext(): TestContext {

	let viewTestContext = createViewContext();

	return {
		apiWrapper: viewTestContext.apiWrapper,
		view: viewTestContext.view,
		onClick: viewTestContext.onClick
	};
}

describe('Dashboard widget', () => {
	it('Should create view components successfully ', async function (): Promise<void> {
		let testContext = createContext();
		const dashboard = new DashboardWidget(testContext.apiWrapper.object, '');
		dashboard.register();
		testContext.onClick.fire();
		testContext.apiWrapper.verify(x => x.executeCommand(TypeMoq.It.isAny()), TypeMoq.Times.atMostOnce());
	});
});
