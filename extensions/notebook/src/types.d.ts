/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterController } from './jupyter/jupyterController';

/**
 * The API provided by this extension.
 *
 * @export
 */
export interface IExtensionApi {
	getJupyterController(): JupyterController;
}
