/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

import { IInsightsConfigDetails, IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { BaseActionContext } from 'sql/workbench/common/actions';

export interface IInsightsDialogModel {
	rows: string[][];
	columns: string[];
	getListResources(labelIndex: number, valueIndex: number): ListResource[];
	reset(): void;
	onDataChange: Event<void>;
	insight: IInsightsConfigDetails;
}

export interface ListResource {
	value: string;
	label: string;
	icon?: string;
	data?: string[];
	stateColor?: string;
	stateIcon?: string;
}

export const IInsightsDialogService = createDecorator<IInsightsDialogService>('insightsDialogService');

export interface IInsightsDialogService {
	_serviceBrand: any;
	show(input: IInsightsConfig, connectionProfile: IConnectionProfile): void;
	close();
}

export interface IInsightDialogActionContext extends BaseActionContext {
	cellData: string;
}

/* Regex that matches the form `${value}` */
export const insertValueRegex: RegExp = /\${(.*?)\}/;
