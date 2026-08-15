import CustomError from 'src/utils/error'

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const validateEmail = (email?: unknown): email is string => typeof email === 'string' && EMAIL_REGEX.test(email)

export const validateUUID = (uuid: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)

export const isUrlValid = (input = ''): boolean => {
  if (!input) return false
  try {
    const parsed = new URL(input)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const isValidatePhoneNumber = (phoneNumber = ''): boolean => {
  const cleaned = phoneNumber.replace(/[-\s()]/g, '')
  return /^(\+|\d)[0-9]{5,}$/.test(cleaned)
}

// Built-in port of the `slugify` package (lower, trim, space-to-dash). No external dep.
export const slugify = (
  input = '',
  { replacement = '-', lower = true, trim = true }: { replacement?: string; lower?: boolean; trim?: boolean } = {}
): string => {
  let slug = String(input ?? '')
  if (trim) slug = slug.trim()
  if (lower) slug = slug.toLowerCase()
  slug = slug
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_]+/g, replacement)
    .replace(new RegExp(`${replacement}+`, 'g'), replacement)
  return slug
}

export const getAppDomainName = (): string => process.env.APP_DOMAIN || 'openlytic.app'

const FQDN_REGEX = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/

export const validateDomain = (params: { domain?: string; sub_domain?: string; user_input_domain?: string }): void => {
  const { domain, sub_domain: subDomain, user_input_domain: userInputDomain = '' } = params || {}

  const specialCharactersRegex = /[!@#$%^&*]/
  if (userInputDomain && specialCharactersRegex.test(userInputDomain)) {
    throw new CustomError(400, 'SPECIAL_CHARACTERS_NOT_ALLOWED')
  }

  if (subDomain && (subDomain.includes('--') || subDomain.includes('.'))) {
    throw new CustomError(400, 'INVALID_SUBDOMAIN_FORMAT')
  }

  const domainToValidate = domain || (subDomain && `${subDomain}.${getAppDomainName()}`)

  if (!domainToValidate || !FQDN_REGEX.test(domainToValidate)) {
    throw new CustomError(400, 'INVALID_DOMAIN')
  }
}

export const getFirstLetterUpperCase = (str: string): string => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const normalizeUrl = (url = ''): string => {
  if (!url?.trim()) return ''
  const sanitized = url.trim()
  if (!/^https?:\/\//i.test(sanitized)) return `https://${sanitized}`
  return sanitized
}

export const prepareURLObjectFromString = (str = ''): URL | null => {
  try {
    if (!str) return null
    return new URL(str)
  } catch {
    return null
  }
}

const isMissingValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !(value instanceof Date) && Object.keys(value as Record<string, unknown>).length === 0)

const isPresentValue = (value: unknown): boolean =>
  typeof value === 'number' || typeof value === 'boolean' || value instanceof Date || !isMissingValue(value)

export const checkRequiredFields = (requiredFields: string[] = [], data: Record<string, unknown> = {}): void => {
  const missingFields = requiredFields.filter((field) => !isPresentValue(data[field]))
  if (missingFields.length) {
    throw new CustomError(400, `Missing ${missingFields.join(', ')}`)
  }
}

export const checkRequireAtLeastOneField = (fields: string[] = [], data: Record<string, unknown> = {}): void => {
  const hasValue = fields.some((field) => isPresentValue(data[field]))
  if (!hasValue) {
    throw new CustomError(400, `At least one of [${fields.join(', ')}] must be provided.`)
  }
}

export const getModifiedObjectProperties = (
  originalObject: Record<string, unknown>,
  modifiedObject: Record<string, unknown>,
  doNotThrowError = false
): Record<string, unknown> => {
  if (!originalObject || !modifiedObject || typeof originalObject !== 'object' || typeof modifiedObject !== 'object') {
    if (doNotThrowError) return {}
    throw new CustomError(400, 'ORIGINAL_OBJECT_OR_MODIFIED_OBJECT_IS_NOT_OBJECT')
  }

  const result: Record<string, unknown> = {}
  Object.entries(modifiedObject).forEach(([key, value]) => {
    if (!(key in originalObject)) return
    if ((typeof value === 'object' && value !== null) || Array.isArray(value) || originalObject[key] !== value) {
      result[key] = value
    }
  })

  return result
}

export const isDateInRange = (date: Date, rangeStart: Date, rangeEnd: Date | null): boolean => {
  if (!rangeEnd) return date >= rangeStart
  return date >= rangeStart && date <= rangeEnd
}

export const roundUpToCleanNumber = (value = 0): number => {
  if (typeof value !== 'number' || value <= 0) return 0
  if (value <= 10) return Math.ceil(value)

  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1)
  const step = 5 * magnitude
  return Math.ceil(value / step) * step
}

const ORG_ROLE_HIERARCHY = ['org_owner', 'org_admin', 'org_manager', 'org_agent']
const APP_ROLE_HIERARCHY = ['admin', 'manager', 'translator', 'user']

export const getTopRoleOfAUser = (roles: string[] = [], isForOrg = true): string | undefined => {
  const hierarchy = isForOrg ? ORG_ROLE_HIERARCHY : APP_ROLE_HIERARCHY
  return hierarchy.find((role) => roles.includes(role))
}

export const isUserOnlyAgent = (roles: string[] = []): boolean =>
  roles.includes('org_agent') &&
  !roles.includes('org_owner') &&
  !roles.includes('org_admin') &&
  !roles.includes('org_manager')
