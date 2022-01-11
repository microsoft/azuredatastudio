/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { ILog } from 'vs/workbench/services/extensions/common/extensionPoints';
import { localize } from 'vs/nls';

export function dedupExtensions(system: IExtensionDescription[], user: IExtensionDescription[], development: IExtensionDescription[], log: ILog): IExtensionDescription[] {
	let result = new Map<string, IExtensionDescription>();
	system.forEach((systemExtension) => {
		const extensionKey = ExtensionIdentifier.toKey(systemExtension.identifier);
		const extension = result.get(extensionKey);
		if (extension) {
			log.warn(systemExtension.extensionLocation.fsPath, localize('overwritingExtension', "Overwriting extension {0} with {1}.", extension.extensionLocation.fsPath, systemExtension.extensionLocation.fsPath));
		}
		result.set(extensionKey, systemExtension);
	});
	user.forEach((userExtension) => {
		const extensionKey = ExtensionIdentifier.toKey(userExtension.identifier);
		const extension = result.get(extensionKey);
		if (extension) {
			log.warn(userExtension.extensionLocation.fsPath, localize('overwritingExtension', "Overwriting extension {0} with {1}.", extension.extensionLocation.fsPath, userExtension.extensionLocation.fsPath));
		}
		result.set(extensionKey, userExtension);
	});
	development.forEach(developedExtension => {
		log.info('', localize('extensionUnderDevelopment', "Loading development extension at {0}", developedExtension.extensionLocation.fsPath));
		const extensionKey = ExtensionIdentifier.toKey(developedExtension.identifier);
		result.set(extensionKey, developedExtension);
	});
	let r: IExtensionDescription[] = [];
	result.forEach((value) => r.push(value));
	return r;
}
