import sqlite3 from 'sqlite3';
import config from '../config/config.js';

const { verbose } = sqlite3;

export function createDatabase() {
    const db = new (verbose().Database)(config.database.path);

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS job_emails (
                                                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                          gmail_id TEXT UNIQUE,
                                                          is_related_to_job BOOLEAN,
                                                          is_automated BOOLEAN,
                                                          snippet TEXT,
                                                          category TEXT,
                                                          source_platform TEXT,
                                                          job_title TEXT,
                                                          company TEXT,
                                                          location TEXT,
                                                          is_international BOOLEAN,
                                                          mail_received_on DATE,
                                                          analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);
    });

    return db;
}

export function createEmailStore(db) {
    return {
        async storeResults(results) {
            return new Promise((resolve, reject) => {
                const insertStatement = db.prepare(`
                    INSERT OR IGNORE INTO job_emails (
                        gmail_id, is_related_to_job, is_automated, snippet, category,
                        source_platform, job_title, company, location,
                        is_international, mail_received_on
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let inserted = 0;
                let completed = 0;

                // Filter to only job-related emails
                const jobRelatedResults = results.filter(result =>
                    result.is_related_to_job === true
                );

                const total = jobRelatedResults.length;

                // If no job-related results to insert, resolve immediately
                if (total === 0) {
                    insertStatement.finalize();
                    resolve(0);
                    return;
                }

                for (const result of jobRelatedResults) {
                    insertStatement.run([
                        result.gmailId,
                        result.is_related_to_job,
                        result.is_automated,
                        result.snippet,
                        result.category,
                        result.source_platform,
                        result.job_title,
                        result.company,
                        result.location,
                        result.is_international,
                        result.mail_received_on
                    ], function(err) {
                        if (err) {
                            console.error('Database error:', err);
                        } else if (this.changes > 0) {
                            inserted++;
                        }

                        completed++;

                        if (completed === total) {
                            insertStatement.finalize((err) => {
                                if (err) {
                                    console.error('Error finalizing statement:', err);
                                    reject(err);
                                } else {
                                    resolve(inserted);
                                }
                            });
                        }
                    });
                }
            });
        },

        async close() {
            return new Promise((resolve, reject) => {
                db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    };
}