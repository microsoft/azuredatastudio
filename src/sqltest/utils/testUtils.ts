
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';

export async function assertThrowsAsync(fn, expectedMessage?: string): Promise<void> {
    var threw = false;
    try {
      await fn();
    } catch (e) {
      threw = true;
      if (expectedMessage) {
        assert.strictEqual(e.message, expectedMessage);
      }
    }
    assert.equal(threw, true, 'Expected function to throw but it did not');
}
