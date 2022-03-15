/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';


export const SERVICE_ID = 'executionPlanService';

export const IExecutionPlanService = createDecorator<IExecutionPlanService>(SERVICE_ID);

export interface IExecutionPlanService {
	_serviceBrand: undefined;
	registerProvider(providerId: string, provider: azdata.executionPlan.ExecutionPlanServiceProvider): void;
	getExecutionPlan(planFile: azdata.executionPlan.ExecutionPlanGraphInfo): Promise<azdata.executionPlan.GetExecutionPlanResult>;
	getSupportedExecutionPlanExtensionsForProvider(providerId: string): string[];
}
