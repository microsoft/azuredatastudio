/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import { IProcessEnvironment } from 'vs/base/common/platform';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { VariableResolver } from 'vs/workbench/contrib/terminal/common/terminalEnvironment';

export const IEnvironmentVariableService = createDecorator<IEnvironmentVariableService>('environmentVariableService');

export enum EnvironmentVariableMutatorType {
	Replace = 1,
	Append = 2,
	Prepend = 3
}

export interface IEnvironmentVariableMutator {
	readonly value: string;
	readonly type: EnvironmentVariableMutatorType;
}

export interface IExtensionOwnedEnvironmentVariableMutator extends IEnvironmentVariableMutator {
	readonly extensionIdentifier: string;
}

export interface IEnvironmentVariableCollection {
	readonly map: ReadonlyMap<string, IEnvironmentVariableMutator>;
}

export interface IEnvironmentVariableCollectionWithPersistence extends IEnvironmentVariableCollection {
	readonly persistent: boolean;
}

export interface IMergedEnvironmentVariableCollectionDiff {
	added: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>;
	changed: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>;
	removed: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>;
}

/**
 * Represents an environment variable collection that results from merging several collections
 * together.
 */
export interface IMergedEnvironmentVariableCollection {
	readonly collections: ReadonlyMap<string, IEnvironmentVariableCollection>;
	readonly map: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>;

	/**
	 * Applies this collection to a process environment.
	 * @param variableResolver An optional function to use to resolve variables within the
	 * environment values.
	 */
	applyToProcessEnvironment(env: IProcessEnvironment, variableResolver?: VariableResolver): Promise<void>;

	/**
	 * Generates a diff of this connection against another. Returns undefined if the collections are
	 * the same.
	 */
	diff(other: IMergedEnvironmentVariableCollection): IMergedEnvironmentVariableCollectionDiff | undefined;
}

/**
 * Tracks and persists environment variable collections as defined by extensions.
 */
export interface IEnvironmentVariableService {
	readonly _serviceBrand: undefined;

	/**
	 * Gets a single collection constructed by merging all environment variable collections into
	 * one.
	 */
	readonly collections: ReadonlyMap<string, IEnvironmentVariableCollection>;

	/**
	 * Gets a single collection constructed by merging all environment variable collections into
	 * one.
	 */
	readonly mergedCollection: IMergedEnvironmentVariableCollection;

	/**
	 * An event that is fired when an extension's environment variable collection changes, the event
	 * provides the new merged collection.
	 */
	onDidChangeCollections: Event<IMergedEnvironmentVariableCollection>;

	/**
	 * Sets an extension's environment variable collection.
	 */
	set(extensionIdentifier: string, collection: IEnvironmentVariableCollection): void;

	/**
	 * Deletes an extension's environment variable collection.
	 */
	delete(extensionIdentifier: string): void;
}

/** [variable, mutator] */
export type ISerializableEnvironmentVariableCollection = [string, IEnvironmentVariableMutator][];

/** [extension, collection] */
export type ISerializableEnvironmentVariableCollections = [string, ISerializableEnvironmentVariableCollection][];

export interface IEnvironmentVariableInfo {
	readonly requiresAction: boolean;
	getInfo(): string;
	getIcon(): ThemeIcon;
	getActions?(): {
		label: string;
		commandId: string;
		iconClass?: string;
		run(target: any): void;
	}[];
}
