/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as fs from 'fs';

export function createHorizontalContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
	return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row' }).component();
}

export async function directoryExists(directoryPath: string): Promise<boolean> {
	try {
		const stats = await fs.promises.stat(directoryPath);
		return stats.isDirectory();
	}
	catch (e) {
		if (e.code === 'ENOENT') {
			return false;
		}
		else {
			throw e;
		}
	}
}
