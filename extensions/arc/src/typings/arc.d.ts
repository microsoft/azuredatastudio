/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'arc' {
	import * as vscode from 'vscode';

	/**
	 * Covers defining what the arc extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */
	export const enum extension {
		name = 'Microsoft.arc'
	}

	export interface ITreeNode extends vscode.TreeItem {
		getChildren(): Thenable<ITreeNode[]>;
		openDashboard(): Thenable<void>;
	}

	export interface IAzureArcTreeDataProvider extends vscode.TreeDataProvider<ITreeNode> {

	}

	export interface IExtension {
		getAzureArcTreeDataProvider(): IAzureArcTreeDataProvider;
	}
}
