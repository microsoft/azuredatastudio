/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IPanelView } from 'sql/base/browser/ui/panel/panel';

import { Dimension } from 'vs/base/browser/dom';

export class ChartView implements IPanelView {
	render(container: HTMLElement): void {
		throw new Error("Method not implemented.");
	}

	layout(dimension: Dimension): void {
		throw new Error("Method not implemented.");
	}

	remove?(): void {
		throw new Error("Method not implemented.");
	}
}
