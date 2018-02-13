/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';

import { registerTask } from 'sql/platform/tasks/taskRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

interface ITaskContrib {

}

const taskContribSchema: IJSONSchema = {

};

ExtensionsRegistry.registerExtensionPoint<ITaskContrib | ITaskContrib[]>('insights', [], taskContribSchema).setHandler(extensions => {

	function handleCommand(insight: ITaskContrib, extension: IExtensionPointUser<any>) {


	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<ITaskContrib>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
