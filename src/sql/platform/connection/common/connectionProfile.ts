/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { equalsIgnoreCase } from 'vs/base/common/strings';
import { NotImplementedError } from 'vs/base/common/errors';
import { deepClone } from 'vs/base/common/objects';

/**
 * A concrete implementation of an IConnectionProfile with support for profile creation and validation
 */
export class ConnectionProfile implements ConnectionShape {

	public readonly databaseName?: string;
	public readonly serverName: string;
	public readonly userName: string;
	public readonly password?: string;
	public readonly providerName: string;
	public readonly options: { readonly [name: string]: any };
	public readonly authenticationType: string;
	public readonly connectionName: string;

	protected constructor(shape: ConnectionShape) {
		this.databaseName = shape.databaseName;
		this.serverName = shape.serverName;
		this.userName = shape.userName;
		this.password = shape.password;
		this.providerName = shape.providerName;
		this.options = Object.freeze(deepClone(shape.options));
		this.authenticationType = shape.authenticationType;
		this.connectionName = shape.connectionName;
	}

	public matches(shape: ConnectionShape): boolean {
		return shape
			&& this.providerName === shape.providerName
			&& this.nullCheckEqualsIgnoreCase(this.serverName, shape.serverName)
			&& this.nullCheckEqualsIgnoreCase(this.databaseName, shape.databaseName)
			&& this.nullCheckEqualsIgnoreCase(this.userName, shape.userName)
			&& this.nullCheckEqualsIgnoreCase(this.options['databaseDisplayName'], shape.options['databaseDisplayName'])
			&& this.authenticationType === shape.authenticationType;
	}

	private nullCheckEqualsIgnoreCase(a: string, b: string) {
		let bothNull: boolean = !a && !b;
		return bothNull ? bothNull : equalsIgnoreCase(a, b);
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

	/**
	 * Creates a string repsentation of this profile
	 */
	public toString(): string {
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
	providerName: string;
	connectionName: string;
	serverName: string;
	databaseName?: string;
	userName: string;
	password?: string;
	authenticationType: string;
	options: { [name: string]: any };
}
