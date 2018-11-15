/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';
import * as os from 'os';
import * as pfs from 'vs/base/node/pfs';
import { localize } from 'vs/nls';
import { IOutputChannel } from 'vs/workbench/parts/output/common/output';


/**
 * Test whether an output is from a stream.
 */
export function isStream(output: nb.ICellOutput): output is nb.IStreamResult {
	return output.output_type === 'stream';
}

export function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

export function getUserHome(): string {
	return process.env.HOME || process.env.USERPROFILE;
}

export async function mkDir(dirPath: string, outputChannel?: IOutputChannel): Promise<void> {
	let exists = await pfs.dirExists(dirPath);
	if (!exists) {
		if (outputChannel) {
			outputChannel.append(localize('mkdirOutputMsg', '... Creating {0}', dirPath) + os.EOL);
		}
		await pfs.mkdirp(dirPath);
	}
}
