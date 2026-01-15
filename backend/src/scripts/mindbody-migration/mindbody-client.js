// ============================================
// MINDBODY API CLIENT
// Handles authentication, rate limiting, and API calls
// ============================================

const axios = require('axios');
const pRetry = require('p-retry');
const { pool } = require('../../database/connection');

const MINDBODY_API_BASE = 'https://api.mindbodyonline.com/public/v6';
const REQUESTS_PER_SECOND = 2; // Conservative rate limit
const MAX_RETRIES = 3;

class MindbodyClient {
  constructor() {
    this.apiKey = process.env.MINDBODY_API_KEY;
    this.siteId = process.env.MINDBODY_SITE_ID;
    this.clientId = process.env.MINDBODY_CLIENT_ID;
    this.clientSecret = process.env.MINDBODY_CLIENT_SECRET;
    this.accessToken = null;
    this.lastRequestTime = 0;

    if (!this.apiKey || !this.siteId) {
      throw new Error('MINDBODY_API_KEY and MINDBODY_SITE_ID must be set in environment');
    }
  }

  // Rate limiting - wait if needed
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / REQUESTS_PER_SECOND;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  // Track API usage in database
  async trackApiCall() {
    try {
      await pool.query('SELECT increment_mindbody_api_usage()');
    } catch (err) {
      console.warn('Failed to track API usage:', err.message);
    }
  }

  // Check if we're within rate limits
  async checkRateLimit() {
    try {
      const result = await pool.query('SELECT * FROM check_mindbody_rate_limit()');
      return result.rows[0];
    } catch (err) {
      console.warn('Failed to check rate limit:', err.message);
      return { within_limit: true }; // Assume OK if check fails
    }
  }

  // Get OAuth token (required for most endpoints)
  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    console.log('Obtaining Mindbody OAuth token...');

    try {
      const response = await axios.post(
        'https://signin.mindbodyonline.com/connect/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'Mindbody.Api.Public.v6'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      console.log('✓ OAuth token obtained');
      return this.accessToken;
    } catch (err) {
      console.error('Failed to obtain OAuth token:', err.response?.data || err.message);
      throw new Error('Mindbody authentication failed');
    }
  }

  // Make API request with retry logic
  async request(endpoint, params = {}, options = {}) {
    await this.rateLimit();

    const rateLimit = await this.checkRateLimit();
    if (!rateLimit.within_limit) {
      console.warn(`⚠️  Rate limit exceeded! ${rateLimit.calls_today} calls today. Estimated cost: $${rateLimit.estimated_cost}`);
    }

    const makeRequest = async () => {
      const token = await this.getAccessToken();

      const response = await axios.get(`${MINDBODY_API_BASE}${endpoint}`, {
        params,
        headers: {
          'Api-Key': this.apiKey,
          'SiteId': this.siteId,
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'TheStudioReno/1.0',
          ...options.headers
        }
      });

      await this.trackApiCall();
      return response.data;
    };

    // Retry on rate limit or network errors
    return pRetry(makeRequest, {
      retries: MAX_RETRIES,
      onFailedAttempt: error => {
        if (error.response?.status === 429) {
          console.log(`Rate limited, retrying in ${error.attemptNumber * 2}s...`);
          return new Promise(resolve => setTimeout(resolve, error.attemptNumber * 2000));
        }
        if (error.attemptNumber < MAX_RETRIES) {
          console.log(`Request failed, retry ${error.attemptNumber}/${MAX_RETRIES}`);
        }
      }
    });
  }

  // Get all clients with pagination
  async getAllClients(onProgress) {
    console.log('Fetching clients from Mindbody...');
    let allClients = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const data = await this.request('/client/clients', {
        Limit: limit,
        Offset: offset
      });

      const clients = data.Clients || [];
      allClients = allClients.concat(clients);

      if (onProgress) {
        onProgress({
          processed: allClients.length,
          total: data.PaginationResponse?.TotalResults || allClients.length,
          page: Math.floor(offset / limit) + 1
        });
      }

      console.log(`Fetched ${allClients.length}/${data.PaginationResponse?.TotalResults || '?'} clients`);

      // Check if we've got all clients
      if (clients.length < limit) {
        break;
      }

      offset += limit;
    }

    console.log(`✓ Fetched ${allClients.length} total clients`);
    return allClients;
  }

  // Get client visits (attendance history)
  async getClientVisits(clientId, startDate = null) {
    const params = { ClientId: clientId };
    if (startDate) {
      params.StartDate = startDate;
    }

    const data = await this.request('/client/clientvisits', params);
    return data.Visits || [];
  }

  // Get active memberships for a client
  async getClientMemberships(clientId) {
    const data = await this.request('/client/activeclientmemberships', {
      ClientId: clientId
    });
    return data.ClientMemberships || [];
  }

  // Get client services/packages/credits
  async getClientServices(clientId) {
    const data = await this.request('/client/clientservices', {
      ClientId: clientId
    });
    return data.ClientServices || [];
  }

  // Batch process clients with rate limiting
  async batchProcess(items, processFn, options = {}) {
    const {
      batchSize = 10,
      onProgress = () => {},
      phase = 'unknown'
    } = options;

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (item) => {
          try {
            await processFn(item);
            processed++;
          } catch (err) {
            failed++;
            await this.logError(phase, item.Id || item.ClientId, err);
          }
        })
      );

      onProgress({
        processed,
        failed,
        total: items.length,
        percentage: Math.round((processed / items.length) * 100)
      });
    }

    return { processed, failed };
  }

  // Log migration error to database
  async logError(phase, recordId, error) {
    try {
      await pool.query(
        `INSERT INTO mindbody_migration_errors (phase, record_id, error_type, error_message, error_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          phase,
          String(recordId),
          error.name || 'Error',
          error.message,
          JSON.stringify({
            stack: error.stack,
            response: error.response?.data
          })
        ]
      );
    } catch (err) {
      console.error('Failed to log error:', err.message);
    }
  }

  // Update migration progress
  async updateProgress(phase, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    fields.push('updated_at = NOW()');
    values.push(phase);

    await pool.query(
      `UPDATE mindbody_migration_progress
       SET ${fields.join(', ')}
       WHERE phase = $${paramCount}`,
      values
    );
  }
}

module.exports = MindbodyClient;
