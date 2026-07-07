#!/usr/bin/env node

const readline = require('readline');
const http = require('http');
const https = require('https');
const url = require('url');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(`${SERVER_URL}${endpoint}`);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      method: method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = client.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function printHeader() {
  console.clear();
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     📱 US Phone Number Management CLI                     ║
║                                                           ║
║  Server: ${SERVER_URL.padEnd(47)}║
╚═══════════════════════════════════════════════════════════╝
  `);
}

function printMenu() {
  console.log(`
┌───────────────────────────────────────────────────────────┐
│                    MAIN MENU                              │
├───────────────────────────────────────────────────────────┤
│  1. 🔍 Search Numbers by Area Code                        │
│  2. 💰 Buy a Phone Number                                 │
│  3. 📋 List All Numbers                                   │
│  4. 💬 View Messages                                      │
│  5. ✉️  Log a New Message                                 │
│  6. 🌐 List Available Area Codes                          │
│  7. 💚 Health Check                                       │
│  8. ⚙️  Settings                                           │
│  0. 🚪 Exit                                               │
└───────────────────────────────────────────────────────────┘
  `);
}

function printSuccess(message) {
  console.log(`\n✅ ${message}\n`);
}

function printError(message) {
  console.log(`\n❌ ${message}\n`);
}

function printInfo(message) {
  console.log(`\nℹ️  ${message}\n`);
}

function printJson(data) {
  console.log('\n' + JSON.stringify(data, null, 2) + '\n');
}

// ============================================
// MENU FUNCTIONS
// ============================================

async function searchNumbers() {
  printHeader();
  console.log('🔍 SEARCH NUMBERS BY AREA CODE\n');

  rl.question('Enter area code (3 digits): ', async (areaCode) => {
    if (!/^\d{3}$/.test(areaCode)) {
      printError('Invalid area code. Must be exactly 3 digits.');
      setTimeout(() => showMenu(), 2000);
      return;
    }

    try {
      const response = await makeRequest('GET', `/search?areaCode=${areaCode}`);
      
      if (response.status === 200) {
        printSuccess(`Found ${response.data.count} available number(s)`);
        printJson(response.data);
      } else if (response.status === 404) {
        printError(response.data.message);
      } else {
        printError(`Error: ${response.data.error}`);
      }
    } catch (error) {
      printError(`Connection error: ${error.message}`);
    }

    setTimeout(() => showMenu(), 3000);
  });
}

async function buyNumber() {
  printHeader();
  console.log('💰 BUY A PHONE NUMBER\n');

  rl.question('Enter area code: ', (areaCode) => {
    rl.question('Enter phone number (e.g., 212-555-0101): ', (number) => {
      rl.question('Enter your user ID (optional): ', async (userId) => {
        try {
          const response = await makeRequest('POST', '/api/buy', {
            number: number,
            areaCode: areaCode,
            userId: userId || 'anonymous'
          });

          if (response.status === 201) {
            printSuccess(response.data.message);
            printJson(response.data.details);
          } else if (response.status === 409) {
            printError('This number is already purchased.');
          } else {
            printError(`Error: ${response.data.error}`);
          }
        } catch (error) {
          printError(`Connection error: ${error.message}`);
        }

        setTimeout(() => showMenu(), 3000);
      });
    });
  });
}

async function listNumbers() {
  printHeader();
  console.log('📋 LIST NUMBERS\n');

  rl.question('Filter by area code (leave empty for all): ', (areaCode) => {
    rl.question('Show only purchased numbers? (yes/no, leave empty for all): ', async (purchased) => {
      try {
        let endpoint = '/list-numbers';
        const params = [];

        if (areaCode.trim()) {
          params.push(`areaCode=${areaCode}`);
        }

        if (purchased.toLowerCase() === 'yes') {
          params.push('purchased=true');
        } else if (purchased.toLowerCase() === 'no') {
          params.push('purchased=false');
        }

        if (params.length > 0) {
          endpoint += '?' + params.join('&');
        }

        const response = await makeRequest('GET', endpoint);

        if (response.status === 200) {
          printSuccess(`Total: ${response.data.total} number(s)`);
          console.log(`Filters: ${JSON.stringify(response.data.filters)}`);
          printJson(response.data.numbers);
        } else {
          printError(`Error: ${response.data.error}`);
        }
      } catch (error) {
        printError(`Connection error: ${error.message}`);
      }

      setTimeout(() => showMenu(), 3000);
    });
  });
}

async function viewMessages() {
  printHeader();
  console.log('💬 VIEW MESSAGES\n');

  rl.question('Enter phone number (leave empty for all): ', (number) => {
    rl.question('Limit results (default 50): ', async (limit) => {
      try {
        let endpoint = '/list-messages';
        const params = [];

        if (number.trim()) {
          params.push(`number=${number}`);
        }

        if (limit.trim()) {
          params.push(`limit=${limit}`);
        }

        if (params.length > 0) {
          endpoint += '?' + params.join('&');
        }

        const response = await makeRequest('GET', endpoint);

        if (response.status === 200) {
          printSuccess(`Total: ${response.data.total} message(s)`);
          printJson(response.data);
        } else {
          printError(`Error: ${response.data.error}`);
        }
      } catch (error) {
        printError(`Connection error: ${error.message}`);
      }

      setTimeout(() => showMenu(), 3000);
    });
  });
}

async function logMessage() {
  printHeader();
  console.log('✉️  LOG A NEW MESSAGE\n');

  rl.question('Phone number: ', (number) => {
    rl.question('From (sender): ', (from) => {
      rl.question('To (recipient): ', (to) => {
        rl.question('Message content: ', (content) => {
          rl.question('Type (inbound/outbound, default inbound): ', async (type) => {
            try {
              const response = await makeRequest('POST', '/list-messages', {
                number: number,
                from: from,
                to: to,
                content: content,
                type: type || 'inbound'
              });

              if (response.status === 201) {
                printSuccess('Message logged successfully!');
                printJson(response.data.details);
              } else {
                printError(`Error: ${response.data.error}`);
              }
            } catch (error) {
              printError(`Connection error: ${error.message}`);
            }

            setTimeout(() => showMenu(), 3000);
          });
        });
      });
    });
  });
}

async function listAreaCodes() {
  printHeader();
  console.log('🌐 AVAILABLE AREA CODES\n');

  try {
    const response = await makeRequest('GET', '/api/area-codes');

    if (response.status === 200) {
      printSuccess(`Total: ${response.data.total} area code(s)`);
      console.log('\nArea Codes:');
      console.log(response.data.areaCodes.join(', '));
      console.log('\nAvailable Numbers by Code:');
      printJson(response.data.availableByCode);
    } else {
      printError(`Error: ${response.data.error}`);
    }
  } catch (error) {
    printError(`Connection error: ${error.message}`);
  }

  setTimeout(() => showMenu(), 3000);
}

async function healthCheck() {
  printHeader();
  console.log('💚 HEALTH CHECK\n');

  try {
    const response = await makeRequest('GET', '/health');

    if (response.status === 200) {
      printSuccess('Server is healthy!');
      printJson(response.data);
    } else {
      printError('Server responded with error');
    }
  } catch (error) {
    printError(`Connection error: ${error.message}`);
  }

  setTimeout(() => showMenu(), 3000);
}

function settings() {
  printHeader();
  console.log('⚙️  SETTINGS\n');
  console.log(`Current Server URL: ${SERVER_URL}`);
  printInfo('To change the server URL, set the SERVER_URL environment variable:');
  console.log('  export SERVER_URL=http://your-server:port');
  console.log('\nPress Enter to return to menu...');

  rl.question('', () => {
    showMenu();
  });
}

function exitProgram() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  👋 Goodbye!                              ║
╚═══════════════════════════════════════════════════════════╝
  `);
  rl.close();
  process.exit(0);
}

// ============================================
// MAIN MENU LOOP
// ============================================

function showMenu() {
  printHeader();
  printMenu();

  rl.question('Select an option (0-8): ', (choice) => {
    switch (choice.trim()) {
      case '1':
        searchNumbers();
        break;
      case '2':
        buyNumber();
        break;
      case '3':
        listNumbers();
        break;
      case '4':
        viewMessages();
        break;
      case '5':
        logMessage();
        break;
      case '6':
        listAreaCodes();
        break;
      case '7':
        healthCheck();
        break;
      case '8':
        settings();
        break;
      case '0':
        exitProgram();
        break;
      default:
        printError('Invalid option. Please select 0-8.');
        setTimeout(() => showMenu(), 1500);
    }
  });
}

// ============================================
// START
// ============================================

console.log('\nStarting CLI...\n');
setTimeout(() => showMenu(), 500);
