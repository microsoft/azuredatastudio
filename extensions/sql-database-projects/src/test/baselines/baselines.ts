/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { promises as fs } from 'fs';

// Project baselines
export let newProjectFileBaseline: string;
export let newProjectFileWithScriptBaseline: string;
export let openProjectFileBaseline: string;
export let openDataSourcesBaseline: string;
export let SSDTProjectFileBaseline: string;
export let SSDTProjectAfterUpdateBaseline: string;
export let SSDTUpdatedProjectBaseline: string;
export let SSDTUpdatedProjectAfterSystemDbUpdateBaseline: string;
export let SSDTProjectBaselineWithBeforeBuildTarget: string;
export let SSDTProjectBaselineWithBeforeBuildTargetAfterUpdate: string;
export let publishProfileIntegratedSecurityBaseline: string;
export let publishProfileSqlLoginBaseline: string;
export let publishProfileDefaultValueBaseline: string;
export let openProjectWithProjectReferencesBaseline: string;
export let openSqlProjectWithPrePostDeploymentError: string;
export let openSqlProjectWithAdditionalSqlCmdVariablesBaseline: string;
export let sqlProjectMissingVersionBaseline: string;
export let sqlProjectInvalidVersionBaseline: string;
export let sqlProjectCustomCollationBaseline: string;
export let sqlProjectInvalidCollationBaseline: string;
export let newStyleProjectSdkNodeBaseline: string;
export let newStyleProjectSdkProjectAttributeBaseline: string;
export let newStyleProjectSdkImportAttributeBaseline: string;

const baselineFolderPath = __dirname;

export async function loadBaselines() {
	newProjectFileBaseline = await loadBaseline(baselineFolderPath, 'newSqlProjectBaseline.xml');
	newProjectFileWithScriptBaseline = await loadBaseline(baselineFolderPath, 'newSqlProjectWithScriptBaseline.xml');
	openProjectFileBaseline = await loadBaseline(baselineFolderPath, 'openSqlProjectBaseline.xml');
	openDataSourcesBaseline = await loadBaseline(baselineFolderPath, 'openDataSourcesBaseline.json');
	SSDTProjectFileBaseline = await loadBaseline(baselineFolderPath, 'SSDTProjectBaseline.xml');
	SSDTProjectAfterUpdateBaseline = await loadBaseline(baselineFolderPath, 'SSDTProjectAfterUpdateBaseline.xml');
	SSDTUpdatedProjectBaseline = await loadBaseline(baselineFolderPath, 'SSDTUpdatedProjectBaseline.xml');
	SSDTUpdatedProjectAfterSystemDbUpdateBaseline = await loadBaseline(baselineFolderPath, 'SSDTUpdatedProjectAfterSystemDbUpdateBaseline.xml');
	SSDTProjectBaselineWithBeforeBuildTarget = await loadBaseline(baselineFolderPath, 'SSDTProjectBaselineWithBeforeBuildTarget.xml');
	SSDTProjectBaselineWithBeforeBuildTargetAfterUpdate = await loadBaseline(baselineFolderPath, 'SSDTProjectBaselineWithBeforeBuildTargetAfterUpdate.xml');
	publishProfileIntegratedSecurityBaseline = await loadBaseline(baselineFolderPath, 'publishProfileIntegratedSecurityBaseline.publish.xml');
	publishProfileSqlLoginBaseline = await loadBaseline(baselineFolderPath, 'publishProfileSqlLoginBaseline.publish.xml');
	publishProfileDefaultValueBaseline = await loadBaseline(baselineFolderPath, 'publishProfileDefaultValueBaseline.publish.xml');
	openProjectWithProjectReferencesBaseline = await loadBaseline(baselineFolderPath, 'openSqlProjectWithProjectReferenceBaseline.xml');
	openSqlProjectWithPrePostDeploymentError = await loadBaseline(baselineFolderPath, 'openSqlProjectWithPrePostDeploymentError.xml');
	openSqlProjectWithAdditionalSqlCmdVariablesBaseline = await loadBaseline(baselineFolderPath, 'openSqlProjectWithAdditionalSqlCmdVariablesBaseline.xml');
	sqlProjectMissingVersionBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectMissingVersionBaseline.xml');
	sqlProjectInvalidVersionBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectInvalidVersionBaseline.xml');
	sqlProjectCustomCollationBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectCustomCollationBaseline.xml');
	sqlProjectInvalidCollationBaseline = await loadBaseline(baselineFolderPath, 'sqlProjectInvalidCollationBaseline.xml');
	newStyleProjectSdkNodeBaseline = await loadBaseline(baselineFolderPath, 'newStyleSqlProjectSdkNodeBaseline.xml');
	newStyleProjectSdkProjectAttributeBaseline = await loadBaseline(baselineFolderPath, 'newStyleSqlProjectSdkProjectAttributeBaseline.xml');
	newStyleProjectSdkImportAttributeBaseline = await loadBaseline(baselineFolderPath, 'newStyleSqlProjectSdkImportAttributeBaseline.xml');
}

async function loadBaseline(baselineFolderPath: string, fileName: string): Promise<string> {
	return (await fs.readFile(path.join(baselineFolderPath, fileName))).toString();
}
