// All TypeORM entities are listed here so the DataSource knows every table,
// mirroring Gain.io's src/modules/entities.js. Populated per feature branch.
export const entities: Function[] = []

// Dev-only guard — mirrors Gain; never auto-sync in the request flow.
export const syncDBEntities = async () => {
  // await dataSource.synchronize()
}
