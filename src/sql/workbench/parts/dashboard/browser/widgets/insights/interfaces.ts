/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsightsConfig } from 'sql/platform/dashboard/browser/insightRegistry';

export interface IInsightTypeContrib {
	id: string;
	contrib: IInsightsConfig;
}