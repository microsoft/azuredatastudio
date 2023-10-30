/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { promises as fs } from 'fs';

// Project baselines
export let newProjectFileBaseline: string;
export let newProjectFileWithScriptBaseline: string;
export let openProjectFileBaseline: string;
export let openDataSourcesBaseline: string;
export let SSDTProjectFileBaseline: string;
export let SSDTUpdatedProjectBaseline: string;
export let SSDTProjectBaselineWithBeforeBuildTarget: string;
export let publishProfileIntegratedSecurityBaseline: string;
export let publishProfileSqlLoginBaseline: string;
export let publishProfileDefaultValueBaseline: string;
export let openProjectWithProjectReferencesBaseline: string;
export let openSqlProjectWithPrePostDeploymentError: string;
export let sqlProjectMissingVersionBaseline: string;
export let sqlProjectInvalidVersionBaseline: string;
export let sqlProjectCustomCollationBaseline: string;
export let sqlProjectInvalidCollationBaseline: string;
export let newSdkStyleProjectSdkNodeBaseline: string;
export let newSdkStyleProjectSdkProjectAttributeBaseline: string;
export let newStyleProjectSdkImportAttributeBaseline: string;
export let openSdkStyleSqlProjectBaseline: string;
export let openSdkStyleSqlProjectWithFilesSpecifiedBaseline: string;
export let openSdkStyleSqlProjectWithGlobsSpecifiedBaseline: string;
export let sqlProjPropertyReadBaseline: string;
export let databaseReferencesReadBaseline: string;

const baselineFolderPath = __dirname;

export async function loadBaselines() {
	newProjectFileBaseline = await loadBaseline(baselineFolderPath, 'newSqlProjectBaseline.xml');
	newProjectFileWithScriptBaseline = await loadBaseline(baselineFolderPath, 'newSqlProjectWithScriptBaseline.xml');
	openProjectFileBaseline = await loadBaseline(baselineFolderPath, 'openSqlProjectBaseline.xml');
	openDataSourcesBaseline = await loadBaseline(baselineFolderPath, 'openDataSourcesBaseline.json');
	SSDTProjectFileBaseline = await loadBaseline(baselineFolderPath, 'SSDTProjectBaseline.xml');
	SSDTUpdatedProjectBaseline = await loadBaseline(baselineFolderPath, 'SSDTUpdatedProjectBaseline.xml');
	SSDTProjectBaselineWithBeforeBuildTarget = await loadBaseline(baselineFolderPath, 'SSDTProjectBaselineWithBeforeBuildTarget.xml');
	publishProfileIntegratedSecurityBaseline = await loadBaseline(baselineFolderPath, 'publishProfileIntegratedSecurityBaseline.publish.xml');
	publishProfileSqlLoginBaseline = await loadBaseline(baselineFolderPath, 'publishProfileSqlLoginBaseline.publish.xml');
	publishProfileDefaultValueBaseline = await loadBaseline(baselineFolderPath, 'publishProfileDefaultValueBaseline.publish.xml');
	openProjectWithProjectReferencesBaseline = await loadBaseline(baselineFolderPath, 'openSqlProjectWithProjectReferenceBaseline.xml');
	openSqlProjectWithPrePostDeploymentError = await loadBaseline(baselineFolderPath, 'openSqlProjectWithPrePostDeploymentError.xml');
	sqlProjectMissingVersionBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectMissingVersionBaseline.xml');
	sqlProjectInvalidVersionBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectInvalidVersionBaseline.xml');
	sqlProjectCustomCollationBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectCustomCollationBaseline.xml');
	sqlProjectInvalidCollationBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectInvalidCollationBaseline.xml');
	newSdkStyleProjectSdkNodeBaseline = await loadBaseline(baselineFolderPath, 'newSdkStyleSqlProjectSdkNodeBaseline.xml');
	newSdkStyleProjectSdkProjectAttributeBaseline = await loadBaseline(baselineFolderPath, 'newSdkStyleSqlProjectSdkProjectAttributeBaseline.xml');
	newStyleProjectSdkImportAttributeBaseline = await loadBaseline(baselineFolderPath, 'newSdkStyleSqlProjectSdkImportAttributeBaseline.xml');
	openSdkStyleSqlProjectBaseline = await loadBaseline(baselineFolderPath, 'openSdkStyleSqlProjectBaseline.xml');
	openSdkStyleSqlProjectWithFilesSpecifiedBaseline = await loadBaseline(baselineFolderPath, 'openSdkStyleSqlProjectWithFilesSpecifiedBaseline.xml');
	openSdkStyleSqlProjectWithGlobsSpecifiedBaseline = await loadBaseline(baselineFolderPath, 'openSdkStyleSqlProjectWithGlobsSpecifiedBaseline.xml');
	sqlProjPropertyReadBaseline = await loadBaseline(baselineFolderPath, 'sqlProjPropertyRead.xml');
	databaseReferencesReadBaseline = await loadBaseline(baselineFolderPath, 'databaseReferencesReadBaseline.xml');
}

async function loadBaseline(baselineFolderPath: string, fileName: string): Promise<string> {
	return (await fs.readFile(path.join(baselineFolderPath, fileName))).toString();
}
