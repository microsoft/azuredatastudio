/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseProjectItemType } from '../../common/constants';

/**
 * Base class for an item that appears in the ADS project tree
 */
export abstract class BaseProjectTreeItem {
	/**
	 * Constructor
	 * @param relativeProjectUri Project-relative URI that's compatible with the project tree
	 * @param projectFileUri Full URI to the .sqlproj of this project
	 */
	constructor(public relativeProjectUri: vscode.Uri, public projectFileUri: vscode.Uri) { }

	abstract get children(): BaseProjectTreeItem[];

	abstract get treeItem(): vscode.TreeItem;

	abstract get type(): DatabaseProjectItemType;

	public entryKey?: string;

	public get friendlyName(): string {
		return path.parse(this.relativeProjectUri.path).base;
	}
}
