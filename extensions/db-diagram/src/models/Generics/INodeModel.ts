/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/



export default interface INodeModel {

	//Name of the node
	name: string;
	//Summary of the node
	summary: string;
	//Map containing related tables pointing to cardinalities,
	//<Connected Node, Relationship Information>
	relationships: Map<INodeModel, JSON>;

	getName(): string;
	getSummary(): string;
	getRelationships(): Map<INodeModel, JSON>;


}
