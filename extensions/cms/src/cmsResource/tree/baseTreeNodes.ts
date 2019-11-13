/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AppContext } from '../../appContext';
import { TreeNode } from '../treeNode';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { generateGuid } from '../utils';

export abstract class CmsResourceTreeNodeBase extends TreeNode {

	protected _id: string = undefined;

	public constructor(
		private _name: string,
		private _description: string,
		protected _ownerUri: string,
		public readonly appContext: AppContext,
		public readonly treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super();
		this.parent = parent;
		this._id = generateGuid();
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

export interface ICmsResourceNodeInfo {
	name: string;
	description: string;
	ownerUri: string;
	connection: azdata.connection.Connection;
}
