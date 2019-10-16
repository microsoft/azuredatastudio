/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Type } from '@angular/core';

import * as platform from 'vs/platform/registry/common/platform';
import { ReadonlyJSONObject } from 'sql/workbench/parts/notebook/common/models/jsonext';
import { MimeModel } from 'sql/workbench/parts/notebook/browser/models/mimemodel';
import * as types from 'vs/base/common/types';
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';

export type FactoryIdentifier = string;

export const Extensions = {
	MimeComponentContribution: 'notebook.contributions.mimecomponents'
};

export interface IMimeComponent {
	bundleOptions: MimeModel.IOptions;
	mimeType: string;
	cellModel?: ICellModel;
	layout(): void;
}

export interface IMimeComponentDefinition {
	/**
	 * Whether the component is a "safe" component.
	 *
	 * #### Notes
	 * A "safe" component produces renderer widgets which can render
	 * untrusted model data in a usable way. *All* renderers must
	 * handle untrusted data safely, but some may simply failover
	 * with a "Run cell to view output" message. A "safe" renderer
	 * is an indication that its sanitized output will be useful.
	 */
	readonly safe: boolean;

	/**
	 * The mime types handled by this component.
	 */
	readonly mimeTypes: ReadonlyArray<string>;

	/**
	 * The angular selector for this component
	 */
	readonly selector: string;
	/**
	 * The default rank of the factory.  If not given, defaults to 100.
	 */
	readonly rank?: number;

	readonly ctor: Type<IMimeComponent>;
}

export type SafetyLevel = 'ensure' | 'prefer' | 'any';
type RankPair = { readonly id: number; readonly rank: number };

/**
 * A type alias for a mapping of mime type -> rank pair.
 */
type RankMap = { [key: string]: RankPair };

/**
 * A type alias for a mapping of mime type -> ordered factories.
 */
export type ComponentMap = { [key: string]: IMimeComponentDefinition };

export interface IMimeComponentRegistry {

	/**
	 * Add a MIME component to the registry.
	 *
	 * @param componentDefinition - The definition of this component including
	 * the constructor to initialize it, supported `mimeTypes`, and `rank` order
	 * of preference vs. other mime types.
	 * If no `rank` is given, it will default to 100.
	 *
	 * #### Notes
	 * The renderer will replace an existing renderer for the given
	 * mimeType.
	 */
	registerComponentType(componentDefinition: IMimeComponentDefinition): void;

	/**
	 * Find the preferred mime type for a mime bundle.
	 *
	 * @param bundle - The bundle of mime data.
	 *
	 * @param safe - How to consider safe/unsafe factories. If 'ensure',
	 *   it will only consider safe factories. If 'any', any factory will be
	 *   considered. If 'prefer', unsafe factories will be considered, but
	 *   only after the safe options have been exhausted.
	 *
	 * @returns The preferred mime type from the available factories,
	 *   or `undefined` if the mime type cannot be rendered.
	 */
	getPreferredMimeType(bundle: ReadonlyJSONObject, safe: SafetyLevel): string;
	getCtorFromMimeType(mimeType: string): Type<IMimeComponent>;
	getAllCtors(): Array<Type<IMimeComponent>>;
	getAllMimeTypes(): Array<string>;
}

class MimeComponentRegistry implements IMimeComponentRegistry {
	private _id = 0;
	private _ranks: RankMap = {};
	private _types: string[] | null = null;
	private _componentDefinitions: ComponentMap = {};

	registerComponentType(componentDefinition: IMimeComponentDefinition): void {
		let rank = !types.isUndefinedOrNull(componentDefinition.rank) ? componentDefinition.rank : 100;
		for (let mt of componentDefinition.mimeTypes) {
			this._componentDefinitions[mt] = componentDefinition;
			this._ranks[mt] = { rank, id: this._id++ };
		}
		this._types = null;
	}

	public getPreferredMimeType(bundle: ReadonlyJSONObject, safe: SafetyLevel = 'ensure'): string | undefined {
		// Try to find a safe factory first, if preferred.
		if (safe === 'ensure' || safe === 'prefer') {
			for (let mt of this.mimeTypes) {
				if (mt in bundle && this._componentDefinitions[mt].safe) {
					return mt;
				}
			}
		}

		if (safe !== 'ensure') {
			// Otherwise, search for the best factory among all factories.
			for (let mt of this.mimeTypes) {
				if (mt in bundle) {
					return mt;
				}
			}
		}

		// Otherwise, no matching mime type exists.
		return undefined;
	}

	public getCtorFromMimeType(mimeType: string): Type<IMimeComponent> {
		let componentDescriptor = this._componentDefinitions[mimeType];
		return componentDescriptor ? componentDescriptor.ctor : undefined;
	}

	public getAllCtors(): Array<Type<IMimeComponent>> {
		let addedCtors = [];
		let ctors = Object.values(this._componentDefinitions)
			.map((c: IMimeComponentDefinition) => c.ctor)
			.filter(ctor => {
				let shouldAdd = !addedCtors.find((ctor2) => ctor === ctor2);
				if (shouldAdd) {
					addedCtors.push(ctor);
				}
				return shouldAdd;
			});
		return ctors;
	}

	public getAllMimeTypes(): Array<string> {
		return Object.keys(this._componentDefinitions);
	}

	/**
	 * The ordered list of mimeTypes.
	 */
	get mimeTypes(): ReadonlyArray<string> {
		return this._types || (this._types = sortedTypes(this._ranks));
	}

}

const componentRegistry = new MimeComponentRegistry();
platform.Registry.add(Extensions.MimeComponentContribution, componentRegistry);

export function registerComponentType(componentDefinition: IMimeComponentDefinition): void {
	componentRegistry.registerComponentType(componentDefinition);
}


/**
 * Get the mime types in the map, ordered by rank.
 */
function sortedTypes(map: RankMap): string[] {
	return Object.keys(map).sort((a, b) => {
		let p1 = map[a];
		let p2 = map[b];
		if (p1.rank !== p2.rank) {
			return p1.rank - p2.rank;
		}
		return p1.id - p2.id;
	});
}
