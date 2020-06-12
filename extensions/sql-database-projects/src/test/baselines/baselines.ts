/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { promises as fs } from 'fs';

// Project baselines
export let newProjectFileBaseline: string;
export let openProjectFileBaseline: string;
export let openDataSourcesBaseline: string;
export let SSDTProjectFileBaseline: string;
export let SSDTProjectAfterUpdateBaselineWindows: string;
export let SSDTProjectAfterUpdateBaseline: string;
export let SSDTUpdatedProjectBaselineWindows: string;
export let SSDTUpdatedProjectBaseline: string;
export let SSDTUpdatedProjectAfterSystemDbUpdateBaselineWindows: string;
export let SSDTUpdatedProjectAfterSystemDbUpdateBaseline: string;

const baselineFolderPath = __dirname;

export async function loadBaselines() {
	newProjectFileBaseline = await loadBaseline(baselineFolderPath, 'newSqlProjectBaseline.xml');
	openProjectFileBaseline = await loadBaseline(baselineFolderPath, 'openSqlProjectBaseline.xml');
	openDataSourcesBaseline = await loadBaseline(baselineFolderPath, 'openDataSourcesBaseline.json');
	SSDTProjectFileBaseline = await loadBaseline(baselineFolderPath, 'SSDTProjectBaseline.xml');
	SSDTProjectAfterUpdateBaselineWindows = await loadBaseline(baselineFolderPath, 'SSDTProjectAfterUpdateBaselineWindows.xml');
	SSDTProjectAfterUpdateBaseline = await loadBaseline(baselineFolderPath, 'SSDTProjectAfterUpdateBaseline.xml');
	SSDTUpdatedProjectBaselineWindows = await loadBaseline(baselineFolderPath, 'SSDTUpdatedProjectBaselineWindows.xml');
	SSDTUpdatedProjectBaseline = await loadBaseline(baselineFolderPath, 'SSDTUpdatedProjectBaseline.xml');
	SSDTUpdatedProjectAfterSystemDbUpdateBaselineWindows = await loadBaseline(baselineFolderPath, 'SSDTUpdatedProjectAfterSystemDbUpdateBaselineWindows.xml');
	SSDTUpdatedProjectAfterSystemDbUpdateBaseline = await loadBaseline(baselineFolderPath, 'SSDTUpdatedProjectAfterSystemDbUpdateBaseline.xml');
}

async function loadBaseline(baselineFolderPath: string, fileName: string): Promise<string> {
	return (await fs.readFile(path.join(baselineFolderPath, fileName))).toString();
}
