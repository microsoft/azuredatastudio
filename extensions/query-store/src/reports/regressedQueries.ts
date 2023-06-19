/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryStoreReport } from './common/queryStoreReport';


export class RegressedQueries extends QueryStoreReport {
	constructor(extensionContext: vscode.ExtensionContext) {
		super('Regressed Queries', 'Top 25 regressed queries for database WideWorldImporters', extensionContext);
	}

	public override async open(): Promise<void> {
		await super.open();
	}
}
