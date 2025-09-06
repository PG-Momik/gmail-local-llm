import config from '../config/config.js';

export function createEmailProcessor(gmail, classifier) {
  // const JOB_KEYWORDS = ['application', 'apply', 'job', 'role', 'position', 'career', 'application'];

  const buildJobSearchQuery = (baseQuery) => {
    return `${baseQuery} -from:*github* -subject:"GitHub" -label:github`;
  }
    // const keywordQuery = JOB_KEYWORDS.map(kw => `(${kw})`).join(' OR ');
    // return `${baseQuery} (${keywordQuery}) -from:no-reply*`;  };

  async function getEmailEstimate(searchQuery) {
    const jobSearchQuery = buildJobSearchQuery(searchQuery);
    const estimateRes = await gmail.users.messages.list({
      userId: 'me',
      q: jobSearchQuery,
      maxResults: 1,
    });
    return estimateRes.data.resultSizeEstimate;
  }

  async function fetchEmailBatch(searchQuery, pageToken = null) {
    const jobSearchQuery = buildJobSearchQuery(searchQuery);
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: jobSearchQuery,
      maxResults: config.gmail.batchSize,
      pageToken: pageToken,
    });

    return {
      messages: res.data.messages || [],
      nextPageToken: res.data.nextPageToken
    };
  }

  async function processEmailBatch(messageIds) {
    const results = [];
    for (const messageId of messageIds) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });
        const emailData = extractEmailData(msg.data);
        const analysis = await classifier.classify(
            emailData.body,
            messageId,
            emailData.from,
            emailData.subject
        );
        results.push(analysis);
      } catch (error) {
        console.error(`Error processing message ${messageId}:`, error.message);
      }
    }
    return results;
  }

  function extractEmailData(messageData) {
    const headers = messageData.payload.headers;
    const subjectHeader = headers.find(h => h.name === 'Subject') || { value: 'No Subject' };
    const fromHeader = headers.find(h => h.name === 'From') || { value: 'Unknown Sender' };

    // Extract the full email body
    let body = '';
    if (messageData.payload.mimeType === 'text/plain') {
      body = Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
    } else if (messageData.payload.mimeType === 'multipart/alternative' ||
        messageData.payload.mimeType === 'multipart/mixed') {
      const textPart = messageData.payload.parts.find(part =>
          part.mimeType === 'text/plain'
      );
      if (textPart) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      } else {
        const htmlPart = messageData.payload.parts.find(part =>
            part.mimeType === 'text/html'
        );
        if (htmlPart) {
          body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
          body = body.replace(/<[^>]*>/g, '');
        }
      }
    }

    return {
      from: fromHeader.value,
      subject: subjectHeader.value,
      snippet: messageData.snippet,
      body: body || messageData.snippet
    };
  }

  return {
    getEmailEstimate,
    fetchEmailBatch,
    processEmailBatch
  };
}
