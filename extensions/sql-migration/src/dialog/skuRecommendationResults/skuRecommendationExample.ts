/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SkuRecommendationResult } from '../../../../mssql/src/mssql';

export const recommendationsJSON: SkuRecommendationResult = {
	'sqlDbRecommendationResults': [
		{
			'sqlInstanceName': 'RATRUONG-P330',
			'databaseName': 'test',
			'targetSku': {
				'storageMaxSizeInMb': 1024,
				'predictedDataSizeInMb': 8,
				'predictedLogSizeInMb': 8,
				'category': {
					'sqlPurchasingModel': 0,
					'sqlServiceTier': 0,
					'hardwareType': 0,
					'computeTier': 0,
					'sqlTargetPlatform': 0
				},
				'computeSize': 2
			},
			'monthlyCost': {
				'computeCost': 245.130696,
				'storageCost': 0.17940000000000003,
				'totalCost': 245.310096
			},
			'ranking': 0,
			'positiveJustifications': [
				'According to the performance data collected, we estimate that your SQL server database has a requirement for 0.00 vCores of CPU. For greater flexibility, based on your scaling factor of 100.00%, we are making a recommendation based on 0.00 vCores. Based on all the other factors, including memory, storage, and IO, this is the smallest compute sizing that will satisfy all of your needs.',
				'This SQL Server database requires 0.00 GB of memory.',
				'This SQL Server database requires 0.01 GB of storage for data files. We recommend provisioning 1 GB of storage, which is the closest valid amount that can be provisioned that meets your requirement.',
				'This SQL Server database requires 0.00 MB/second of combined read/write IO throughput. This is a relatively idle database, so IO latency is not considered.',
				'Assuming the database uses the Full Recovery Model, this SQL Server Database requires 0 IOPS for data files.',
				'This is the most cost-efficient offering among all the performance eligible SKUs.'
			],
			'negativeJustifications': []
		},
		{
			'sqlInstanceName': 'RATRUONG-P330',
			'databaseName': 'AdventureWorks2019',
			'targetSku': {
				'storageMaxSizeInMb': 1024,
				'predictedDataSizeInMb': 264,
				'predictedLogSizeInMb': 72,
				'category': {
					'sqlPurchasingModel': 0,
					'sqlServiceTier': 0,
					'hardwareType': 0,
					'computeTier': 0,
					'sqlTargetPlatform': 0
				},
				'computeSize': 2
			},
			'monthlyCost': {
				'computeCost': 245.130696,
				'storageCost': 0.17940000000000003,
				'totalCost': 245.310096
			},
			'ranking': 0,
			'positiveJustifications': [
				'According to the performance data collected, we estimate that your SQL server database has a requirement for 0.00 vCores of CPU. For greater flexibility, based on your scaling factor of 100.00%, we are making a recommendation based on 0.00 vCores. Based on all the other factors, including memory, storage, and IO, this is the smallest compute sizing that will satisfy all of your needs.',
				'This SQL Server database requires 0.00 GB of memory.',
				'This SQL Server database requires 0.26 GB of storage for data files. We recommend provisioning 1 GB of storage, which is the closest valid amount that can be provisioned that meets your requirement.',
				'This SQL Server database requires 0.00 MB/second of combined read/write IO throughput. This is a relatively idle database, so IO latency is not considered.',
				'Assuming the database uses the Full Recovery Model, this SQL Server Database requires 0 IOPS for data files.',
				'This is the most cost-efficient offering among all the performance eligible SKUs.'
			],
			'negativeJustifications': []
		}
	],
	'sqlMiRecommendationResults': [
		{
			'sqlInstanceName': 'RATRUONG-P330',
			'databaseName': 'null',
			'targetSku': {
				'storageMaxSizeInMb': 32768,
				'predictedDataSizeInMb': 272,
				'predictedLogSizeInMb': 80,
				'category': {
					'sqlPurchasingModel': 0,
					'sqlServiceTier': 0,
					'hardwareType': 0,
					'computeTier': 0,
					'sqlTargetPlatform': 1
				},
				'computeSize': 4
			},
			'monthlyCost': {
				'computeCost': 490.261392,
				'storageCost': 0,
				'totalCost': 490.261392
			},
			'ranking': 0,
			'positiveJustifications': [
				'According to the performance data collected, we estimate that your SQL server instance has a requirement for 0.00 vCores of CPU. For greater flexibility, based on your scaling factor of 100.00%, we are making a recommendation based on 0.00 vCores. Based on all the other factors, including memory, storage, and IO, this is the smallest compute sizing that will satisfy all of your needs.',
				'This SQL Server instance requires 0.01 GB of memory, which is within this SKU\'s limit of 20.40 GB.',
				'This SQL Server instance requires 0.27 GB of storage for data files. We recommend provisioning 32 GB of storage, which is the closest valid amount that can be provisioned that meets your requirement.',
				'This SQL Server instance requires 0.00 MB/second of combined read/write IO throughput. This is a relatively idle instance, so IO latency is not considered.',
				'Assuming the database uses the Full Recovery Model, this SQL Server instance requires 0 IOPS for data and log files. ',
				'This is the most cost-efficient offering among all the performance eligible SKUs.'
			],
			'negativeJustifications': []
		}
	],
	'sqlVmRecommendationResults': [
		{
			'sqlInstanceName': 'RATRUONG-P330',
			'databaseName': 'null',
			'targetSku': {
				'virtualMachineSize': {
					'virtualMachineFamily': 20,
					'sizeName': 'E2as_v4',
					'computeSize': 2,
					'azureSkuName': 'Standard_E2as_v4',
					'vCPUsAvailable': 2,
					'maxNetworkInterfaces': 0
				},
				'dataDiskSizes': [
					{
						'tier': '1',
						'size': 'P30',
						'caching': '2'
					}
				],
				'logDiskSizes': [
					{
						'tier': '1',
						'size': 'P30',
						'caching': '1'
					}
				],
				'tempDbDiskSizes': [],
				'predictedDataSizeInMb': 272,
				'predictedLogSizeInMb': 80,
				'category': {
					'virtualMachineFamilyType': 2,
					'computeTier': 0,
					'sqlTargetPlatform': 2
				},
				'computeSize': 2
			},
			'monthlyCost': {
				'computeCost': 102.48,
				'storageCost': 270.34,
				'totalCost': 372.82
			},
			'ranking': 0,
			'positiveJustifications': [
				'This Virtual Machine series uses the latest generation of hardware.',
				'According to the performance data collected, we estimate that your SQL server instance has a requirement for 0.00 vCores of CPU. For greater flexibility, based on your scaling factor of 100.00%, we are making a recommendation based on 0.00 vCores. Based on all the other factors, including memory, storage, and IO, this is the smallest compute sizing that will satisfy all of your needs.',
				'This SQL Server instance requires 0.01 GB of memory, which is within this SKU\'s limit of 16.00 GB.',
				'This Virtual Machine size\'s Memory-to-vCore ratio of 8.0 is greater than or equal to the recommended value of 8.0.',
				'This Virtual Machine size supports Premium SSD managed disks.',
				'Assuming the database uses the Full Recovery Model, this SQL Server instance requires 0 IOPS for data and log files. This SQL Server instance\'s IOPS requirement is within the Virtual Machine Size\'s uncached IOPS limit of 3200.',
				'This SQL Server instance\'s IO throughput requirement of 0.00 MBps is within the Virtual Machine\'s uncached limit of 48.00 MBps.',
				'Note: this storage layout supports a combined 5000 uncached IOPS, which exceeds the Virtual Machine\'s limit of 3200 uncached IOPS.',
				'Note: this storage layout supports a combined 5000 cached IOPS, which exceeds the Virtual Machine\'s limit of 4000 cached IOPS.',
				'This SQL Server instance\'s Data storage requirement of 0.27 GB will fit on 1 P30 disk(s), which can hold 1024 GB each.',
				'We recommend provisioning dedicated Log disk(s). This SQL Server instance\'s Log storage requirement of 0.08 GB will fit on 1 P30 disk(s), which can hold 1024 GB each.',
				'This Virtual Machine size supports temporary storage of up to 32.00 GB, which is large enough to hold your 0.07 GB TempDB, so no separate disk is needed.',
				'This is the most cost-efficient offering among all the performance eligible SKUs.'
			],
			'negativeJustifications': []
		}
	]
};
