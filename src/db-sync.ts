import 'src/modules/entities'
import './env'

import { dataSource } from 'src/utils/database'

const run = async () => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize()
  }
  // Dev-only full reset: TypeORM defines Postgres enum types with its own naming,
  // so drop the old (Sequelize-created) schema before syncing a clean one.
  await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE')
  await dataSource.query('CREATE SCHEMA public')
  await dataSource.synchronize()
  console.log('[db] sync complete')
  await dataSource.destroy()
  process.exit(0)
}

run().catch(async (err) => {
  console.error('[db] sync failed', err)
  if (dataSource.isInitialized) {
    await dataSource.destroy()
  }
  process.exit(1)
})
