import { google } from 'googleapis';
import readline from 'readline';
import config from "./config/config.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function getTokens() {
  const oauth2Client = new google.auth.OAuth2(
      config.auth.clientId,
      config.auth.clientSecret,
      config.auth.redirectUri
  );

  const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  rl.question('Enter the authorization code you receive: ', async (code) => {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log('\n Success! Add this to your .env file:');
      console.log(`GOOGLE_TOKENS='${JSON.stringify(tokens)}'`);
      
    } catch (error) {
      console.error('Error retrieving access token:', error);
    }
    rl.close();
  });
}

getTokens();