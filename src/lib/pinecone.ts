export function pgConnectionStringToPineconeIndexName(connectionString: string) {
  const connectionStringWithoutParams = connectionString.split("?")[0];
  const dbEndpoint = connectionStringWithoutParams.split("@")[1];
  const dbInstanceEndpoint = dbEndpoint.split("/")[0];
  const dbInstanceName = dbInstanceEndpoint.split(".")[0];
  const dbName = connectionStringWithoutParams.split("/").pop();
  return `${dbInstanceName}-${dbName}`;
}
