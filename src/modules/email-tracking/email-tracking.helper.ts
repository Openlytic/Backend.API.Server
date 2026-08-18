import type { EntityManager } from 'typeorm'

import { EmailAnalyticEntity } from 'src/modules/email-tracking/email-analytic.entity'
import { EmailTrackingEventEntity } from 'src/modules/email-tracking/email-tracking-event.entity'
import { TrackedLinkEntity } from 'src/modules/email-tracking/tracked-link.entity'
import { dataSource, getRepository } from 'src/utils/database'
import CustomError from 'src/utils/error'

export interface TrackedLinkSummary extends TrackedLinkEntity {
  click_count: number
  last_clicked_at: Date | null
}

export const getAnEmailAnalyticForQuery = async (
  params: { entity_id?: string },
  user?: Record<string, unknown>,
  transaction?: EntityManager
): Promise<EmailAnalyticEntity> => {
  const analytic = await getRepository(EmailAnalyticEntity, transaction).findOne({
    where: { id: params?.entity_id, org_id: (user?.org_id as string) || null }
  })

  if (!analytic?.id) {
    throw new CustomError(404, 'EMAIL_ANALYTIC_NOT_FOUND')
  }

  return analytic
}

export const getEmailAnalyticsForQuery = async (
  params?: {
    query?: { email_id?: string; status?: string }
    options?: { limit?: number; offset?: number }
  },
  user?: Record<string, unknown>,
  transaction?: EntityManager
) => {
  const { query = {}, options = {} } = params || {}
  const { limit, offset } = options || {}

  const where: Record<string, unknown> = { org_id: (user?.org_id as string) || null }
  if (query?.email_id) where.email_id = query.email_id
  if (query?.status) where.status = query.status

  const data = await getRepository(EmailAnalyticEntity, transaction).find({
    where,
    order: { updated_at: 'DESC' },
    take: limit,
    skip: offset
  })
  const filteredRows = await getRepository(EmailAnalyticEntity, transaction).count({ where })

  return { data, meta_data: { filtered_rows: filteredRows, total_rows: data.length } }
}

export const getTrackedLinksForQuery = async (
  params: { email_id?: string },
  user?: Record<string, unknown>
): Promise<TrackedLinkSummary[]> => {
  const emailId = params?.email_id
  if (!emailId) {
    throw new CustomError(400, 'EMAIL_ID_REQUIRED')
  }

  const result = await dataSource.query(
    `SELECT
       tl.id, tl.email_id, tl.org_id, tl.target_url, tl.label, tl.kind, tl.sort,
       tl.created_at, tl.updated_at,
       COUNT(ev.id) FILTER (WHERE ev.event_type::text = CASE WHEN tl.kind = 'attachment' THEN 'attachment_viewed' ELSE 'click' END)::int AS click_count,
       MAX(ev.occurred_at) FILTER (WHERE ev.event_type::text = CASE WHEN tl.kind = 'attachment' THEN 'attachment_viewed' ELSE 'click' END) AS last_clicked_at
     FROM tracked_link tl
     LEFT JOIN email_tracking_events ev
       ON ev.email_id = tl.email_id AND ev.target_url = tl.target_url AND ev.event_type IN ('click', 'attachment_viewed')
     WHERE tl.email_id = $1 AND tl.org_id = $2
     GROUP BY tl.id
     ORDER BY tl.sort ASC, tl.created_at ASC`,
    [emailId, (user?.org_id as string) || null]
  )

  return result as TrackedLinkSummary[]
}

export const getEmailTrackingEventsForQuery = async (
  params?: {
    query?: { email_id?: string; event_type?: string }
    options?: { limit?: number; offset?: number }
  },
  user?: Record<string, unknown>,
  transaction?: EntityManager
) => {
  const { query = {}, options = {} } = params || {}
  const { limit, offset } = options || {}

  const where: Record<string, unknown> = { org_id: (user?.org_id as string) || null }
  if (query?.email_id) where.email_id = query.email_id
  if (query?.event_type) where.event_type = query.event_type

  const data = await getRepository(EmailTrackingEventEntity, transaction).find({
    where,
    order: { occurred_at: 'DESC' },
    take: limit,
    skip: offset
  })
  const filteredRows = await getRepository(EmailTrackingEventEntity, transaction).count({ where })

  return { data, meta_data: { filtered_rows: filteredRows, total_rows: data.length } }
}

export const listLinkClickSummariesForQuery = getTrackedLinksForQuery
