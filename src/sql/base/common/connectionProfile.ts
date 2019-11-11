/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepClone, assign } from 'vs/base/common/objects';
import { areIffyStringsEqual } from 'sql/base/common/strings';

/**
 * A concrete implementation of an IConnectionProfile with support for profile creation and validation
 */
export class ConnectionProfile implements ConnectionShape {

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

	public readonly databaseName?: string;
	public readonly serverName: string;
	public readonly userName?: string;
	public readonly password?: string;
	public readonly providerName: string;
	public readonly options?: { readonly [name: string]: boolean | string | number };
	public readonly authenticationType: string;
	public readonly connectionName?: string;

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
			&& this.serverName === shape.serverName
			&& areIffyStringsEqual(this.databaseName, shape.databaseName)
			&& areIffyStringsEqual(this.userName, shape.userName)
			&& this.authenticationType === shape.authenticationType;
	}

	public with(of: Partial<ConnectionShape>): ConnectionProfile {
		return new _ConnectionProfile(assign({}, of, this.toShape()));
	}

	public toShape(): ConnectionShape {
		return {
			providerName: this.providerName,
			connectionName: this.connectionName,
			serverName: this.serverName,
			databaseName: this.databaseName,
			userName: this.userName,
			password: this.password,
			authenticationType: this.authenticationType,
			options: deepClone(this.options)
		};
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
	connectionName?: string;
	serverName: string;
	databaseName?: string;
	userName?: string;
	password?: string;
	authenticationType: string;
	/**
	 * Represent *ADDITIONAL* options we may not know about;
	 * If it is a property of the interface inheritly, don't put it in the options bag
	 */
	options?: { [name: string]: boolean | string | number };
}

