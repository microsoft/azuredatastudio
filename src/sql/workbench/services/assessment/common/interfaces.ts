/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'assessmentService';

export const IAssessmentService = createDecorator<IAssessmentService>(SERVICE_ID);

export interface IAssessmentService {
	_serviceBrand: undefined;
	registerProvider(providerId: string, provider: azdata.SqlAssessmentServicesProvider): void;
	getAssessmentItems(connectionUri: string, targetType: number): Thenable<azdata.SqlAssessmentResult>;
	assessmentInvoke(connectionUri: string, targetType: number): Thenable<azdata.SqlAssessmentResult>;
	generateAssessmentScript(connectionUri: string, items: azdata.SqlAssessmentResultItem[]): Thenable<azdata.ResultStatus>;
}
