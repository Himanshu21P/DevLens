/**
 * Utility functions for exporting developer analytics reports in JSON, Markdown, and PDF formats.
 */

/**
 * Triggers a browser download of the report in JSON format.
 * 
 * @param {object} report - The full developer report payload
 */
export const exportToJson = (report) => {
  const username = report.targetGithubUsername || 'Developer';
  const filename = `${username}_DevLens_Report.json`;
  const jsonStr = JSON.stringify(report, null, 2);
  
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Parses and formats the report payload into a readable Markdown document and initiates download.
 * 
 * @param {object} report - The full developer report payload
 */
export const exportToMarkdown = (report) => {
  const username = report.targetGithubUsername || 'Developer';
  const filename = `${username}_DevLens_Report.md`;
  const scores = report.scoreBreakdown?.categories || {};
  const resumeBreakdown = report.resumeBreakdown || {};
  const roadmap = report.learningRoadmap || {};
  const milestones = roadmap.milestones || [];
  const prep = report.interviewPrep || {};

  let md = `# DevLens Analytics - Developer Quality Audit Report\n\n`;
  md += `**Target Profile:** @${username}\n`;
  md += `**Overall Developer Score:** ${report.developerScore} / 100\n`;
  md += `**Generated At:** ${new Date(report.createdAt || Date.now()).toUTCString()}\n\n`;
  md += `---\n\n`;

  md += `## 1. Deterministic Capability Analytics\n\n`;
  Object.entries(scores).forEach(([key, cat]) => {
    const formattedName = key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
    md += `- **${formattedName}:** ${cat.score} / 100\n`;
  });
  md += `\n---\n\n`;

  md += `## 2. AI Qualitative Executive Summary\n\n`;
  md += `${report.aiSummary || 'No qualitative summary generated.'}\n\n`;
  md += `---\n\n`;

  md += `## 3. Core Strengths & Areas for Development\n\n`;
  md += `### Core Strengths\n`;
  (report.strengths || []).forEach((s) => {
    md += `- ${s}\n`;
  });
  md += `\n### Areas for Development\n`;
  (report.weaknesses || []).forEach((w) => {
    md += `- ${w}\n`;
  });
  md += `\n---\n\n`;

  md += `## 4. Resume Readiness & Insights (Rating: ${report.resumeReadinessStars || 0} / 5 Stars)\n\n`;
  md += `> *"${resumeBreakdown.careerInsights || 'No insights compiled.'}"*\n\n`;
  md += `### High Impact Achievement Suggestions:\n`;
  (resumeBreakdown.bulletPoints || []).forEach((bp) => {
    md += `- ${bp}\n`;
  });
  md += `\n---\n\n`;

  md += `## 5. Customized AI Learning Roadmap\n\n`;
  if (milestones.length === 0) {
    md += `No learning roadmap compiled.\n`;
  } else {
    milestones.forEach((m) => {
      md += `### ${m.phase}: ${m.topic}\n`;
      md += `- **Priority Level:** ${m.priority || 'MEDIUM'}\n`;
      md += `- **Expected Score Improvement:** +${m.expectedScoreImprovement || 0} points\n`;
      md += `- **Estimated Time:** ${m.estimatedTime || 'N/A'}\n`;
      md += `- **Actionable Milestones:**\n`;
      (m.actionableSteps || []).forEach((step) => {
        md += `  - ${step}\n`;
      });
      md += `- **Suggested Reference Resources:**\n`;
      (m.suggestedResources || []).forEach((res) => {
        md += `  - ${res}\n`;
      });
      md += `\n`;
    });
  }
  md += `---\n\n`;

  md += `## 6. Interactive Interview Preparation\n\n`;
  md += `### Likely Questions & Recommended Answers:\n`;
  const questions = prep.likelyQuestions || [];
  const talkingPoints = prep.talkingPoints || [];
  if (questions.length === 0) {
    md += `No interview prep questions compiled.\n`;
  } else {
    questions.forEach((q, idx) => {
      md += `**Q: ${q}**\n`;
      md += `*Talking Point Suggestion:* ${talkingPoints[idx] || 'Refer to core engineering experiences.'}\n\n`;
    });
  }
  md += `### Advanced Computer Science Concepts to Review:\n`;
  (prep.conceptsToReview || []).forEach((concept) => {
    md += `- ${concept}\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Triggers a browser download of a PDF binary stream.
 * 
 * @param {Blob} pdfBlob - The PDF binary blob returned by the backend api
 * @param {string} username - Target developer username
 */
export const downloadPdfFile = (pdfBlob, username) => {
  const filename = `${username}_Capability_Audit_Report.pdf`;
  const url = URL.createObjectURL(pdfBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
