/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export class NodeType {
	public static Folder = 'Folder';
	public static Root = 'root';
	public static Database = 'Database';
	public static Server = 'Server';
	public static ScalarValuedFunction = 'ScalarValuedFunction';
	public static TableValuedFunction = 'TableValuedFunction';
	public static AggregateFunction = 'AggregateFunction';
	public static FileGroup = 'FileGroup';
	public static StoredProcedure = 'StoredProcedure';
	public static UserDefinedTableType = 'UserDefinedTableType';
	public static View = 'View';
	public static Table = 'Table';
	public static HistoryTable = 'HistoryTable';
	public static ServerLevelLinkedServerLogin = 'ServerLevelLinkedServerLogin';
	public static ServerLevelServerAudit = 'ServerLevelServerAudit';
	public static ServerLevelCryptographicProvider = 'ServerLevelCryptographicProvider';
	public static ServerLevelCredential = 'ServerLevelCredential';
	public static ServerLevelServerRole = 'ServerLevelServerRole';
	public static ServerLevelLogin = 'ServerLevelLogin';
	public static ServerLevelServerAuditSpecification = 'ServerLevelServerAuditSpecification';
	public static ServerLevelServerTrigger = 'ServerLevelServerTrigger';
	public static ServerLevelLinkedServer = 'ServerLevelLinkedServer';
	public static ServerLevelEndpoint = 'ServerLevelEndpoint';
	public static Synonym = 'Synonym';
	public static DatabaseTrigger = 'DatabaseTrigger';
	public static Assembly = 'Assembly';
	public static MessageType = 'MessageType';
	public static Contract = 'Contract';
	public static Queue = 'Queue';
	public static Service = 'Service';
	public static Route = 'Route';
	public static DatabaseAndQueueEventNotification = 'DatabaseAndQueueEventNotification';
	public static RemoteServiceBinding = 'RemoteServiceBinding';
	public static BrokerPriority = 'BrokerPriority';
	public static FullTextCatalog = 'FullTextCatalog';
	public static FullTextStopList = 'FullTextStopList';
	public static SqlLogFile = 'SqlLogFile';
	public static PartitionFunction = 'PartitionFunction';
	public static PartitionScheme = 'PartitionScheme';
	public static SearchPropertyList = 'SearchPropertyList';
	public static User = 'User';
	public static Schema = 'Schema';
	public static AsymmetricKey = 'AsymmetricKey';
	public static Certificate = 'Certificate';
	public static SymmetricKey = 'SymmetricKey';
	public static DatabaseEncryptionKey = 'DatabaseEncryptionKey';
	public static MasterKey = 'MasterKey';
	public static DatabaseAuditSpecification = 'DatabaseAuditSpecification';
	public static Column = 'Column';
	public static Key = 'Key';
	public static Constraint = 'Constraint';
	public static Trigger = 'Trigger';
	public static Index = 'Index';
	public static Statistic = 'Statistic';
	public static UserDefinedDataType = 'UserDefinedDataType';
	public static UserDefinedType = 'UserDefinedType';
	public static XmlSchemaCollection = 'XmlSchemaCollection';
	public static SystemExactNumeric = 'SystemExactNumeric';
	public static SystemApproximateNumeric = 'SystemApproximateNumeric';
	public static SystemDateAndTime = 'SystemDateAndTime';
	public static SystemCharacterString = 'SystemCharacterString';
	public static SystemUnicodeCharacterString = 'SystemUnicodeCharacterString';
	public static SystemBinaryString = 'SystemBinaryString';
	public static SystemOtherDataType = 'SystemOtherDataType';
	public static SystemClrDataType = 'SystemClrDataType';
	public static SystemSpatialDataType = 'SystemSpatialDataType';
	public static UserDefinedTableTypeColumn = 'UserDefinedTableTypeColumn';
	public static UserDefinedTableTypeKey = 'UserDefinedTableTypeKey';
	public static UserDefinedTableTypeConstraint = 'UserDefinedTableTypeConstraint';
	public static StoredProcedureParameter = 'StoredProcedureParameter';
	public static TableValuedFunctionParameter = 'TableValuedFunctionParameter';
	public static ScalarValuedFunctionParameter = 'ScalarValuedFunctionParameter';
	public static AggregateFunctionParameter = 'AggregateFunctionParameter';
	public static DatabaseRole = 'DatabaseRole';
	public static ApplicationRole = 'ApplicationRole';
	public static FileGroupFile = 'FileGroupFile';
	public static SystemMessageType = 'SystemMessageType';
	public static SystemContract = 'SystemContract';
	public static SystemService = 'SystemService';
	public static SystemQueue = 'SystemQueue';
	public static Sequence = 'Sequence';
	public static SecurityPolicy = 'SecurityPolicy';
	public static DatabaseScopedCredential = 'DatabaseScopedCredential';
	public static ExternalResource = 'ExternalResource';
	public static ExternalDataSource = 'ExternalDataSource';
	public static ExternalFileFormat = 'ExternalFileFormat';
	public static ExternalTable = 'ExternalTable';
	public static ColumnMasterKey = 'ColumnMasterKey';
	public static ColumnEncryptionKey = 'ColumnEncryptionKey';
}

export interface SqlThemeIcon {
	readonly id: string;
}
