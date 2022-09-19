/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as _ from 'sql/base/parts/tree/browser/tree';

export function isEqualOrParent(tree: _.ITree, element: any, candidateParent: any): boolean {
	const nav = tree.getNavigator(element);

	do {
		if (element === candidateParent) {
			return true;
		}
	} while (element = nav.parent()); // eslint-disable-line no-cond-assign

	return false;
}
