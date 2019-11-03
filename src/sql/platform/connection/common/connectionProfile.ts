/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { equalsIgnoreCase } from 'vs/base/common/strings';
import { generateUuid } from 'vs/base/common/uuid';
import { NotImplementedError } from 'vs/base/common/errors';

/**
 * A concrete implementation of an IConnectionProfile with support for profile creation and validation
 */
export class ConnectionProfile implements ConnectionShape {

	public parent?: ConnectionProfileGroup;
	private _id: string;
	public savePassword: boolean;
	private _groupName?: string;
	public groupId: string;
	public saveProfile: boolean;

	public isDisconnecting: boolean = false;

	protected constructor(shape: ConnectionShape) {
	}

	public matches(shape: ConnectionShape): boolean {
		return shape
			&& this.providerName === shape.providerName
			&& this.nullCheckEqualsIgnoreCase(this.serverName, shape.serverName)
			&& this.nullCheckEqualsIgnoreCase(this.databaseName, shape.databaseName)
			&& this.nullCheckEqualsIgnoreCase(this.userName, shape.userName)
			&& this.nullCheckEqualsIgnoreCase(this.options['databaseDisplayName'], shape.options['databaseDisplayName'])
			&& this.authenticationType === shape.authenticationType
			&& this.groupId === shape.groupId;
	}

	private nullCheckEqualsIgnoreCase(a: string, b: string) {
		let bothNull: boolean = !a && !b;
		return bothNull ? bothNull : equalsIgnoreCase(a, b);
	}

	public getParent(): ConnectionProfileGroup | undefined {
		return this.parent;
	}

	public get id(): string {
		if (!this._id) {
			this._id = generateUuid();
		}
		return this._id;
	}

	public set id(value: string) {
		this._id = value;
	}

	public get azureTenantId(): string | undefined {
		return this.options['azureTenantId'];
	}

	public set azureTenantId(value: string | undefined) {
		this.options['azureTenantId'] = value;
	}

	public get registeredServerDescription(): string {
		return this.options['registeredServerDescription'];
	}

	public set registeredServerDescription(value: string) {
		this.options['registeredServerDescription'] = value;
	}

	public get groupFullName(): string | undefined {
		return this._groupName;
	}

	public set groupFullName(value: string | undefined) {
		this._groupName = value;
	}

	public get isAddedToRootGroup(): boolean {
		return (this._groupName === ConnectionProfile.RootGroupName);
	}

	public static from(profile: ConnectionProfile | undefined | null): ConnectionProfile | undefined;
	public static from(shape: ConnectionShape | undefined | null): ConnectionProfile | undefined;
	public static from(from: ConnectionShape | ConnectionProfile | undefined | null): ConnectionProfile | undefined {
		if (from) {
			if (from instanceof ConnectionProfile) {
				return from;
			}
			return new _ConnectionProfile(from);
		} else {
			return undefined;
		}
	}

	public static with(of: { [T in keyof ConnectionShape]: ConnectionShape[T] }): ConnectionProfile {
		throw new NotImplementedError();
	}
}

// tslint:disable-next-line:class-name
class _ConnectionProfile extends ConnectionProfile {
	constructor(shape: ConnectionShape) {
		super(shape);
	}
}

export interface ConnectionShape {

}
