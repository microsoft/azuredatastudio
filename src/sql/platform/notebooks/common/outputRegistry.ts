/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';

export const Extensions = {
	CellComponentContributions: 'notebook.contributions.cells'
};

export const HideInputTag = 'hide_input';

export interface ICellComponenetRegistry {
	registerComponent(component: any): void;
	getComponents(): Array<any>;
}

class CellComponenetRegistry implements ICellComponenetRegistry {
	private components = new Array<any>();

	registerComponent(component: any): void {
		this.components.push(component);
	}

	getComponents(): any[] {
		return this.components.slice();
	}
}

const componentRegistry = new CellComponenetRegistry();
Registry.add(Extensions.CellComponentContributions, componentRegistry);

export function registerCellComponent(component: any): void {
	componentRegistry.registerComponent(component);
}
