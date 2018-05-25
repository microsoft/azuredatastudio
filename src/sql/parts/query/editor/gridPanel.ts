/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ViewletPanel } from 'vs/workbench/browser/parts/views/panelViewlet';

import * as sqlops from 'sqlops';

export class GridPanel extends ViewletPanel {
	protected renderBody(container: HTMLElement): void {
		container.innerText = 'Results';
	}

	protected layoutBody(size: number): void {

	}

	public onResultSet(resultSet: sqlops.ResultSetSummary) {

	}
}
