import config from '../config/config.js';

export async function createEmailClassifier() {
  const SYSTEM_PROMPT = `
    You are an AI email classifier.
    
    Analyze the email and respond ONLY with a JSON object in this format:
    {
      "is_related_to_job": boolean,
      "is_automated": boolean,
      "snippet": string|null,
      "category": "rejection" | "interview" | "application" | "offer" | "followup" | "alert" | "other",
      "source_platform": string|null,
      "job_title": string|null,
      "company": string|null,
      "location": string|null,
      "is_international": boolean
    }
    
    Rules:
    - Categories:
       - alert = multiple job listings, recommendations, alerts (LinkedIn, Indeed, etc.)
       - application = confirmation of YOUR submitted application
       - rejection = not moving forward, regret, unfortunately
       - interview = interview invite/schedule
       - offer = job offer or selection
       - followup = checking status, asking for info
       - other = everything else
    - is_automated = noreply@, bulk alerts, system notifications
    - source_platform = LinkedIn, Indeed, ZipRecruiter, or company domain
    - is_international = true if company/job is outside Nepal
    - snippet = one short sentence summary
    - If info not found, set field to null
    - No extra text, Markdown, or explanation — JSON only
  `;

  async function classify(emailSnippet, gmailId, from, subject, mailReceivedOn) {
    console.log('Classifying email snippet:', emailSnippet, '\n');
    try {
      const truncatedSnippet = emailSnippet.substring(0, config.llm.maxSnippetLength);

      const prompt = `
        FROM: ${from}
        SUBJECT: ${subject}
        CONTENT: "${truncatedSnippet}"
      `;

      const response = await fetch(`${config.llm.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.llm.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          stream: false,
          options: { temperature: config.llm.temperature }
        }),
        signal: AbortSignal.timeout(config.llm.timeout),
      });

      if (!response.ok) throw new Error(`LLM API error: ${response.status} ${response.statusText}`);

      const data = await response.json();
      let cleaned = data.message.content.trim().replace(/^```json\n?|```$/g, '');
      const result = JSON.parse(cleaned);

      return {
        gmailId,
        ...validateAndCleanResult(result),
        mail_received_on: mailReceivedOn
      };
    } catch (error) {
      console.error('Error in classification:', error.message);
      return fallbackClassification(emailSnippet, gmailId, from, subject, mailReceivedOn);
    }
  }

  function validateAndCleanResult(result) {
    const validCategories = ["rejection", "interview", "application", "offer", "followup", "alert", "other"];
    return {
      is_related_to_job: !!result.is_related_to_job,
      is_automated: !!result.is_automated,
      snippet: result.snippet || null,
      category: validCategories.includes(result.category) ? result.category : "other",
      source_platform: result.source_platform || null,
      job_title: result.job_title || null,
      company: result.company || null,
      location: result.location || null,
      is_international: !!result.is_international
    };
  }

  function fallbackClassification(emailSnippet, gmailId, from, subject, mailReceivedOn) {
    const text = `${emailSnippet} ${subject}`.toLowerCase();
    let category = "other";
    if (/unfortunately|regret|not selected|other candidates/.test(text)) category = "rejection";
    else if (/job alert|new jobs|jobs for you|recommendations/.test(text)) category = "alert";
    else if (/application received|thank you for applying|submitted/.test(text)) category = "application";

    return {
      gmailId,
      is_related_to_job: true,
      is_automated: /noreply|no-reply|donotreply/.test(from.toLowerCase()),
      snippet: `Fallback classification: ${category}`,
      category,
      source_platform: null,
      job_title: null,
      company: null,
      location: null,
      is_international: false,
      mail_received_on: mailReceivedOn
    };
  }

  return { classify };
}
