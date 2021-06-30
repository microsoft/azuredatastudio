/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileAccess } from 'vs/base/common/network';
import { isWeb, globals } from 'vs/base/common/platform';
import { env } from 'vs/base/common/process';
import { dirname, joinPath } from 'vs/base/common/resources';
import { IProductConfiguration } from 'vs/base/common/product';
import { ISandboxConfiguration } from 'vs/base/parts/sandbox/common/sandboxTypes';

let product: IProductConfiguration;

// Native sandbox environment
if (typeof globals.vscode !== 'undefined' && typeof globals.vscode.context !== 'undefined') {
	const configuration: ISandboxConfiguration | undefined = globals.vscode.context.configuration();
	if (configuration) {
		product = configuration.product;
	} else {
		throw new Error('Sandbox: unable to resolve product configuration from preload script.');
	}
}

// Native node.js environment
else if (typeof require?.__$__nodeRequire === 'function') {

	// Obtain values from product.json and package.json
	const rootPath = dirname(FileAccess.asFileUri('', require));

	product = require.__$__nodeRequire(joinPath(rootPath, 'product.json').fsPath);
	const pkg = require.__$__nodeRequire(joinPath(rootPath, 'package.json').fsPath) as { version: string; };

	// Running out of sources
	if (env['VSCODE_DEV']) {
		Object.assign(product, {
			nameShort: `${product.nameShort} Dev`,
			nameLong: `${product.nameLong} Dev`,
			dataFolderName: `${product.dataFolderName}-dev`
		});
	}

	Object.assign(product, {
		version: pkg.version
	});
}

// Web environment or unknown
else {

	// Built time configuration (do NOT modify)
	product = { /*BUILD->INSERT_PRODUCT_CONFIGURATION*/ } as IProductConfiguration;

	// Running out of sources
	if (Object.keys(product).length === 0) {
		Object.assign(product, {
			version: '1.27.0-dev',
			vscodeVersion: '1.53.0-dev',
			nameLong: isWeb ? 'Azure Data Studio Web Dev' : 'Azure Data Studio Dev',
			nameShort: isWeb ? 'Azure Data Studio Web Dev' : 'Azure Data Studio Dev',
			applicationName: 'azuredatastudio-oss',
			dataFolderName: '.azuredatastudio-oss',
			urlProtocol: 'azuredatastudio-oss',
			reportIssueUrl: 'https://github.com/microsoft/azuredatastudio/issues/new',
			licenseName: 'MIT',
			licenseUrl: 'https://github.com/microsoft/azuredatastudio/blob/master/LICENSE.txt',
			extensionAllowedProposedApi: [
				'ms-vscode.vscode-js-profile-flame',
				'ms-vscode.vscode-js-profile-table',
				'ms-vscode.remotehub',
				'ms-vscode.remotehub-insiders',
				'GitHub.remotehub',
				'GitHub.remotehub-insiders'
			],
		});
	}
}

export default product;
