/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as fs from 'fs';

export function createHorizontalContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
	return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row' }).component();
}

export async function directoryExist(directoryPath: string): Promise<boolean> {
	const stats = await getFileStatus(directoryPath);
	return stats ? stats.isDirectory() : false;
}

export async function fileExist(filePath: string): Promise<boolean> {
	const stats = await getFileStatus(filePath);
	return stats ? stats.isFile() : false;
}

async function getFileStatus(path: string): Promise<fs.Stats | undefined> {
	try {
		const stats = await fs.promises.stat(path);
		return stats;
	}
	catch (e) {
		if (e.code === 'ENOENT') {
			return undefined;
		}
		else {
			throw e;
		}
	}
}
