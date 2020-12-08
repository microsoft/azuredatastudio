# Offline Migration
[Home](../readme.md)

This chapter contains a set of notebooks useful for performing an **Offline Migration** of SQL Server 2005 and above to Azure. Offline migrations are by definition disruptive to the flow of data such as in a web application. Online migrations are usually performed when small infrastructure changes occur. However, moving to the cloud may require the system to be inaccessible for the duration of migration due the its complexity and cost of ensuring the service remains online. 

There are [many methods](https://datamigration.microsoft.com/) to consider when migrating to the cloud. The notebooks in this chapter cover the following scenarios:

## Notebooks in this Chapter
- [Migrate SQL Server Instance to Azure SQL VM](instance-to-VM.ipynb)

- [Migrate SQL Server Database to Azure SQL VM](db-to-VM.ipynb)

- [Migrate SQL Server Database to Azure SQL DB](db-to-SQLDB.ipynb)

## Why Migrate Data Offline?
If the cost of losing data for the duration of an offline migration can be minimized, then it often outperforms ensuring 100% data uptime during migration  when moving to the cloud from on-premise. Consider the time it takes to develop and test the deployment process, the infrastructure required to switch networking routing dynamically, and the cost of managing a migration team with those skills. With these notebooks, a foundation for automated offline migration can be built to ensure a robust migration with a smaller footprint.

## Recommendations for a Successful Migration
- Use the [Assessments](..\Assessments/readme.md) notebooks and fix all recommendations prior to migration to avoid potential problems during and after migration
- Always keep backups of the data in standard formats available to be redeployed in case of a problem
- Automate the migration in such a way that anyone can perform it, given access
- Consider creating a new notebook that contains simple data tests with known values on the new system to prove that the migration occurred (smoke tests)