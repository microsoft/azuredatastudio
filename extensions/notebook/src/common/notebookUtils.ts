/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as crypto from 'crypto';

/**
 * Creates a random token per https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback.
 * Defaults to 24 bytes, which creates a 48-char hex string
 */
export function getRandomToken(size: number = 24): Promise<string> {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(size, (err, buffer) => {
			if (err) {
				reject(err);
			}
			let token = buffer.toString('hex');
			resolve(token);
		});
	});
}
