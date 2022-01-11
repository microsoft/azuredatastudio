/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { homedir, tmpdir } from 'os';
import { NativeParsedArgs } from 'vs/platform/environment/common/argv';
import { AbstractNativeEnvironmentService } from 'vs/platform/environment/common/environmentService';
import { getUserDataPath } from 'vs/platform/environment/node/userDataPath';
import { IProductService } from 'vs/platform/product/common/productService';

export class NativeEnvironmentService extends AbstractNativeEnvironmentService {

	constructor(args: NativeParsedArgs, productService: IProductService) {
		super(args, {
			homeDir: homedir(),
			tmpDir: tmpdir(),
			userDataDir: getUserDataPath(args)
		}, productService);
	}
}
