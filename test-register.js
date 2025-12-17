const http = require('http');

const userData = {
  name: "Admin User",
  email: "admin@cred30.com",
  password: "admin123",
  secretPhrase: "admin",
  pixKey: "admin-pix-key"
};

const postData = JSON.stringify(userData);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Resposta:', data);
  });
});

req.on('error', (error) => {
  console.error('Erro:', error);
});

req.write(postData);
req.end();