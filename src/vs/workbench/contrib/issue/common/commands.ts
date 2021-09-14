/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const OpenIssueReporterActionId = 'workbench.action.openIssueReporter';

export const OpenIssueReporterApiCommandId = 'vscode.openIssueReporter';

export interface OpenIssueReporterArgs {
	readonly extensionId?: string;
	readonly issueTitle?: string;
	readonly issueBody?: string;
}
