/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IconPathHelper, IconPath } from '../iconHelper';

/**
 * The permission status of an HDFS path - this consists of :
 * 	- The sticky bit for that path
 * 	- The permission bits for the owner, group and other
 * 	- (Optional) Set of additional ACL entries on this path
 */
export class PermissionStatus {
	/**
	 *
	 * @param owner The ACL entry object for the owner permissions
	 * @param group The ACL entry object for the group permissions
	 * @param other The ACL entry object for the other permissions
	 * @param stickyBit The sticky bit status for the object. If true the owner/root are
	 * the only ones who can delete the resource or its contents (if a folder)
	 * @param aclEntries The ACL entries defined for the object
	 */
	constructor(public owner: AclEntry, public group: AclEntry, public other: AclEntry, public stickyBit: boolean, public aclEntries: AclEntry[]) { }

	/**
	 * The permission octal for the path in the form [#]### with each # mapping to :
	 *	0 (optional) - The sticky bit (1 or 0)
	 *	1 - The owner permission digit
	 *	2 - The group permission digit
	 *	3 - The other permission digit
	 *	@see AclEntryPermission for more information on the permission digits
	 */
	public get permissionOctal(): string {
		return `${this.stickyBit ? '1' : ''}${this.owner.permissionDigit}${this.group.permissionDigit}${this.other.permissionDigit}`;
	}
}

/**
 * The type of an ACL entry. Corresponds to the first (or second if a scope is present) field of
 * an ACL entry - e.g. user:bob:rwx (user) or default:group::r-- (group)
 */
export enum AclType {
	/**
	 * An ACL entry applied to a specific user.
	 */
	user = 'user',
	/**
	 * An ACL entry applied to a specific group.
	 */
	group = 'group',
	/**
	 * An ACL mask entry.
	 */
	mask = 'mask',
	/**
	 * An ACL entry that applies to all other users that were not covered by one of the more specific ACL entry types.
	 */
	other = 'other'
}

/**
 * The type of permission on a file - this corresponds to the field in the file status used in commands such as chmod.
 * Typically this value is represented as a 3 digit octal - e.g. 740 - where the first digit is the owner, the second
 * the group and the third other. @see parseAclPermissionFromOctal
 */
export enum PermissionType {
	owner = 'owner',
	group = 'group',
	other = 'other'
}

export enum AclEntryScope {
	/**
	 * An ACL entry that is inspected during permission checks to enforce permissions.
	 */
	access = 'access',
	/**
	 * An ACL entry to be applied to a directory's children that do not otherwise have their own ACL defined.
	 */
	default = 'default'
}

/**
 * The read, write and execute permissions for an ACL
 */
export class AclEntryPermission {

	constructor(public read: boolean, public write: boolean, public execute: boolean) { }

	/**
	 * Returns the string representation of the permissions in the form [r-][w-][x-].
	 * e.g.
	 * 	rwx
	 *  r--
	 *  ---
	 */
	public toString() {
		return `${this.read ? 'r' : '-'}${this.write ? 'w' : '-'}${this.execute ? 'x' : '-'}`;
	}

	/**
	 * Gets the digit for a permission octal for this permission. This digit is a value
	 * between 0 and 7 inclusive, which is a bitwise OR the permission flags (r/w/x).
	 */
	public get permissionDigit(): number {
		return (this.read ? 4 : 0) + (this.write ? 2 : 0) + (this.execute ? 1 : 0);
	}
}

/**
 * Parses a string representation of a permission into an AclPermission object. The string must consist
 * of 3 characters for the read, write and execute permissions where each character is either a r/w/x or
 * a -.
 * e.g. The following are all valid strings
 *		rwx
 *		---
 *		-w-
 * @param permissionString The string representation of the permission
 */
function parseAclPermission(permissionString: string): AclEntryPermission {
	permissionString = permissionString.toLowerCase();
	if (!/^[r\-][w\-][x\-]$/i.test(permissionString)) {
		throw new Error(`Invalid permission string ${permissionString}- must match /^[r\-][w\-][x\-]$/i`);
	}
	return new AclEntryPermission(permissionString[0] === 'r', permissionString[1] === 'w', permissionString[2] === 'x');
}

/**
 * A single ACL Permission entry
 *  scope - The scope of the entry @see AclEntryScope
 *  type - The type of the entry @see AclEntryType
 *  name - The name of the user/group used to set ACLs Optional.
 *  displayName - The name to display in the UI
 *  permission - The permission set for this ACL. @see AclPermission
 */
export class AclEntry {
	constructor(
		public readonly scope: AclEntryScope,
		public readonly type: AclType | PermissionType,
		public readonly name: string,
		public readonly displayName: string,
		public readonly permission: AclEntryPermission,
	) { }

	/**
	 * Gets the octal number representing the permission for this entry. This digit is a value
	 * between 0 and 7 inclusive, which is a bitwise OR the permission flags (r/w/x).
	 */
	public get permissionDigit(): number {
		return this.permission.permissionDigit;
	}
	/**
	 * Returns the string representation of the ACL Entry in the form [SCOPE:]TYPE:NAME:PERMISSION.
	 * Note that SCOPE is only displayed if it's default - access is implied if there is no scope
	 * specified.
	 * The name is optional and so may be empty.
	 * Example strings :
	 *		user:bob:rwx
	 *		default:user:bob:rwx
	 *		user::r-x
	 *		default:group::r--
	 */
	toAclString(): string {
		return `${this.scope === AclEntryScope.default ? 'default:' : ''}${getAclEntryType(this.type)}:${this.name}:${this.permission.toString()}`;
	}

	/**
	 * Checks whether this and the specified AclEntry are equal. Two entries are considered equal
	 * if their scope, type and name are equal.
	 * @param other The other entry to compare against
	 */
	public isEqual(other: AclEntry): boolean {
		if (!other) {
			return false;
		}
		return this.scope === other.scope &&
			this.type === other.type &&
			this.name === other.name;
	}
}

/**
 * Maps the possible entry types into their corresponding values for using in an ACL string
 * @param type The type to convert
 */
function getAclEntryType(type: AclType | PermissionType): AclType {
	// We only need to map AclPermissionType - AclEntryType is already the
	// correct values we're mapping to.
	if (type in PermissionType) {
		switch (type) {
			case PermissionType.owner:
				return AclType.user;
			case PermissionType.group:
				return AclType.group;
			case PermissionType.other:
				return AclType.other;
			default:
				throw new Error(`Unknown AclPermissionType : ${type}`);
		}
	}
	return <AclType>type;
}

/**
 * Parses a complete ACL string into separate AclEntry objects for each entry. A valid string consists of multiple entries
 * separated by a comma.
 *
 * A valid entry must match (default:)?(user|group|mask|other):[[A-Za-z_][A-Za-z0-9._-]]*:([rwx-]{3})
 * e.g. the following are all valid entries
 *		user:bob:rwx
 *		user::rwx
 *		default::bob:rwx
 *		group::r-x
 *		default:other:r--
 *
 * So a valid ACL string might look like this
 *		user:bob:rwx,user::rwx,default::bob:rwx,group::r-x,default:other:r--
 * @param aclString The string representation of the ACL
 */
export function parseAcl(aclString: string): AclEntry[] {
	if (!/^(default:)?(user|group|mask|other):([A-Za-z_][A-Za-z0-9._-]*)?:([rwx-]{3})?(,(default:)?(user|group|mask|other):([A-Za-z_][A-Za-z0-9._-]*)?:([rwx-]{3})?)*$/.test(aclString)) {
		throw new Error(`Invalid ACL string ${aclString}. Expected to match ^(default:)?(user|group|mask|other):[[A-Za-z_][A-Za-z0-9._-]]*:([rwx-]{3})?(,(default:)?(user|group|mask|other):[[A-Za-z_][A-Za-z0-9._-]]*:([rwx-]{3})?)*$`);
	}
	return aclString.split(',').map(aclEntryString => parseAclEntry(aclEntryString));
}

/**
 * Parses a given string representation of an ACL Entry into an AclEntry object. This method
 * assumes the string has already been checked for validity.
 * @param aclString The string representation of the ACL entry
 */
export function parseAclEntry(aclString: string): AclEntry {
	const parts: string[] = aclString.split(':');
	let i = 0;
	const scope: AclEntryScope = parts.length === 4 && parts[i++] === 'default' ? AclEntryScope.default : AclEntryScope.access;
	let type: AclType;
	switch (parts[i++]) {
		case 'user':
			type = AclType.user;
			break;
		case 'group':
			type = AclType.group;
			break;
		case 'mask':
			type = AclType.mask;
			break;
		case 'other':
			type = AclType.other;
			break;
		default:
			throw new Error(`Unknown ACL Entry type ${parts[i - 1]}`);
	}
	const name = parts[i++];
	const permission = parseAclPermission(parts[i++]);
	return new AclEntry(scope, type, name, name, permission);
}

/**
 * Parses an octal in the form [#]### into a combination of an optional sticky bit and a set
 * of @see AclEntryPermission. Each digit in the octal corresponds to the sticky bit or a
 * particular user type - owner, group and other respectively.
 * If the sticky bit exists and its value is 1 then the sticky bit value is set to true.
 * Each permission digit is then expected to be a value between 0 and 7 inclusive, which is a bitwise OR the permission flags
 * for the file.
 * 	4 - Read
 * 	2 - Write
 * 	1 - Execute
 * So an octal of 1730 would map to :
 * 	- sticky === true
 * 	- The owner with rwx permissions
 * 	- The group with -wx permissions
 * 	- All others with --- permissions
 * @param octal The octal string to parse
 */
export function parseAclPermissionFromOctal(octal: string): { sticky: boolean, owner: AclEntryPermission, group: AclEntryPermission, other: AclEntryPermission } {
	if (!octal || (octal.length !== 3 && octal.length !== 4)) {
		throw new Error(`Invalid octal ${octal} - it must be a 3 or 4 digit string`);
	}

	const sticky = octal.length === 4 ? octal[0] === '1' : false;
	const ownerPermissionDigit = parseInt(octal[octal.length - 3]);
	const groupPermissionDigit = parseInt(octal[octal.length - 2]);
	const otherPermissionDigit = parseInt(octal[octal.length - 1]);

	return {
		sticky: sticky,
		owner: new AclEntryPermission((ownerPermissionDigit & 4) === 4, (ownerPermissionDigit & 2) === 2, (ownerPermissionDigit & 1) === 1),
		group: new AclEntryPermission((groupPermissionDigit & 4) === 4, (groupPermissionDigit & 2) === 2, (groupPermissionDigit & 1) === 1),
		other: new AclEntryPermission((otherPermissionDigit & 4) === 4, (otherPermissionDigit & 2) === 2, (otherPermissionDigit & 1) === 1)
	};
}

export function getImageForType(type: AclType | PermissionType): IconPath {
	switch (type) {
		case AclType.user:
		case PermissionType.owner:
			return IconPathHelper.user;
		case AclType.group:
		case PermissionType.group:
		case PermissionType.other:
			return IconPathHelper.group;
	}
	return { dark: '', light: '' };
}
