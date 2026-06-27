import PDFDocument from 'pdfkit';
import logger from '../utils/logger.js';

class PDFService {
  /**
   * Generates a beautifully styled, print-friendly PDF report from an analysis payload.
   * 
   * @param {object} report - The developer analysis report payload
   * @returns {Promise<Buffer>} The generated PDF as a binary buffer
   */
  async generateDeveloperReportPDF(report) {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Starting PDF generation for target developer: ${report.targetGithubUsername}`);
        
        // Initialize PDF document with a 50pt margin and buffered pages enabled for two-pass numbering
        const doc = new PDFDocument({ margin: 50, bufferPages: true });
        const buffers = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          logger.info(`PDF generation completed successfully for ${report.targetGithubUsername}`);
          resolve(pdfBuffer);
        });
        doc.on('error', (err) => {
          logger.error(`PDF generation failed: ${err.message}`);
          reject(err);
        });

        // Palette definition
        const colors = {
          primary: '#4f46e5',     // Brand Indigo
          secondary: '#06b6d4',   // Cyber Blue
          dark: '#0f172a',        // Dark Slate (Primary Text)
          muted: '#475569',       // Muted Slate (Secondary Text)
          border: '#e2e8f0',      // Light border grey
          bgLight: '#f8fafc',     // Card grey background
          strength: '#10b981',    // Emerald Green
          weakness: '#f43f5e',    // Rose Red
        };

        // --- PAGE 1: COVER PAGE ---
        this.drawCoverPage(doc, report, colors);

        // --- PAGE 2: DETERMINISTIC CAPABILITIES & METRICS ---
        doc.addPage();
        this.drawCapabilitiesAndStats(doc, report, colors);

        // --- PAGE 3: AI QUALITATIVE ASSESSMENT (EXECUTIVE SUMMARY & CORE SKILLS) ---
        doc.addPage();
        this.drawQualitativeAssessment(doc, report, colors);

        // --- PAGE 4: CAREER DEVELOPMENT (ROADMAP & RESUME INSIGHTS) ---
        doc.addPage();
        this.drawCareerDevelopment(doc, report, colors);

        // --- PAGE 5: INTERVIEW PREPARATION PACK ---
        doc.addPage();
        this.drawInterviewPrep(doc, report, colors);

        // --- SECOND PASS: HEADER, FOOTER & SYSTEM DIAGNOSTICS ---
        this.applyHeadersAndFooters(doc, report, colors);

        // Terminate document streaming
        doc.end();
      } catch (err) {
        logger.error(`Fatal PDF generation pipeline crash: ${err.message}`);
        reject(err);
      }
    });
  }

  /**
   * Cover page layout
   */
  drawCoverPage(doc, report, colors) {
    // Top logo branding
    doc.fillColor(colors.primary)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('DEVLENS // ANALYTICS PLATFORM', 50, 80);

    // Decorative vertical line on left
    doc.lineWidth(4)
       .lineCap('square')
       .moveTo(50, 160)
       .lineTo(50, 360)
       .stroke(colors.primary);

    // Document Titles
    doc.fillColor(colors.dark)
       .fontSize(36)
       .font('Helvetica-Bold')
       .text('Developer Quality\nAudit Report', 70, 160, { lineGap: 5 });

    doc.fillColor(colors.muted)
       .fontSize(14)
       .font('Helvetica')
       .text('A comprehensive deterministic capability assessment and AI-powered learning roadmap.', 70, 260, { width: 450, lineGap: 4 });

    // Target Profile block
    doc.fillColor(colors.dark)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('AUDIT TARGET PROFILE:', 70, 340);

    doc.fillColor(colors.primary)
       .fontSize(22)
       .font('Helvetica-Bold')
       .text(`@${report.targetGithubUsername}`, 70, 365);

    // Score Callout Badge Box
    const scoreBoxY = 460;
    doc.rect(70, scoreBoxY, 470, 100)
       .fillColor(colors.bgLight)
       .fill();
    doc.rect(70, scoreBoxY, 470, 100)
       .lineWidth(1)
       .stroke(colors.border);

    // Grade label inside box
    const score = report.developerScore;
    const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';
    const gradeColor = score >= 80 ? colors.strength : score >= 50 ? '#f59e0b' : colors.weakness;

    doc.fillColor(colors.dark)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('OVERALL DEV SCORE', 90, scoreBoxY + 25);

    doc.fillColor(colors.primary)
       .fontSize(38)
       .font('Helvetica-Bold')
       .text(`${score}`, 90, scoreBoxY + 40);

    doc.fillColor(colors.muted)
       .fontSize(14)
       .font('Helvetica')
       .text('/ 100', 160, scoreBoxY + 58);

    doc.fillColor(colors.muted)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('GRADE RATING', 350, scoreBoxY + 25);

    doc.fillColor(gradeColor)
       .fontSize(38)
       .font('Helvetica-Bold')
       .text(`${grade}`, 350, scoreBoxY + 40);

    // Footer info
    doc.fillColor(colors.muted)
       .fontSize(10)
       .font('Helvetica')
       .text(`GENERATED TIMESTAMP: ${new Date(report.createdAt || Date.now()).toUTCString()}`, 70, 680);
  }

  /**
   * Category Scores & Raw Statistics
   */
  drawCapabilitiesAndStats(doc, report, colors) {
    doc.fillColor(colors.dark)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('1. Deterministic Capability Analytics', 50, 90);

    // Decorative separator line
    doc.lineWidth(1.5)
       .moveTo(50, 115)
       .lineTo(540, 115)
       .stroke(colors.border);

    // Render the 6 Category Scores
    const categories = report.scoreBreakdown?.categories || {};
    let currentY = 135;

    Object.entries(categories).forEach(([key, cat]) => {
      const formattedName = key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
      const catScore = cat.score || 0;
      
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(formattedName, 50, currentY);

      doc.fillColor(colors.muted)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`${catScore}/100`, 495, currentY, { align: 'right' });

      // Score progress track bar
      doc.rect(50, currentY + 15, 490, 8)
         .fillColor(colors.bgLight)
         .fill();
      
      const fillWidth = (catScore / 100) * 490;
      let barColor = colors.primary;
      if (catScore >= 80) barColor = colors.strength;
      else if (catScore < 50) barColor = colors.weakness;

      if (fillWidth > 0) {
        doc.rect(50, currentY + 15, fillWidth, 8)
           .fillColor(barColor)
           .fill();
      }

      currentY += 40;
    });

    // 2. Developer Statistics Section
    doc.fillColor(colors.dark)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('2. Repository & Developer Statistics', 50, currentY + 10);

    doc.lineWidth(1.5)
       .moveTo(50, currentY + 30)
       .lineTo(540, currentY + 30)
       .stroke(colors.border);

    currentY += 45;

    // Pull stats from the rawMetadataCache
    const profile = report.rawMetadataCache?.profile || {};
    const repos = report.reposAnalyzed || [];
    const languageData = report.languageData || {};

    // First Column (Repository Counts)
    doc.fillColor(colors.muted)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('TOTAL REPOSITORIES', 50, currentY)
       .fillColor(colors.dark)
       .fontSize(14)
       .text(`${profile.reposCount || repos.length || 0}`, 50, currentY + 13);

    doc.fillColor(colors.muted)
       .fontSize(9)
       .text('PUBLIC FOLLOWERS', 190, currentY)
       .fillColor(colors.dark)
       .fontSize(14)
       .text(`${profile.followers || 0}`, 190, currentY + 13);

    doc.fillColor(colors.muted)
       .fontSize(9)
       .text('FOLLOWING COUNT', 330, currentY)
       .fillColor(colors.dark)
       .fontSize(14)
       .text(`${profile.following || 0}`, 330, currentY + 13);

    // Second Row
    currentY += 45;
    
    // Sum stars & forks from analyzed repositories list
    const totalStars = repos.reduce((sum, r) => sum + (r.stars || 0), 0);
    const totalForks = repos.reduce((sum, r) => sum + (r.forks || 0), 0);
    const totalSize = repos.reduce((sum, r) => sum + (r.size || 0), 0);

    doc.fillColor(colors.muted)
       .fontSize(9)
       .text('ACCUMULATED STARS', 50, currentY)
       .fillColor(colors.dark)
       .fontSize(14)
       .text(`${totalStars}`, 50, currentY + 13);

    doc.fillColor(colors.muted)
       .fontSize(9)
       .text('ACCUMULATED FORKS', 190, currentY)
       .fillColor(colors.dark)
       .fontSize(14)
       .text(`${totalForks}`, 190, currentY + 13);

    doc.fillColor(colors.muted)
       .fontSize(9)
       .text('CODEBASE DISK SIZE', 330, currentY)
       .fillColor(colors.dark)
       .fontSize(14)
       .text(`${(totalSize / 1024).toFixed(1)} MB`, 330, currentY + 13);

    // Third Row: Top Languages
    currentY += 45;
    doc.fillColor(colors.muted)
       .fontSize(9)
       .text('PRIMARY LANGUAGE ECOSYSTEMS', 50, currentY);

    const langStr = Object.entries(languageData)
      .slice(0, 5)
      .map(([lang, pct]) => `${lang} (${pct}%)`)
      .join('  |  ') || 'None detected';

    doc.fillColor(colors.dark)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(langStr, 50, currentY + 13, { width: 490 });
  }

  /**
   * AI Executive Summary, Strengths, Weaknesses
   */
  drawQualitativeAssessment(doc, report, colors) {
    doc.fillColor(colors.dark)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('3. AI Qualitative Assessment', 50, 90);

    doc.lineWidth(1.5)
       .moveTo(50, 115)
       .lineTo(540, 115)
       .stroke(colors.border);

    // Executive Summary block
    doc.fillColor(colors.muted)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('EXECUTIVE SUMMARY & CODE HYGIENE SYNOPSIS', 50, 130);

    doc.rect(50, 145, 490, 120)
       .fillColor(colors.bgLight)
       .fill();
    doc.rect(50, 145, 490, 120)
       .lineWidth(1)
       .stroke(colors.border);

    doc.fillColor(colors.dark)
       .fontSize(10)
       .font('Helvetica')
       .text(report.aiSummary || 'No qualitative summary generated.', 65, 160, { width: 460, lineGap: 4 });

    // Two Column Strengths and Weaknesses layout
    const colY = 290;
    const colWidth = 230;

    // Left Column: Strengths
    doc.fillColor(colors.strength)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Core Strengths', 50, colY);

    doc.lineWidth(1.5)
       .moveTo(50, colY + 18)
       .lineTo(50 + colWidth, colY + 18)
       .stroke(colors.border);

    let listY = colY + 30;
    const strengths = report.strengths || [];
    strengths.slice(0, 5).forEach((item) => {
      doc.circle(55, listY + 4, 3)
         .fillColor(colors.strength)
         .fill();
      doc.fillColor(colors.dark)
         .fontSize(9.5)
         .font('Helvetica')
         .text(item, 65, listY, { width: colWidth - 20, lineGap: 3 });
      listY += doc.heightOfString(item, { width: colWidth - 20 }) + 10;
    });

    // Right Column: Weaknesses
    doc.fillColor(colors.weakness)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Areas for Development', 310, colY);

    doc.lineWidth(1.5)
       .moveTo(310, colY + 18)
       .lineTo(310 + colWidth, colY + 18)
       .stroke(colors.border);

    let rightListY = colY + 30;
    const weaknesses = report.weaknesses || [];
    weaknesses.slice(0, 5).forEach((item) => {
      doc.circle(315, rightListY + 4, 3)
         .fillColor(colors.weakness)
         .fill();
      doc.fillColor(colors.dark)
         .fontSize(9.5)
         .font('Helvetica')
         .text(item, 325, rightListY, { width: colWidth - 20, lineGap: 3 });
      rightListY += doc.heightOfString(item, { width: colWidth - 20 }) + 10;
    });
  }

  /**
   * Career Development & Learning Roadmap
   */
  drawCareerDevelopment(doc, report, colors) {
    doc.fillColor(colors.dark)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('4. Resume Readiness & Career Marketability', 50, 90);

    doc.lineWidth(1.5)
       .moveTo(50, 115)
       .lineTo(540, 115)
       .stroke(colors.border);

    // Star rating line
    doc.fillColor(colors.dark)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(`RESUME READINESS RATING:  ${report.resumeReadinessStars || 0} / 5 STARS`, 50, 130);

    // Career insights paragraph
    const resumeBreakdown = report.resumeBreakdown || {};
    doc.fillColor(colors.muted)
       .fontSize(9.5)
       .font('Helvetica-BoldOblique')
       .text(`"${resumeBreakdown.careerInsights || 'No insights compiled.'}"`, 50, 150, { width: 490, lineGap: 3 });

    // High Impact Bullet Points
    doc.fillColor(colors.dark)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Recommended Resume Achievement Statements:', 50, 205);

    let bulletY = 225;
    const bullets = resumeBreakdown.bulletPoints || [];
    bullets.slice(0, 3).forEach((bullet) => {
      doc.lineWidth(1)
         .rect(50, bulletY, 490, 42)
         .fillColor(colors.bgLight)
         .fill();
      doc.rect(50, bulletY, 490, 42)
         .stroke(colors.border);

      doc.fillColor(colors.dark)
         .fontSize(9)
         .font('Helvetica')
         .text(bullet, 60, bulletY + 10, { width: 470, lineGap: 2 });

      bulletY += 52;
    });

    // Roadmap timeline milestones
    doc.fillColor(colors.dark)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('5. Customized AI Learning Roadmap', 50, bulletY + 15);

    doc.lineWidth(1.5)
       .moveTo(50, bulletY + 33)
       .lineTo(540, bulletY + 33)
       .stroke(colors.border);

    let timelineY = bulletY + 48;
    const roadmap = report.learningRoadmap || {};
    const milestones = roadmap.milestones || [];

    milestones.slice(0, 3).forEach((milestone, idx) => {
      // Draw vertical connector line
      if (idx < milestones.length - 1 && idx < 2) {
        doc.lineWidth(1.5)
           .moveTo(60, timelineY + 15)
           .lineTo(60, timelineY + 70)
           .stroke(colors.border);
      }

      // Timeline circle dot
      doc.circle(60, timelineY + 10, 6)
         .fillColor(colors.primary)
         .fill();
      
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`${milestone.phase}: ${milestone.topic}`, 75, timelineY);

      doc.fillColor(colors.muted)
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text(`PRIORITY: ${milestone.priority || 'MEDIUM'}  |  SCORE BUMP: +${milestone.expectedScoreImprovement || 0}  |  TIME: ${milestone.estimatedTime || 'N/A'}`, 75, timelineY + 14);

      const stepsStr = `Action steps: ${ (milestone.actionableSteps || []).join(', ') }`;
      doc.fillColor(colors.dark)
         .fontSize(8.5)
         .font('Helvetica')
         .text(stepsStr, 75, timelineY + 26, { width: 465, lineGap: 1.5 });

      timelineY += 58;
    });
  }

  /**
   * Interview Prep
   */
  drawInterviewPrep(doc, report, colors) {
    doc.fillColor(colors.dark)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('6. Interactive Interview Preparation Pack', 50, 90);

    doc.lineWidth(1.5)
       .moveTo(50, 115)
       .lineTo(540, 115)
       .stroke(colors.border);

    const prep = report.interviewPrep || {};
    
    // 1. Likely Questions
    doc.fillColor(colors.primary)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Likely Questions & Talking Points', 50, 130);

    let prepY = 150;
    const questions = prep.likelyQuestions || [];
    const talkingPoints = prep.talkingPoints || [];

    questions.slice(0, 2).forEach((q, idx) => {
      doc.fillColor(colors.dark)
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text(`Q: ${q}`, 50, prepY, { width: 490, lineGap: 3 });

      const tp = talkingPoints[idx] || 'Review core documentation and deployment structures.';
      doc.fillColor(colors.muted)
         .fontSize(9)
         .font('Helvetica-Oblique')
         .text(`Recommended talking point: ${tp}`, 55, doc.y + 4, { width: 485, lineGap: 3 });

      prepY = doc.y + 15;
    });

    // 2. Concepts to Review
    doc.fillColor(colors.primary)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Advanced Computer Science Concepts to Review', 50, prepY + 10);

    doc.lineWidth(1)
       .moveTo(50, prepY + 26)
       .lineTo(540, prepY + 26)
       .stroke(colors.border);

    prepY += 38;
    const concepts = prep.conceptsToReview || [];
    
    concepts.slice(0, 4).forEach((concept) => {
      doc.lineWidth(1)
         .rect(50, prepY, 490, 25)
         .fillColor(colors.bgLight)
         .fill();
      doc.rect(50, prepY, 490, 25)
         .stroke(colors.border);

      doc.fillColor(colors.dark)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(concept, 65, prepY + 8);

      prepY += 32;
    });
  }

  /**
   * Applies headers, footers, page numbering, and diagnostics in a second pass.
   */
  applyHeadersAndFooters(doc, report, colors) {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 1; i < totalPages; i++) {
      doc.switchToPage(i);

      // Running Header
      doc.fillColor(colors.muted)
         .fontSize(8)
         .font('Helvetica')
         .text('DevLens © 2026  |  Professional Portfolio Capability Report', 50, 30);
      
      doc.text(`Target: @${report.targetGithubUsername}`, 400, 30, { align: 'right', width: 140 });

      doc.lineWidth(0.5)
         .moveTo(50, 45)
         .lineTo(540, 45)
         .stroke(colors.border);

      // Running Footer Line
      doc.lineWidth(0.5)
         .moveTo(50, 740)
         .lineTo(540, 740)
         .stroke(colors.border);

      // Page Number
      doc.fillColor(colors.muted)
         .fontSize(8)
         .text(`Page ${i + 1} of ${totalPages}`, 450, 750, { align: 'right', width: 90 });

      // Diagnostics metadata footer on the very last page
      if (i === totalPages - 1) {
        const metadata = report.scoreBreakdown?.aiMetadata || {};
        
        doc.fillColor(colors.muted)
           .fontSize(7.5)
           .font('Helvetica-Bold')
           .text('AUDIT SYSTEM DIAGNOSTICS & TRACEABILITY METADATA', 50, 680);

        doc.lineWidth(0.5)
           .moveTo(50, 690)
           .lineTo(540, 690)
           .stroke(colors.border);

        const versionStr = `Scoring Algorithm Version: ${report.scoreBreakdown?.scoringVersion || '1.0.0'}   |   AI Provider: ${metadata.provider || 'Gemini'}   |   Model Name: ${metadata.model || 'gemini-1.5-flash'}   |   Prompt Version: ${metadata.promptVersion || '1.0.0'}`;
        doc.fillColor(colors.muted)
           .font('Helvetica')
           .text(versionStr, 50, 698);

        const shaStr = `SHA-256 Analysis Metadata Signature Hash: ${report.rawMetadataCache?.analyticsHash || 'N/A'}`;
        doc.text(shaStr, 50, 710);
      }
    }
  }
}

export default new PDFService();
