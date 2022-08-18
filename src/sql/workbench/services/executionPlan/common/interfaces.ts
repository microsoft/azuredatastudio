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

	/**
	 * Registers an execution plan service provider.
	 */
	registerProvider(providerId: string, provider: azdata.executionPlan.ExecutionPlanProvider): void;
	/**
	 * Gets an execution plan for the given planFile.
	 */
	getExecutionPlan(planFile: azdata.executionPlan.ExecutionPlanGraphInfo): Promise<azdata.executionPlan.GetExecutionPlanResult>;
	/**
	 * Compares two execution plans and identifies matching regions in both execution plans.
	 * @param firstPlanFile file that contains the first execution plan.
	 * @param secondPlanFile file that contains the second execution plan.
	 */
	compareExecutionPlanGraph(firstPlanFile: azdata.executionPlan.ExecutionPlanGraphInfo, secondPlanFile: azdata.executionPlan.ExecutionPlanGraphInfo): Promise<azdata.executionPlan.ExecutionPlanComparisonResult>;
	/**
	 * Determines if the provided value is an execution plan and returns the appropriate file extension.
	 * @param value String that needs to be checked.
	 */
	isExecutionPlan(providerId: string, value: string): Promise<azdata.executionPlan.IsExecutionPlanResult>;

	/**
	 * Get execution plan file extensions supported by all registered providers.
	 * @param providerId optional parameter to get extensions only supported by a particular provider.
	 */
	getSupportedExecutionPlanExtensions(providerId?: string): string[];
}
