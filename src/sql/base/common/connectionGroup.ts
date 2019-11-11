/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Connection } from 'sql/base/common/connection';
import { Emitter } from 'vs/base/common/event';

export class ConnectionGroup {

	private _onChange = new Emitter<void>();
	public readonly onChange = this._onChange.event;

	private _children: Set<Connection | ConnectionGroup> = new Set<Connection | ConnectionGroup>();
	public get children(): Array<Connection | ConnectionGroup> {
		return Array.from(this._children); // slice our array so people don't change it underneith us
	}

	public get parent(): string | undefined {
		return this._parent;
	}

	public get name(): string {
		return this._name;
	}

	public get id(): string {
		return this._id;
	}

	public get color(): string | undefined {
		return this._color;
	}

	public get description(): string | undefined {
		return this._description;
	}

	public constructor(
		private _name: string,
		private _id: string,
		private _parent?: string,
		private _color?: string,
		private _description?: string
	) { }

	public add(item: Connection | ConnectionGroup): void {
		this._children.add(item);
		this._onChange.fire();
	}

	public remove(item: Connection | ConnectionGroup): boolean {
		const ret = this._children.delete(item);
		if (ret) {
			this._onChange.fire();
		}
		return ret;
	}
}
