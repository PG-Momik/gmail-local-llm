import config from '../config/config.js';

export async function createEmailClassifier() {
  const SYSTEM_PROMPT = `
  You are an AI assistant specialized in analyzing job-related emails.
  Your task is to analyze the provided email snippet and classify it into the following structured JSON format:

  Respond ONLY with this JSON format:
  {
    "is_related_to_job": boolean,
    "is_automated": boolean,
    "snippet": string|null,
    "category": "rejection" | "interview" | "application" | "offer" | "followup" | "alert" | "other",    
    "source_platform": string | null,
    "job_title": string | null,
    "company": string | null,
    "location": string | null,
    "is_international": boolean
  }

  Where each property basically describes:
    is_related_to_job - Mail is related to job or not. This can be determined by the contents of the email.
    is_automated - Mail is automated mail or not. This can be determined based on the email sender's email address.
    snippet - Short summary of mail. 1 liner. This should reflect the nature of the email and category.
    category - Type of mail. The category depends on the nature of the mail. You have to figure out if the mail is just an alert, or a confirmation mail for my application or an alert of me being rejected. BE EXTRA METICULOUS HERE.
    source_platform - Platform that the mail came from (LinkedIn, ZipRecruiter, Indeed, their own platform)
    job_title - Job title mentioned in the mail. Most likely this can be found in the email body.
    company - Name of the company. This can be found in the email body as well.
    location - What kind of role was it, remote, onsite, hybrid. This can be figured out using email body, job title on the email body, you'll find clues like APAC, EMAM, US, Worldwide, etc.
    is_international - If the company is outside Nepal, consider it international
  
  Rules:
  - Respond ONLY with a valid JSON object. Do NOT include Markdown, code blocks, or any text outside the JSON.
  - Set fields to null if the information is not present or unclear.
  - Insert null values if the values are indeterminate.

  `;

  async function classify(emailSnippet, gmailId, from, subject, mailReceivedOn) {
    console.log('Classifying email snippet:', emailSnippet, '\n');
    try {
      const truncatedSnippet = emailSnippet.substring(0, config.llm.maxSnippetLength);
      const prompt = `
      Analyze this email snippet and classify it according to the provided instructions.
      Email snippet: "${truncatedSnippet}"
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

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('LLM Response:', data.message.content);

      const result = JSON.parse(data.message.content);

      return {
        gmailId,
        ...result,
        mail_received_on: mailReceivedOn
      };
    } catch (error) {
      console.error('Error in email classification:', error.message);
      return fallbackClassification(emailSnippet, gmailId, from, subject, mailReceivedOn);
    }
  }

  function fallbackClassification(emailSnippet, gmailId, from, subject, mailReceivedOn) {
    const lowerSnippet = emailSnippet.toLowerCase();
    const rejectionKeywords = config.llm.rejectionKeywords;

    const isRejection = rejectionKeywords.some(keyword =>
        lowerSnippet.includes(keyword.toLowerCase())
    );

    return {
      gmailId,
      is_related_to_job: true,
      is_automated: false,
      snippet: "Fallback: Could not confidently classify email.",
      category: isRejection ? "rejection" : "other",
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