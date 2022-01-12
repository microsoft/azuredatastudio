/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SingleUseTestCollection } from 'vs/workbench/contrib/testing/common/ownedTestCollection';
import { TestsDiff } from 'vs/workbench/contrib/testing/common/testCollection';

export class TestSingleUseCollection extends SingleUseTestCollection {
	public get currentDiff() {
		return this.diff;
	}

	public setDiff(diff: TestsDiff) {
		this.diff = diff;
	}
}
