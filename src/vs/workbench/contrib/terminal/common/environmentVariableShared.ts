/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEnvironmentVariableMutator, ISerializableEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariable';

// This file is shared between the renderer and extension host

export function serializeEnvironmentVariableCollection(collection: ReadonlyMap<string, IEnvironmentVariableMutator>): ISerializableEnvironmentVariableCollection {
	return [...collection.entries()];
}

export function deserializeEnvironmentVariableCollection(
	serializedCollection: ISerializableEnvironmentVariableCollection
): Map<string, IEnvironmentVariableMutator> {
	return new Map<string, IEnvironmentVariableMutator>(serializedCollection);
}
