/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

/**
 * A tree node in the object explorer tree
 *
 * @export
 */
export interface ITreeNode {
	getNodeInfo(): azdata.NodeInfo;
	getChildren(refreshChildren: boolean): ITreeNode[] | Promise<ITreeNode[]>;
}

/**
 * A HDFS file node. This is a leaf node in the object explorer tree, and its contents
 * can be queried
 *
 * @export
 * @extends {ITreeNode}
 */
export interface IFileNode extends ITreeNode {
	getFileContentsAsString(maxBytes?: number): Promise<string>;
}
