/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ROOT = path.join(__dirname, '../../../');

const shasum = crypto.createHash('sha1');

shasum.update(fs.readFileSync(path.join(ROOT, 'build/.cachesalt')));
shasum.update(fs.readFileSync(path.join(ROOT, '.build/commit')));
shasum.update(fs.readFileSync(path.join(ROOT, '.build/quality')));

process.stdout.write(shasum.digest('hex'));
