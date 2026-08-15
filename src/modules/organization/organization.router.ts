import { Router } from 'express'

import { organizationController } from 'src/modules/organization/organization.controller'

export const organizationRouter = Router()

organizationRouter.get('/', organizationController.getAnOrganizationBySubDomain)

organizationRouter.get('/check-availability', organizationController.checkSubDomainAvailability)

organizationRouter.post('/', organizationController.createAnOrganizationForUser)
