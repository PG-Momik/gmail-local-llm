import config from './config/config.js';
import { createDatabase, createEmailStore } from './database/database.js';
import { createGmailAuth, createGmailClient } from './services/gmail-auth.js';
import { createEmailProcessor } from './services/email-processor.js';
import { createEmailClassifier } from './services/email-classifier.js';
import { createBatchProcessor } from './services/batch-processor.js';
import { createLogger } from './utils/logger.js';

async function main() {
  const logger = createLogger();
  
  logger.info('Starting Gmail rejection analysis...');
  logger.info('Initializing database...');
  
  const db = createDatabase();
  const emailStore = createEmailStore(db);
  
  try {
    logger.info('Authenticating with Gmail...');
    const auth = await createGmailAuth();
    const gmail = createGmailClient(auth);

    const classifier = await createEmailClassifier();
    const emailProcessor = createEmailProcessor(gmail, classifier);
    const batchProcessor = createBatchProcessor(emailProcessor, emailStore);
    
    logger.info(`Using search query: "${config.gmail.searchQuery}"`);
    
    const { processedCount, rejectionCount } = await batchProcessor.processAllEmails(config.gmail.searchQuery);
    
    logger.success('Analysis complete!');
    logger.progress(`Total emails processed: ${processedCount}`);
    logger.progress(`Total rejection emails found: ${rejectionCount}`);
    logger.info(`Results stored in: ${config.database.path}`);
    
  } catch (error) {
    logger.error(`Error in main function: ${error}`);
  } finally {
    try {
      await emailStore.close();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error(`Error closing database: ${err}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };