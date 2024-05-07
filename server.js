const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const port = 3000;

// Add session middleware
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

// replace with your 'Domain name' from Frontegg Portal ➜ [ENVIRONMENT] ➜ Env Settings ➜ Domains:
const vendorHost = 'YOUR_FRONTEGG_VENDOR_HOST'

// Replace with your Frontegg vendor token and client ID:
const fronteggBearerToken = 'YOUR_FRONTEGG_BEARER_TOKEN'; // https://docs.frontegg.com/reference/authenticate_vendor
const fronteggClientId = 'YOUR_FRONT_CLIENT_ID';

// Replace with your Microsoft API credentials:
const microsoftClientId = 'YOUR_MICROSOFT_CLIENT_ID';
const microsoftRedirectUri = `http://localhost:${port}/oauth/callback`;

const microsoftAuthEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const microsoftResourceUrl = 'https://graph.microsoft.com/user.read';

const fronteggMicrosoftConfigEndpoint = 'https://api.frontegg.com/identity/resources/sso/v2'; // Frontegg endpoint for Microsoft login config

// Function to generate a random string for the code verifier
const generateRandomString = (length) => {
  return crypto.randomBytes(length).toString('hex');
};

// Function to generate the code challenge from the code verifier
const generateCodeChallenge = (codeVerifier) => {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

app.get('/', (req, res) => {
  res.send('Welcome to the social login example.\nVisit /auth/microsoft to start Microsoft authentication.');
});

// Step 1: Get the Microsoft config from Frontegg
app.get('/auth/microsoft', async (req, res) => {
  try {
    console.log('Step 1: Getting Microsoft config from Frontegg');
    const fronteggConfigResponse = await axios.get(fronteggMicrosoftConfigEndpoint, {
      headers: {
        Authorization: `Bearer ${fronteggBearerToken}`,
        'Cookie': `fe_device_${fronteggClientId}=your-device-id`,
      },
    });

    const microsoftConfig = fronteggConfigResponse.data.find(config => config.type === 'microsoft');
    console.log(`\nMicrosoft config:\n${JSON.stringify(microsoftConfig)}`);

    // Step 2: Redirect to Microsoft authentication using values from the response in step 1
    console.log('\nStep 2: Redirecting to Microsoft authentication');
    const state = encodeURIComponent(JSON.stringify({ provider: 'Microsoft', action: 'login' }));

    // Generate code verifier and code challenge
    const codeVerifier = generateRandomString(64);
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const scope = encodeURIComponent(`openid profile ${microsoftResourceUrl}`);
    const microsoftAuthUrl = `${microsoftAuthEndpoint}?response_type=code&scope=${scope}&redirect_uri=${microsoftRedirectUri}&client_id=${microsoftClientId}&include_granted_scopes=true&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    console.log(`microsoftAuthUrl: ${microsoftAuthUrl}`)
    // Store code verifier in session for later use
    req.session.codeVerifier = codeVerifier;

    res.redirect(microsoftAuthUrl);
  } catch (error) {
    console.error('Error getting Microsoft config from Frontegg:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Step 3: Get Response from Microsoft after login
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  try {
    console.log('\nStep 3: Handling response from Microsoft');
    // Step 4: Microsoft postlogin
    const fronteggMicrosoftPostLoginEndpoint = `https://${vendorHost}.frontegg.com/frontegg/identity/resources/auth/v1/user/sso/microsoft/postlogin?code=${code}&state=${state}&redirectUri=${microsoftRedirectUri}&code_verifier=${req.session.codeVerifier}`;
    console.log(`\nfronteggMicrosoftPostLoginEndpoint:\n${fronteggMicrosoftPostLoginEndpoint}`)
    const postLoginResponse = await axios.post(fronteggMicrosoftPostLoginEndpoint, null, {
      headers: {
        Authorization: `Bearer ${fronteggBearerToken}`,
      },
    });

    // Log the response
    console.log('\nResponse from Microsoft postlogin:', postLoginResponse);

    res.send('\nMicrosoft login successful!');
  } catch (error) {
    console.error('Error during Microsoft postlogin:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
