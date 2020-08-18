/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface Product {
	name: string;
	learnMoreLink: string | undefined;
	icon: string;
}

export interface SKURecommendation {
	product: Product;
	migratableDatabases: number;
	totalDatabases: number;
}
