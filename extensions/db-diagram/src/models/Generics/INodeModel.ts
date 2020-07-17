/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/



export default interface INodeModel {

	name: string;
	summary: string;
	relationships: Map<INodeModel, JSON>;
	metadata: JSON;

}
