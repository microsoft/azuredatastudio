# Offline Migration
[Home](../readme.md)

This chapter contains a set of notebooks useful for performing an **Offline Migration** of SQL Server 2005 and above to Azure. Offline migrations are by definition disruptive to the flow of data such as in a web application. Online migrations are usually performed when small infrastructure changes occur. However, moving to the cloud may require the system to be inaccessible for the duration of migration due the its complexity and cost of ensuring the service remains online. 

## Why Migrate Data Offline?
If the cost of losing data for the duration of the migration can be minimized, then it outperforms the cost of ensuring 100% data uptime when moving to the cloud from on-premise. With these notebooks, a foundation for automated offline migration can be built to ensure a robust migration.

There are [many methods](https://datamigration.microsoft.com/) to consider when migrating to the cloud. The notebooks in this chapter cover the following scenarios:

## Notebooks in this Chapter
- [Migrate SQL Server Instance to Azure SQL VM](instance-to-VM.ipynb)

- [Migrate SQL Server Database to Azure SQL VM](db-to-VM.ipynb)

- [Migrate SQL Server Database to Azure SQL DB](db-to-SQLDB.ipynb)