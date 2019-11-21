/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LegendPosition, DataDirection } from 'sql/workbench/contrib/charts/common/interfaces';

export interface IDataSet {
	data: Array<number>;
	label?: string;
}

export interface IChartConfig {
	colorMap?: { [column: string]: string };
	labelFirstColumn?: boolean;
	legendPosition?: LegendPosition;
	dataDirection?: DataDirection;
	columnsAsLabels?: boolean;
	showTopNData?: number;
}

export const defaultChartConfig: IChartConfig = {
	labelFirstColumn: true,
	columnsAsLabels: true,
	legendPosition: LegendPosition.Top,
	dataDirection: DataDirection.Vertical
};
