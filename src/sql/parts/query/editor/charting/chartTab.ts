/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { ChartView } from './chartView';

import { localize } from 'vs/nls';
import { generateUuid } from 'vs/base/common/uuid';

export class ChartTab implements IPanelTab {
	public readonly title = localize('resultsTabTitle', 'Results');
	public readonly identifier = generateUuid();
	public readonly view: ChartView;
}
