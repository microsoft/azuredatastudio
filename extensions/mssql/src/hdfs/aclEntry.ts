/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The parsed result from calling getAclStatus on the controller
 */
export interface IAclStatus {
	/**
	 * The ACL entries defined for the object
	 */
	entries: AclEntry[];
	/**
	 * The ACL entry object for the owner permissions
	 */
	owner: AclEntry;
	/**
	 * The ACL entry object for the group permissions
	 */
	group: AclEntry;
	/**
	 * The ACL entry object for the other permissions
	 */
	other: AclEntry;
	/**
	 * The sticky bit status for the object. If true the owner/root are
	 * the only ones who can delete the resource or its contents (if a folder)
	 */
	stickyBit: boolean;
}

/**
 * The type of an ACL entry. Corresponds to the first (or second if a scope is present) field of
 * an ACL entry - e.g. user:bob:rwx (user) or default:group::r-- (group)
 */
export enum AclEntryType {
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
export enum AclPermissionType {
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
		public readonly type: AclEntryType | AclPermissionType,
		public readonly name: string,
		public readonly displayName: string,
		public readonly permission: AclEntryPermission,
	) { }

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
function getAclEntryType(type: AclEntryType | AclPermissionType): AclEntryType {
	// We only need to map AclPermissionType - AclEntryType is already the
	// correct values we're mapping to.
	if (type in AclPermissionType) {
		switch (type) {
			case AclPermissionType.owner:
				return AclEntryType.user;
			case AclPermissionType.group:
				return AclEntryType.group;
			case AclPermissionType.other:
				return AclEntryType.other;
			default:
				throw new Error(`Unknown AclPermissionType : ${type}`);
		}
	}
	return <AclEntryType>type;
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
	let type: AclEntryType;
	switch (parts[i++]) {
		case 'user':
			type = AclEntryType.user;
			break;
		case 'group':
			type = AclEntryType.group;
			break;
		case 'mask':
			type = AclEntryType.mask;
			break;
		case 'other':
			type = AclEntryType.other;
			break;
		default:
			throw new Error(`Unknown ACL Entry type ${parts[i - 1]}`);
	}
	const name = parts[i++];
	const permission = parseAclPermission(parts[i++]);
	return new AclEntry(scope, type, name, name, permission);
}

/**
 * Parses an octal in the form ### into a set of @see AclEntryPermission. Each digit in the octal corresponds
 * to a particular user type - owner, group and other respectively.
 * Each digit is then expected to be a value between 0 and 7 inclusive, which is a bitwise OR the permission flags
 * for the file.
 * 	4 - Read
 * 	2 - Write
 * 	1 - Execute
 * So an octal of 730 would map to :
 * 	- The owner with rwx permissions
 * 	- The group with -wx permissions
 * 	- All others with --- permissions
 * @param octal The octal string to parse
 */
export function parseAclPermissionFromOctal(octal: string): { owner: AclEntryPermission, group: AclEntryPermission, other: AclEntryPermission } {
	if (!octal || octal.length !== 3) {
		throw new Error(`Invalid octal ${octal} - it must be a 3 digit string`);
	}

	const ownerPermissionDigit = parseInt(octal[0]);
	const groupPermissionDigit = parseInt(octal[1]);
	const otherPermissionDigit = parseInt(octal[2]);

	return {
		owner: new AclEntryPermission((ownerPermissionDigit & 4) === 4, (ownerPermissionDigit & 2) === 2, (ownerPermissionDigit & 1) === 1),
		group: new AclEntryPermission((groupPermissionDigit & 4) === 4, (groupPermissionDigit & 2) === 2, (groupPermissionDigit & 1) === 1),
		other: new AclEntryPermission((otherPermissionDigit & 4) === 4, (otherPermissionDigit & 2) === 2, (otherPermissionDigit & 1) === 1)
	};
}
