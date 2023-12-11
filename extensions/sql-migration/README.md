# Azure SQL Migration
The [Azure SQL Migration extension for Azure Data Studio](https://docs.microsoft.com/sql/azure-data-studio/extensions/azure-sql-migration-extension) brings together a simplified assessment, recommendation, and migration experience that delivers the following capabilities:
- A responsive user interface that provides you with an end-to-end migration experience that starts with a migration readiness assessment, SKU recommendation (based on performance data), and finalizes with the actual migration to Azure SQL.
- An enhanced assessment mechanism that can evaluate SQL Server instances, identifying databases that are ready for migration to the different Azure SQL targets.
- A SKU recommendation engine that collects performance data from the source SQL Server instance on-premises, generating right-sized SKU recommendations based on your Azure SQL target.
- A reliable Azure service powered by Azure Database Migration Service that orchestrates data movement activities to deliver a seamless migration experience.
- The ability to run online (for migrations requiring minimal downtime) or offline (for migrations where downtime persists through the migration) migration modes to suit your business requirements.
- The flexibility to create and configure a self-hosted integration runtime to provide your own compute for accessing the source SQL Server and backups in your on-premises environment.

## Installation
Open the Azure Data Studio marketplace, select and install the latest version of the Azure SQL Migration extension, and launch the wizard. Follow the example below:

![migration-animation](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/sql-migration/images/ADSMigration.gif)


## Things you need before starting your Azure SQL migration
- An Azure account (**not required for assessment or SKU recommendation functionality**).
- A source SQL Server database(s) running on-premises, or on SQL Server on Azure Virtual Machine or any virtual machine running in the cloud (private, public).
- An Azure SQL Managed Instance, SQL Server on Azure Virtual Machine, or Azure SQL Database to migrate your database(s) to.
- Your database backup location details, either a network file share or an Azure Blob Storage container (not required for Azure SQL Database targets).
## Getting started
Refer to [Migrate databases using the Azure SQL Migration extension for Azure Data Studio](https://docs.microsoft.com/azure/dms/migration-using-azure-data-studio) for detailed documentation on capabilities and concepts.

## Assessment and SKU recommendation (Preview)
The assessment and SKU recommendation feature evaluates the source SQL Server database(s) for migration readiness.

It also generates right-sized SKU recommendations for your Azure target to meet the performance requirements of the source SQL Server database(s) with minimal cost. [Learn more.](https://aka.ms/ads-sql-sku-recommend)

## Azure SQL targets
The Azure SQL Migration extension supports database migrations to the following Azure SQL targets.
- [Azure SQL Managed Instance](https://docs.microsoft.com/azure/azure-sql/managed-instance/sql-managed-instance-paas-overview)
- [SQL Server on Azure Virtual Machines](https://docs.microsoft.com/azure/azure-sql/virtual-machines/windows/sql-server-on-azure-vm-iaas-what-is-overview)
- [Azure SQL Database](https://docs.microsoft.com/azure/azure-sql/database/sql-database-paas-overview?view=azuresql)


## Migration modes
The following migration modes are supported for the corresponding Azure SQL targets.
- Online - The source SQL Server database is available for read and write activity, while the database backups (full + log) are continuously restored on the Azure SQL target. Application downtime is limited to the duration of the cutover at the end of migration.
    > Online migrations to Azure SQL Database targets are not yet supported.
- Offline - The source SQL Server database cannot be used for write activity, while the database backup files are restored on the Azure SQL target. Application downtime persists from the start until the completion of the migration process.

## Need assistance or have questions/feedback
You can submit ideas/suggestions for improvement and other feedback (including bugs) to the [Azure Community forum — Azure Database Migration Service](https://feedback.azure.com/d365community/forum/2dd7eb75-ef24-ec11-b6e6-000d3a4f0da0).

If your migration is affected by unexpected issues, [open a support ticket to get assistance](https://azure.microsoft.com/support/create-ticket/).

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information, see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry

This extension collects telemetry data, which is used to help understand how to improve the product. For example, this usage data helps to debug issues, such as slow start-up times, and to prioritize new features. While we appreciate the insights this data provides, we also know that not everyone wants to send usage data and you can disable telemetry as described in the Azure Data Studio [disable telemetry reporting](https://aka.ms/ads-disable-telemetry) documentation.

## Privacy Statement

To learn more about our Privacy Statement visit [this link](https://go.microsoft.com/fwlink/?LinkID=824704).

## License
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the [MIT License](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
