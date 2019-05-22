/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';

export const ResourceDeploymentConfigurationName = 'resourceDeployment';
export const NotebookConfigurationName = 'resourceDeployment';
export const KubectlPathName = 'kubectlPath';

export function getConfiguration(section: string, config: string): string {
	return vscode.workspace.getConfiguration(section)[config];
}