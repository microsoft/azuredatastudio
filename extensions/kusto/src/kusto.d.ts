/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for extensions to expose APIs.

import * as azdata from 'azdata';

/**
* The APIs provided by Kusto extension
*/
export interface IExtension {
	/**
	 * Gets the object explorer API that supports querying over the connections supported by this extension
	 *
	 */
	getKustoObjectExplorerBrowser(): KustoObjectExplorerBrowser;
}

/**
 * A browser supporting actions over the object explorer connections provided by this extension.
 * Currently this is the
 */
export interface KustoObjectExplorerBrowser {
	/**
	 * Gets the matching node given a context object, e.g. one from a right-click on a node in Object Explorer
	 */
	getNode<T extends ITreeNode>(objectExplorerContext: azdata.ObjectExplorerContext): Thenable<T>;
}

/**
 * A tree node in the object explorer tree
 */
export interface ITreeNode {
	getNodeInfo(): azdata.NodeInfo;
	getChildren(refreshChildren: boolean): ITreeNode[] | Thenable<ITreeNode[]>;
}
