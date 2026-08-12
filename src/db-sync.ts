import 'src/modules/entities'
import './env'

import { dataSource } from 'src/utils/database'

const run = async () => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize()
  }

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
