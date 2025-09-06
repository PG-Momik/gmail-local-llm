import config from '../config/config.js';

export function createBatchProcessor(emailProcessor, emailStore) {
  
  async function processAllEmails(searchQuery) {
    console.log('📈 Getting result estimate...');
    const estimatedCount = await emailProcessor.getEmailEstimate(searchQuery);
    console.log(`📊 Estimated messages to process: ${estimatedCount}`);
    
    if (estimatedCount === 0) {
      console.log('No messages found matching your criteria.');
      return { processedCount: 0, rejectionCount: 0 };
    }

    let pageToken = null;
    let processedCount = 0;
    let rejectionCount = 0;
    let batchNumber = 1;

    do {
      console.log(`\n📄 Processing batch #${batchNumber}...`);
      
      const { messages, nextPageToken } = await emailProcessor.fetchEmailBatch(searchQuery, pageToken);
      const messageIds = messages.map(m => m.id);
      
      if (messageIds.length === 0) break;

      const batchResults = await emailProcessor.processEmailBatch(messageIds);
      const insertedCount = await emailStore.storeResults(batchResults);
      
      processedCount += messageIds.length;
      rejectionCount += insertedCount;
      
      logBatchProgress(messageIds.length, insertedCount, processedCount, estimatedCount, rejectionCount);
      
      pageToken = nextPageToken;
      batchNumber++;
      
      await delay(config.gmail.rateLimitDelay);
      
    } while (pageToken && processedCount < estimatedCount);

    return { processedCount, rejectionCount };
  }

  function logBatchProgress(batchSize, insertedCount, processedCount, estimatedCount, totalRejections) {
    console.log(`Processed ${batchSize} emails in this batch`);
    console.log(`Found ${insertedCount} new rejections in this batch`);
    console.log(`Total processed: ${processedCount}/${estimatedCount}`);
    console.log(`Total rejections found: ${totalRejections}`);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return { processAllEmails };
}