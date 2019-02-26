
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';

export async function assertThrowsAsync(fn, regExp?: any): Promise<void> {
    let f = () => {
        // Empty
    };
    try {
      await fn();
    } catch (e) {
      f = () => { throw e; };
    } finally {
      assert.throws(f, regExp);
    }
}
