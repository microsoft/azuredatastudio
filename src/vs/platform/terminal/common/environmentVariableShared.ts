/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEnvironmentDescriptionMutator, IEnvironmentVariableCollection, IEnvironmentVariableMutator, ISerializableEnvironmentDescriptionMap as ISerializableEnvironmentDescriptionMap, ISerializableEnvironmentVariableCollection, ISerializableEnvironmentVariableCollections } from 'vs/platform/terminal/common/environmentVariable';

// This file is shared between the renderer and extension host

export function serializeEnvironmentVariableCollection(collection: ReadonlyMap<string, IEnvironmentVariableMutator>): ISerializableEnvironmentVariableCollection {
	return [...collection.entries()];
}

export function serializeEnvironmentDescriptionMap(descriptionMap: ReadonlyMap<string, IEnvironmentDescriptionMutator> | undefined): ISerializableEnvironmentDescriptionMap {
	return descriptionMap ? [...descriptionMap.entries()] : [];
}

export function deserializeEnvironmentVariableCollection(
	serializedCollection: ISerializableEnvironmentVariableCollection
): Map<string, IEnvironmentVariableMutator> {
	return new Map<string, IEnvironmentVariableMutator>(serializedCollection);
}

export function deserializeEnvironmentDescriptionMap(
	serializableEnvironmentDescription: ISerializableEnvironmentDescriptionMap | undefined
): Map<string, IEnvironmentDescriptionMutator> {
	return new Map<string, IEnvironmentDescriptionMutator>(serializableEnvironmentDescription ?? []);
}

export function serializeEnvironmentVariableCollections(collections: ReadonlyMap<string, IEnvironmentVariableCollection>): ISerializableEnvironmentVariableCollections {
	return Array.from(collections.entries()).map(e => {
		return [e[0], serializeEnvironmentVariableCollection(e[1].map), serializeEnvironmentDescriptionMap(e[1].descriptionMap)];
	});
}

export function deserializeEnvironmentVariableCollections(
	serializedCollection: ISerializableEnvironmentVariableCollections
): Map<string, IEnvironmentVariableCollection> {
	return new Map<string, IEnvironmentVariableCollection>(serializedCollection.map(e => {
		return [e[0], { map: deserializeEnvironmentVariableCollection(e[1]), descriptionMap: deserializeEnvironmentDescriptionMap(e[2]) }];
	}));
}
