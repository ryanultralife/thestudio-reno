// ============================================
// MINDBODY API CLIENT
// Handles all API communication with MindBody
// ============================================

const db = require('../../database/connection');

const BASE_URL = 'https://api.mindbodyonline.com/public/v6';

// Rate limiting state
let requestCount = 0;
let lastResetTime = Date.now();
const DAILY_LIMIT = 1000;
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Token cache
let userToken = null;
let tokenExpiresAt = null;

/**
 * MindBody API Client
 */
class MindbodyClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.MINDBODY_API_KEY;
    this.siteId = config.siteId || process.env.MINDBODY_SITE_ID;
    this.staffUsername = config.staffUsername || process.env.MINDBODY_STAFF_USERNAME;
    this.staffPassword = config.staffPassword || process.env.MINDBODY_STAFF_PASSWORD;

    if (!this.apiKey) {
      console.warn('[MindBody] No API key configured');
    }
  }

  // ============================================
  // CORE REQUEST METHODS
  // ============================================

  /**
   * Make an authenticated request to the MindBody API
   */
  async request(method, endpoint, options = {}) {
    // Check rate limiting
    this.checkRateLimit();

    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Api-Key': this.apiKey,
      'SiteId': this.siteId,
      ...options.headers,
    };

    // Add user token if available and required
    if (options.requiresAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const fetchOptions = {
      method,
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // Add query parameters
    let finalUrl = url;
    if (options.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v));
          } else {
            searchParams.append(key, value);
          }
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        finalUrl = `${url}?${queryString}`;
      }
    }

    try {
      requestCount++;
      const response = await fetch(finalUrl, fetchOptions);

      // Handle rate limiting response
      if (response.status === 429) {
        throw new Error('MindBody API rate limit exceeded');
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.Error?.Message || data.message || `HTTP ${response.status}`;
        throw new Error(`MindBody API Error: ${errorMessage}`);
      }

      return data;
    } catch (error) {
      console.error(`[MindBody] API Error: ${method} ${endpoint}`, error.message);
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  async post(endpoint, body, options = {}) {
    return this.request('POST', endpoint, { ...options, body });
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  /**
   * Get or refresh user authentication token
   */
  async getAuthToken() {
    // Return cached token if still valid
    if (userToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
      return userToken;
    }

    // Check database for stored token
    const stored = await this.getStoredToken();
    if (stored && stored.user_token && new Date(stored.user_token_expires_at) > new Date()) {
      userToken = stored.user_token;
      tokenExpiresAt = new Date(stored.user_token_expires_at).getTime();
      return userToken;
    }

    // Get fresh token
    if (this.staffUsername && this.staffPassword) {
      return this.authenticate();
    }

    return null;
  }

  /**
   * Authenticate with staff credentials to get user token
   */
  async authenticate() {
    try {
      const response = await this.post('/usertoken/issue', {
        Username: this.staffUsername,
        Password: this.staffPassword,
      });

      if (response.AccessToken) {
        userToken = response.AccessToken;
        // Tokens typically expire in 7 days
        tokenExpiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

        // Store in database
        await this.storeToken(userToken, new Date(tokenExpiresAt));

        return userToken;
      }
    } catch (error) {
      console.error('[MindBody] Authentication failed:', error.message);
    }
    return null;
  }

  async getStoredToken() {
    const result = await db.query(
      'SELECT user_token, user_token_expires_at FROM mindbody_config WHERE site_id = $1',
      [this.siteId]
    );
    return result.rows[0];
  }

  async storeToken(token, expiresAt) {
    await db.query(`
      UPDATE mindbody_config
      SET user_token = $1, user_token_expires_at = $2, updated_at = NOW()
      WHERE site_id = $3
    `, [token, expiresAt, this.siteId]);
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  checkRateLimit() {
    const now = Date.now();
    if (now - lastResetTime > RESET_INTERVAL_MS) {
      requestCount = 0;
      lastResetTime = now;
    }

    if (requestCount >= DAILY_LIMIT) {
      console.warn(`[MindBody] Approaching daily API limit: ${requestCount}/${DAILY_LIMIT}`);
    }
  }

  getRateLimitStatus() {
    return {
      requestsUsed: requestCount,
      dailyLimit: DAILY_LIMIT,
      resetsIn: RESET_INTERVAL_MS - (Date.now() - lastResetTime),
    };
  }

  // ============================================
  // SITE ENDPOINTS
  // ============================================

  /**
   * Get site information
   */
  async getSites() {
    return this.get('/site/sites');
  }

  /**
   * Get site locations
   */
  async getLocations() {
    return this.get('/site/locations');
  }

  /**
   * Get site resources (rooms, equipment)
   */
  async getResources() {
    return this.get('/site/resources');
  }

  /**
   * Get activation code for site access
   */
  async getActivationCode() {
    return this.get('/site/activationcode');
  }

  // ============================================
  // CLASS ENDPOINTS
  // ============================================

  /**
   * Get classes (scheduled class instances)
   * @param {Object} options - Filter options
   * @param {Date} options.startDateTime - Start of date range
   * @param {Date} options.endDateTime - End of date range
   * @param {Array} options.classDescriptionIds - Filter by class types
   * @param {Array} options.staffIds - Filter by teacher
   * @param {Array} options.locationIds - Filter by location
   */
  async getClasses(options = {}) {
    const params = {
      StartDateTime: options.startDateTime?.toISOString(),
      EndDateTime: options.endDateTime?.toISOString(),
      ClassDescriptionIds: options.classDescriptionIds,
      StaffIds: options.staffIds,
      LocationIds: options.locationIds,
      HideCanceledClasses: options.hideCancelled ?? false,
      SchedulingWindow: options.schedulingWindow ?? false,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/class/classes', { params });
  }

  /**
   * Get class descriptions (class types/templates)
   */
  async getClassDescriptions(options = {}) {
    const params = {
      LocationIds: options.locationIds,
      StaffIds: options.staffIds,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/class/classdescriptions', { params });
  }

  /**
   * Get class schedules (recurring schedule templates)
   */
  async getClassSchedules(options = {}) {
    const params = {
      StartDate: options.startDate,
      EndDate: options.endDate,
      LocationIds: options.locationIds,
      StaffIds: options.staffIds,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/class/classschedules', { params });
  }

  /**
   * Get class visits (who's booked for a class)
   */
  async getClassVisits(classId) {
    return this.get('/class/classvisits', {
      params: { ClassId: classId },
      requiresAuth: true,
    });
  }

  /**
   * Add client to class (book a class)
   */
  async addClientToClass(clientId, classId, options = {}) {
    return this.post('/class/addclienttoclass', {
      ClientId: clientId,
      ClassId: classId,
      Test: options.test || false,
      RequirePayment: options.requirePayment ?? true,
      Waitlist: options.waitlist ?? false,
      SendEmail: options.sendEmail ?? true,
    }, { requiresAuth: true });
  }

  /**
   * Remove client from class (cancel booking)
   */
  async removeClientFromClass(clientId, classId, options = {}) {
    return this.post('/class/removeclientfromclass', {
      ClientId: clientId,
      ClassId: classId,
      Test: options.test || false,
      LateCancel: options.lateCancel ?? false,
      SendEmail: options.sendEmail ?? true,
    }, { requiresAuth: true });
  }

  // ============================================
  // CLIENT ENDPOINTS
  // ============================================

  /**
   * Get clients (members/students)
   */
  async getClients(options = {}) {
    const params = {
      SearchText: options.searchText,
      ClientIds: options.clientIds,
      IsProspect: options.isProspect,
      LastModifiedDate: options.lastModifiedDate?.toISOString(),
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/client/clients', { params, requiresAuth: true });
  }

  /**
   * Get a single client by ID
   */
  async getClient(clientId) {
    const result = await this.getClients({ clientIds: [clientId] });
    return result.Clients?.[0];
  }

  /**
   * Add a new client
   */
  async addClient(clientData) {
    return this.post('/client/addclient', clientData, { requiresAuth: true });
  }

  /**
   * Update client information
   */
  async updateClient(clientData) {
    return this.post('/client/updateclient', {
      Client: clientData,
    }, { requiresAuth: true });
  }

  /**
   * Get client services (memberships, class packs)
   */
  async getClientServices(clientId, options = {}) {
    const params = {
      ClientId: clientId,
      ProgramIds: options.programIds,
      SessionTypeId: options.sessionTypeId,
      LocationIds: options.locationIds,
      VisitCount: options.visitCount,
      StartDate: options.startDate?.toISOString(),
      EndDate: options.endDate?.toISOString(),
      ShowActiveOnly: options.showActiveOnly ?? true,
      Limit: options.limit || 100,
      Offset: options.offset || 0,
    };

    return this.get('/client/clientservices', { params, requiresAuth: true });
  }

  /**
   * Get client contracts (memberships)
   */
  async getClientContracts(clientId, options = {}) {
    const params = {
      ClientId: clientId,
      Limit: options.limit || 100,
      Offset: options.offset || 0,
    };

    return this.get('/client/clientcontracts', { params, requiresAuth: true });
  }

  /**
   * Get client visits (booking history)
   */
  async getClientVisits(clientId, options = {}) {
    const params = {
      ClientId: clientId,
      StartDate: options.startDate?.toISOString(),
      EndDate: options.endDate?.toISOString(),
      UnpaidsOnly: options.unpaidsOnly,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/client/clientvisits', { params, requiresAuth: true });
  }

  /**
   * Get client account balances
   */
  async getClientAccountBalances(clientId) {
    return this.get('/client/clientaccountbalances', {
      params: { ClientId: clientId },
      requiresAuth: true,
    });
  }

  /**
   * Get required client fields for signup
   */
  async getRequiredClientFields() {
    return this.get('/client/requiredclientfields', { requiresAuth: true });
  }

  // ============================================
  // STAFF ENDPOINTS
  // ============================================

  /**
   * Get staff members (teachers/instructors)
   */
  async getStaff(options = {}) {
    const params = {
      StaffIds: options.staffIds,
      Filters: options.filters,
      LocationId: options.locationId,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/staff/staff', { params });
  }

  /**
   * Get a single staff member by ID
   */
  async getStaffMember(staffId) {
    const result = await this.getStaff({ staffIds: [staffId] });
    return result.StaffMembers?.[0];
  }

  // ============================================
  // SALE/SERVICE ENDPOINTS
  // ============================================

  /**
   * Get services (class packs, memberships for sale)
   */
  async getServices(options = {}) {
    const params = {
      ProgramIds: options.programIds,
      SessionTypeIds: options.sessionTypeIds,
      ServiceIds: options.serviceIds,
      LocationId: options.locationId,
      HideRelatedPrograms: options.hideRelatedPrograms ?? false,
      StaffId: options.staffId,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/sale/services', { params });
  }

  /**
   * Get contracts (membership options)
   */
  async getContracts(options = {}) {
    const params = {
      ContractIds: options.contractIds,
      LocationId: options.locationId,
      SoldOnline: options.soldOnline,
      ConsumerId: options.consumerId,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/sale/contracts', { params });
  }

  /**
   * Get products (retail items)
   */
  async getProducts(options = {}) {
    const params = {
      CategoryIds: options.categoryIds,
      SubCategoryIds: options.subCategoryIds,
      ProductIds: options.productIds,
      SearchText: options.searchText,
      SellOnline: options.sellOnline,
      LocationId: options.locationId,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/sale/products', { params });
  }

  /**
   * Checkout / complete a sale
   */
  async checkoutShoppingCart(cart) {
    return this.post('/sale/checkoutshoppingcart', cart, { requiresAuth: true });
  }

  /**
   * Get sales (transactions)
   */
  async getSales(options = {}) {
    const params = {
      StartSaleDateTime: options.startDate?.toISOString(),
      EndSaleDateTime: options.endDate?.toISOString(),
      SaleId: options.saleId,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/sale/sales', { params, requiresAuth: true });
  }

  // ============================================
  // APPOINTMENT ENDPOINTS
  // ============================================

  /**
   * Get appointments
   */
  async getAppointments(options = {}) {
    const params = {
      StartDate: options.startDate?.toISOString(),
      EndDate: options.endDate?.toISOString(),
      StaffIds: options.staffIds,
      ClientIds: options.clientIds,
      LocationIds: options.locationIds,
      AppointmentIds: options.appointmentIds,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/appointment/appointments', { params, requiresAuth: true });
  }

  /**
   * Get bookable appointment times
   */
  async getBookableItems(options = {}) {
    const params = {
      SessionTypeIds: options.sessionTypeIds,
      StartDate: options.startDate?.toISOString(),
      EndDate: options.endDate?.toISOString(),
      StaffIds: options.staffIds,
      LocationIds: options.locationIds,
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/appointment/bookableitems', { params });
  }

  /**
   * Add a new appointment
   */
  async addAppointment(appointmentData) {
    return this.post('/appointment/addappointment', appointmentData, { requiresAuth: true });
  }

  // ============================================
  // ENROLLMENT ENDPOINTS
  // ============================================

  /**
   * Get enrollments (course/series enrollments)
   */
  async getEnrollments(options = {}) {
    const params = {
      ClassScheduleIds: options.classScheduleIds,
      CourseIds: options.courseIds,
      LocationIds: options.locationIds,
      StaffIds: options.staffIds,
      StartEnrollmentDate: options.startDate?.toISOString(),
      EndEnrollmentDate: options.endDate?.toISOString(),
      Limit: options.limit || 200,
      Offset: options.offset || 0,
    };

    return this.get('/enrollment/enrollments', { params });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Test connection to MindBody API
   */
  async testConnection() {
    try {
      const sites = await this.getSites();
      return {
        success: true,
        siteInfo: sites.Sites?.[0],
        rateLimitStatus: this.getRateLimitStatus(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Paginate through all results
   */
  async getAllPaginated(method, options = {}, dataKey) {
    const allResults = [];
    const limit = options.limit || 200;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await method.call(this, { ...options, limit, offset });
      const data = response[dataKey] || [];
      allResults.push(...data);

      if (data.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }

      // Safety limit to prevent infinite loops
      if (allResults.length > 10000) {
        console.warn('[MindBody] Pagination safety limit reached');
        break;
      }
    }

    return allResults;
  }
}

// Singleton instance
let instance = null;

function getClient(config) {
  if (!instance || config) {
    instance = new MindbodyClient(config);
  }
  return instance;
}

module.exports = {
  MindbodyClient,
  getClient,
};
