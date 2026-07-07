const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// KV Store Simulation (for local development)
// In production with Cloudflare Workers, replace with actual KV bindings
class KVStore {
  constructor() {
    this.data = {
      numbers: {},
      messages: {},
      areaCodes: {}
    };
  }

  async get(key) {
    return this.data[key] || null;
  }

  async put(key, value) {
    this.data[key] = value;
    return true;
  }

  async delete(key) {
    delete this.data[key];
    return true;
  }

  async list(prefix = '') {
    return Object.keys(this.data).filter(key => key.startsWith(prefix));
  }
}

const kv = new KVStore();

// Mock phone number data by area code
const availableNumbers = {
  '212': [
    { number: '212-555-0101', price: 5.99, available: true },
    { number: '212-555-0102', price: 5.99, available: true },
    { number: '212-555-0103', price: 5.99, available: false }
  ],
  '415': [
    { number: '415-555-0201', price: 5.99, available: true },
    { number: '415-555-0202', price: 5.99, available: true }
  ],
  '310': [
    { number: '310-555-0301', price: 5.99, available: true },
    { number: '310-555-0302', price: 5.99, available: false }
  ],
  '206': [
    { number: '206-555-0401', price: 5.99, available: true },
    { number: '206-555-0402', price: 5.99, available: true }
  ]
};

// Valid US area codes
const validAreaCodes = ['212', '415', '310', '206', '312', '602', '480', '623', '623', '480'];

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /search
 * Search for available US phone numbers by area code
 * Query: areaCode (required) - US area code (3 digits)
 */
app.get('/search', async (req, res) => {
  try {
    const { areaCode } = req.query;

    // Validation
    if (!areaCode) {
      return res.status(400).json({
        error: 'Area code is required',
        example: '/search?areaCode=212'
      });
    }

    if (!/^\d{3}$/.test(areaCode)) {
      return res.status(400).json({
        error: 'Area code must be exactly 3 digits'
      });
    }

    // Get numbers for area code
    const numbers = availableNumbers[areaCode] || [];
    const availableOnly = numbers.filter(n => n.available);

    if (availableOnly.length === 0) {
      return res.status(404).json({
        message: `No available numbers found for area code ${areaCode}`,
        areaCode: areaCode
      });
    }

    res.json({
      areaCode: areaCode,
      count: availableOnly.length,
      numbers: availableOnly
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/buy
 * Purchase a US phone number
 * Body: { number: string, areaCode: string }
 */
app.post('/api/buy', async (req, res) => {
  try {
    const { number, areaCode } = req.body;

    // Validation
    if (!number || !areaCode) {
      return res.status(400).json({
        error: 'Both number and areaCode are required',
        example: { number: '212-555-0101', areaCode: '212' }
      });
    }

    // Check if number exists in area code
    const numberData = availableNumbers[areaCode];
    if (!numberData) {
      return res.status(404).json({
        error: `Area code ${areaCode} not found`
      });
    }

    const phoneRecord = numberData.find(n => n.number === number);
    if (!phoneRecord) {
      return res.status(404).json({
        error: `Number ${number} not found in area code ${areaCode}`
      });
    }

    if (!phoneRecord.available) {
      return res.status(409).json({
        error: `Number ${number} is already purchased`
      });
    }

    // Purchase the number
    phoneRecord.available = false;
    phoneRecord.purchasedAt = new Date().toISOString();
    phoneRecord.purchasedBy = req.body.userId || 'anonymous';

    // Store in KV
    await kv.put(`number:${number}`, JSON.stringify(phoneRecord));

    res.status(201).json({
      success: true,
      message: `Successfully purchased ${number}`,
      details: {
        number: number,
        areaCode: areaCode,
        price: phoneRecord.price,
        purchasedAt: phoneRecord.purchasedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /list-numbers
 * List all phone numbers (optionally filtered by area code or status)
 * Query: areaCode (optional), purchased (optional - true/false)
 */
app.get('/list-numbers', async (req, res) => {
  try {
    const { areaCode, purchased } = req.query;
    let allNumbers = [];

    // Collect all numbers
    Object.entries(availableNumbers).forEach(([code, numbers]) => {
      if (areaCode && code !== areaCode) return;

      numbers.forEach(num => {
        if (purchased !== undefined) {
          const isPurchased = !num.available;
          if (purchased === 'true' && !isPurchased) return;
          if (purchased === 'false' && isPurchased) return;
        }
        allNumbers.push({
          ...num,
          areaCode: code
        });
      });
    });

    res.json({
      total: allNumbers.length,
      filters: {
        areaCode: areaCode || 'all',
        purchased: purchased || 'all'
      },
      numbers: allNumbers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /list-messages
 * List all messages (SMS/communication history for purchased numbers)
 * Query: number (optional), limit (optional, default 50)
 */
app.get('/list-messages', async (req, res) => {
  try {
    const { number, limit = 50 } = req.query;

    // Retrieve messages from KV
    const messagesKey = number ? `messages:${number}` : 'messages:all';
    const messages = await kv.get(messagesKey) || [];

    // If parsing from JSON string
    const parsedMessages = typeof messages === 'string' ? JSON.parse(messages) : messages;
    const limitedMessages = Array.isArray(parsedMessages) 
      ? parsedMessages.slice(0, parseInt(limit))
      : [];

    res.json({
      number: number || 'all',
      total: limitedMessages.length,
      limit: parseInt(limit),
      messages: limitedMessages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /list-messages
 * Save/log a new message
 * Body: { number: string, from: string, to: string, content: string, type: 'inbound'|'outbound' }
 */
app.post('/list-messages', async (req, res) => {
  try {
    const { number, from, to, content, type = 'inbound' } = req.body;

    // Validation
    if (!number || !from || !to || !content) {
      return res.status(400).json({
        error: 'number, from, to, and content are required',
        example: {
          number: '212-555-0101',
          from: '+12125550101',
          to: '+12025551234',
          content: 'Hello, this is a test message',
          type: 'inbound'
        }
      });
    }

    const message = {
      id: `msg_${Date.now()}`,
      number: number,
      from: from,
      to: to,
      content: content,
      type: type,
      timestamp: new Date().toISOString()
    };

    // Retrieve existing messages for this number
    const messagesKey = `messages:${number}`;
    let messages = await kv.get(messagesKey);
    messages = typeof messages === 'string' ? JSON.parse(messages) : (messages || []);

    // Add new message
    messages.push(message);

    // Store updated messages
    await kv.put(messagesKey, JSON.stringify(messages));

    res.status(201).json({
      success: true,
      message: 'Message logged successfully',
      details: message
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/area-codes
 * List all available area codes
 */
app.get('/api/area-codes', (req, res) => {
  res.json({
    total: validAreaCodes.length,
    areaCodes: validAreaCodes,
    availableByCode: Object.fromEntries(
      Object.entries(availableNumbers).map(([code, numbers]) => [
        code,
        numbers.filter(n => n.available).length
      ])
    )
  });
});

// ============================================
// ERROR HANDLING
// ============================================

/**
 * 404 Not Found
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint ${req.path} does not exist`,
    availableEndpoints: [
      'GET /search?areaCode=XXX',
      'POST /api/buy',
      'GET /list-numbers',
      'GET /list-messages',
      'POST /list-messages',
      'GET /api/area-codes',
      'GET /health'
    ]
  });
});

/**
 * General error handler
 */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     US Phone Number Management Server                  ║
║                                                        ║
║  Server running on http://localhost:${PORT}           ║
║                                                        ║
║  Available Endpoints:                                  ║
║  • GET  /search?areaCode=212                          ║
║  • POST /api/buy                                      ║
║  • GET  /list-numbers                                 ║
║  • GET  /list-messages                                ║
║  • POST /list-messages                                ║
║  • GET  /api/area-codes                               ║
║  • GET  /health                                       ║
║                                                        ║
║  Documentation: http://localhost:${PORT}/api-docs     ║
╚════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
