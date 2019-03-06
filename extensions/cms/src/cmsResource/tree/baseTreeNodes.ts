/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as azdata from 'azdata';
import { AppContext } from '../../appContext';
import { TreeNode } from '../treeNode';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';

export abstract class CmsResourceTreeNodeBase extends TreeNode {

	public constructor(
		private _name: string,
		private _description: string,
		private _ownerUri: string,
		public readonly appContext: AppContext,
		public readonly treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super();
		this.parent = parent;
	}

	public get name(): string {
		return this._name;
	}

	public get description(): string {
		return this._description;
	}

	public get ownerUri(): string {
		return this._ownerUri;
	}
}

export interface CmsResourceNodeInfo {
	name: string;
	description: string;
	ownerUri: string;
	connection: azdata.connection.Connection;
}