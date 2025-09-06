import { google } from 'googleapis';
import config from '../config/config.js';

export async function createGmailAuth() {
  const auth = new google.auth.OAuth2(
    config.auth.clientId,
    config.auth.clientSecret,
    config.auth.redirectUri
  );

  auth.setCredentials(JSON.parse(config.auth.tokens));

  return auth;
}

export function createGmailClient(auth) {
  return google.gmail({ version: 'v1', auth });
}