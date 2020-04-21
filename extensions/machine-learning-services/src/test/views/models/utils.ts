/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../../common/apiWrapper';
import { createViewContext } from '../utils';
import { ModelViewBase } from '../../../views/models/modelViewBase';
import { AzureModelRegistryService } from '../../../modelManagement/azureModelRegistryService';
import { DeployedModelService } from '../../../modelManagement/deployedModelService';
import { PredictService } from '../../../prediction/predictService';

export interface TestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
	azureModelService: TypeMoq.IMock<AzureModelRegistryService>;
	deployModelService: TypeMoq.IMock<DeployedModelService>;
	predictService: TypeMoq.IMock<PredictService>;
}

export class ParentDialog extends ModelViewBase {
	public refresh(): Promise<void> {
		return Promise.resolve();
	}
	public reset(): Promise<void> {
		return Promise.resolve();
	}
	constructor(
		apiWrapper: ApiWrapper) {
		super(apiWrapper, '');
	}
}

export function createContext(): TestContext {

	let viewTestContext = createViewContext();

	return {
		apiWrapper: viewTestContext.apiWrapper,
		view: viewTestContext.view,
		onClick: viewTestContext.onClick,
		azureModelService: TypeMoq.Mock.ofType(AzureModelRegistryService),
		deployModelService: TypeMoq.Mock.ofType(DeployedModelService),
		predictService: TypeMoq.Mock.ofType(PredictService)
	};
}
