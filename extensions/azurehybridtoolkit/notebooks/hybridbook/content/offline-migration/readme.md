# Offline Migration
[Home](../readme.md)

This chapter contains a set of notebooks useful for doing migration of databases and SQL instances to Azure. The following methods are possible when migrating to the cloud:

1. Use [Data Migration Service](https://docs.microsoft.com/en-us/azure/dms/tutorial-sql-server-azure-sql-online) to automatically migrate SQL Server to a single database or pooled database to Azure. 
2. Use SQL Server Integration Services (SSIS) [to migrate the catalog database for SSIS projects/packages](https://docs.microsoft.com/en-us/azure/dms/how-to-migrate-ssis-packages)
3. Use the Data Portibility notebooks to setup and perform parallel migration tasks to and from Azure
4. Execute Azure CLI or [dbatools](https://dbatools.io) commands to create SQL backups, move it to cloud storage, then restore in Azure

The first two methods require SQL tools to be downloaded and installed in order to use. The third option, Data Portibility Notebooks, will require some setup. For relatively simple and offline migration, use the notebooks in this chapter for greater control or insight. 

Be sure to fix any assessment recommendations uncovered by other Notebooks.

## Notebooks in this Chapter
- [Migrate Instance to Azure SQL VM](instance-to-VM.ipynb)

- [Migrate Database to Azure SQL VM](db-to-VM.ipynb)

- [Migrate Database to Azure SQL DB](db-to-SQLDB.ipynb)