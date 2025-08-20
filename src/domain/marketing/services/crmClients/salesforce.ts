// filepath: src/domain/marketing/services/crmClients/salesforce.ts
export interface SalesforceAuthConfig {
  clientId: string
  clientSecret: string
  username: string
  password: string
  securityToken: string
}
export class SalesforceClient {
  private loginBase = 'https://login.salesforce.com'
  constructor(private config: SalesforceAuthConfig) {}

  async getAccessToken(): Promise<{ access_token: string; instance_url: string } | null> {
    const { clientId, clientSecret, username, password, securityToken } = this.config
    if (!clientId || !clientSecret || !username || !password || !securityToken) return null
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password: password + securityToken,
    })
    const res = await fetch(`${this.loginBase}/services/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
    if (!res.ok) throw new Error(`Salesforce auth failed: ${res.status}`)
    return res.json()
  }

  async upsertContactByEmail(token: { access_token: string; instance_url: string }, data: Record<string, any>): Promise<{ Id: string }> {
    const email = data.Email
    if (!email) throw new Error('Email required for Salesforce contact')
    const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }
    // Search existing contact
    const soql = encodeURIComponent(`SELECT Id, Email FROM Contact WHERE Email='${email}' LIMIT 1`)
    const find = await fetch(`${token.instance_url}/services/data/v57.0/query?q=${soql}`, { headers })
    if (!find.ok) throw new Error(`Salesforce query failed: ${find.status}`)
    const found = await find.json()
    if (found.totalSize > 0) {
      const id = found.records[0].Id
      const res = await fetch(`${token.instance_url}/services/data/v57.0/sobjects/Contact/${id}`, { method: 'PATCH', headers, body: JSON.stringify(data) })
      if (!res.ok && res.status !== 204) throw new Error(`Salesforce update contact failed: ${res.status}`)
      return { Id: id }
    }
    // Create
    const res = await fetch(`${token.instance_url}/services/data/v57.0/sobjects/Contact`, { method: 'POST', headers, body: JSON.stringify(data) })
    if (!res.ok) throw new Error(`Salesforce create contact failed: ${res.status}`)
    const created = await res.json()
    return { Id: created.id }
  }
}
