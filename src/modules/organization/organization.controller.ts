import type { NextFunction, Request, Response } from 'express'

import { organizationHelper } from 'src/modules/helpers'
import { organizationService } from 'src/modules/services'
import { UserEntity } from 'src/modules/user/user.entity'
import { getRepository, useTransaction } from 'src/utils/database'
import CustomError from 'src/utils/error'

const handler =
  (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res)
    } catch (err) {
      next(err)
    }
  }

export const organizationController = {
  getAnOrganizationBySubDomain: handler(async (req, res) => {
    const organization = await organizationHelper.getAnOrganizationBySubDomain(req.query as { sub_domain?: string })

    const data: Record<string, unknown> = {
      id: organization.id,
      created_at: organization.created_at,
      logo_key: null,
      logo_icon_key: null,
      name: organization.name,
      sub_domain: organization.sub_domain
    }

    res.status(200).json({ data, message: 'Successfully fetched organization!' })
  }),

  createAnOrganizationForUser: handler(async (req, res) => {
    if (!req?.body?.user_id) {
      throw new CustomError(400, 'MISSING_OWNER')
    }

    const owner = await getRepository(UserEntity).findOne({ where: { id: req?.body?.user_id } })
    if (!owner?.id) {
      throw new CustomError(400, 'INVALID_OWNER')
    }

    const organization = await useTransaction(async (transaction) =>
      organizationService.createAnOrganizationForMutation(
        { ...req?.body, is_active_user: true },
        { user_id: req?.body?.user_id },
        transaction
      )
    )

    res.status(201).json({
      data: { id: organization.id, name: organization.name, sub_domain: organization.sub_domain },
      message: 'Successfully created organization!'
    })
  }),

  checkSubDomainAvailability: handler(async (req, res) => {
    const data = await organizationHelper.checkSubDomainAvailability(req.query as { sub_domain?: string })

    res.status(200).json({ data, message: 'Successfully checked availability for sub domain!' })
  })
}
