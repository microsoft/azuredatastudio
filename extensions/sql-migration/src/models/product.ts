/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export type MigrationProductType = 'AzureSQLMI' | 'AzureSQLVM';
export interface MigrationProduct {
	readonly type: MigrationProductType;
}

export interface Check {

}

export interface Checks {
	// fill some information
	checks: Check;
	// If there is not going to be any more information, use Check[] directly
}

export interface Product extends MigrationProduct {
	readonly name: string;
	readonly learnMoreLink?: string;
	readonly icon?: string;
}

export class Product implements Product {
	constructor(public readonly type: MigrationProductType, public readonly name: string, public readonly icon?: string, public readonly learnMoreLink?: string) {

	}

	static FromMigrationProduct(migrationProduct: MigrationProduct) {
		// TODO: populatie from some lookup table;

		const product: Product | undefined = ProductLookupTable[migrationProduct.type];
		return new Product(migrationProduct.type, product?.name ?? '', product.icon ?? '');
	}
}

export interface SKURecommendation {
	product: MigrationProduct;
	checks: Checks;
}


export const ProductLookupTable: { [key in MigrationProductType]: Product } = {
	'AzureSQLMI': {
		type: 'AzureSQLMI',
		name: localize('sql.migration.products.azuresqlmi.name', 'Azure Managed Instance (Microsoft managed)'),
	},
	'AzureSQLVM': {
		type: 'AzureSQLVM',
		name: localize('sql.migration.products.azuresqlvm.name', 'Azure SQL Virtual Machine (Customer managed)'),
	}
};
