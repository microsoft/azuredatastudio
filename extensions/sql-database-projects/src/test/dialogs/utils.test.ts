/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as constants from '../../common/constants';
import { SqlTargetPlatform } from 'sqldbproj';
import { getDefaultDockerImageWithTag, getDockerBaseImages } from '../../dialogs/utils';

describe('Tests to verify dialog utils functions', function (): void {
	it('getDefaultDockerImageWithTag should return correct image', () => {
		const baseImages = getDockerBaseImages(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2022)!);
		const sqlServerImageInfo = baseImages.find(image => image.displayName === constants.SqlServerDockerImageName);
		const edgeImageInfo = baseImages.find(image => image.displayName === SqlTargetPlatform.sqlEdge);

		should(getDefaultDockerImageWithTag('160', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}:2022-latest`, 'Unexpected docker image returned for target platform SQL Server 2022 and SQL Server base image');
		should(getDefaultDockerImageWithTag('150', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}:2019-latest`, 'Unexpected docker image returned for target platform SQL Server 2019 and SQL Server base image');
		should(getDefaultDockerImageWithTag('140', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}:2017-latest`, 'Unexpected docker image returned for target platform SQL Server 2017 and SQL Server base image');
		should(getDefaultDockerImageWithTag('130', 'mcr.microsoft.com/mssql/server', sqlServerImageInfo)).equals(`${sqlServerImageInfo?.name}`, 'Unexpected docker image returned for target platform SQL Server 2016 and SQL Server base image');
		should(getDefaultDockerImageWithTag('150', 'mcr.microsoft.com/azure-sql-edge', edgeImageInfo)).equals(`${edgeImageInfo?.name}`, 'Unexpected docker image returned for target platform SQL Server 2019 and Edge base image');

		// different display names are returned when a project's target platform is Azure, but currently the Azure full image points to mcr.microsoft.com/mssql/server
		const azureBaseImages = getDockerBaseImages(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)!);
		const azureFullImageInfo = azureBaseImages.find(image => image.displayName === constants.AzureSqlDbFullDockerImageName);
		const azureLiteImageInfo = azureBaseImages.find(image => image.displayName === constants.AzureSqlDbLiteDockerImageName);

		should(getDefaultDockerImageWithTag('AzureV12', 'mcr.microsoft.com/mssql/server', azureFullImageInfo)).equals(`${azureFullImageInfo?.name}`, 'Unexpected docker image returned for target platform Azure and Azure full base image');
		should(getDefaultDockerImageWithTag('AzureV12', 'mcr.microsoft.com/azure-sql-edge', azureLiteImageInfo)).equals(`${azureLiteImageInfo?.name}`, 'Unexpected docker image returned for target platform Azure Azure lite base image');
	});
});

