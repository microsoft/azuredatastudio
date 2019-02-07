/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for extensions to expose APIs.

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

/**
* The APIs provided by Mssql extension
*
* @export
* @interface MssqlExtensionApi
*/
export interface MssqlExtensionApi {
	/**
	 * Gets the object explorer API that supports querying over the connections supported by this extension
	 *
	 * @returns {IMssqlObjectExplorerBrowser}
	 * @memberof IMssqlExtensionApi
	 */
	getMssqlObjectExplorerBrowser(): MssqlObjectExplorerBrowser;
}

/**
 * A browser supporting actions over the object explorer connections provided by this extension.
 * Currently this is the
 *
 * @export
 * @interface MssqlObjectExplorerBrowser
 */
export interface MssqlObjectExplorerBrowser {
	/**
	 * Gets the matching node given a context object, e.g. one from a right-click on a node in Object Explorer
	 *
	 * @param {sqlops.ObjectExplorerContext} objectExplorerContext
	 * @returns {Promise<T>}
	 */
	getNode<T extends ITreeNode>(objectExplorerContext: sqlops.ObjectExplorerContext): Promise<T>;
}

/**
 * A tree node in the object explorer tree
 *
 * @export
 * @interface ITreeNode
 */
export interface ITreeNode {
	getNodeInfo(): sqlops.NodeInfo;
	getChildren(refreshChildren: boolean): ITreeNode[] | Promise<ITreeNode[]>;
}

/**
 * A HDFS file node. This is a leaf node in the object explorer tree, and its contents
 * can be queried
 *
 * @export
 * @interface IFileNode
 * @extends {ITreeNode}
 */
export interface IFileNode extends ITreeNode {
	getFileContentsAsString(maxBytes?: number): Promise<string>;
}
