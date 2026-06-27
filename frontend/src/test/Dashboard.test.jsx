import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// 1. Mock the Auth Context with stable references to prevent infinite render loops
const mockLogout = vi.fn();
const mockShowToast = vi.fn();
const mockUser = { id: 1, email: 'developer@devlens.com', name: 'Alex Dev', githubUsername: 'alexdev' };
const mockAuthValue = {
  user: mockUser,
  logout: mockLogout,
  showToast: mockShowToast,
};
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuthValue,
}));

// 2. Mock the API Service directly to avoid ESM import order issues
vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// 3. Mock Recharts to bypass JSDOM SVG dimension and layout limitations
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="radar-container">{children}</div>,
  RadarChart: ({ children }) => <div data-testid="radar-chart">{children}</div>,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  Radar: () => null,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import api from '../services/api.js';
import Dashboard from '../pages/Dashboard.jsx';

describe('AI Insights Dashboard Integration Suite (Module 4.3)', () => {
  const mockAiInsights = {
    targetGithubUsername: 'octocat',
    developerScore: 85,
    scoreBreakdown: {
      overallScore: 85,
      confidenceScore: 60,
      scoringVersion: '1.0.0',
      analyzedAt: '2026-06-26T18:52:45.000Z',
      categories: {
        repositoryQuality: { score: 80, weight: 0.2, improvements: [] },
        documentationQuality: { score: 90, weight: 0.2, improvements: [] },
        technologyDiversity: { score: 70, weight: 0.15, improvements: [] },
        projectActivity: { score: 85, weight: 0.15, improvements: [] },
        openSourceEngagement: { score: 95, weight: 0.15, improvements: [] },
        portfolioReadiness: { score: 90, weight: 0.15, improvements: [] },
      },
      aiMetadata: {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        promptVersion: '1.0.0',
        timestamp: '2026-06-26T18:52:45.000Z',
        responseTimeMs: 120,
        retryCount: 0,
        fallbackStatus: false,
        cached: false,
        analyticsHash: 'abc123sha256hash',
        insightSource: 'gemini',
      },
    },
    reposAnalyzed: [
      { name: 'repo-1', fullName: 'octocat/repo-1', stars: 5, forks: 1, size: 200, isPrivate: false },
    ],
    languageData: { JS: 80, CSS: 20 },
    rawMetadataCache: {
      profile: { username: 'octocat' },
      analyticsHash: 'abc123sha256hash',
    },
    suggestions: ['Add a README file.'],
    aiSummary: 'Completed analysis for octocat. Excellent frontend capabilities with deep open-source footprint.',
    strengths: ['Strong JavaScript skills', 'Outstanding open-source contribution', 'High documentation coverage'],
    weaknesses: ['Needs to learn systems languages', 'Fewer live production URL links'],
    resumeReadinessStars: 4,
    resumeBreakdown: {
      bulletPoints: [
        'Engineered high-performance JavaScript web applications, scaling core repository architectures.',
        'Contributed actively to open-source communities, achieving high stars and fork metrics.',
        'Maintained comprehensive documentation standards including READMEs and licenses.',
      ],
      careerInsights: 'Highly competitive frontend engineer, well-positioned for mid-to-senior roles.',
    },
    learningRoadmap: {
      milestones: [
        {
          phase: 'Phase 1: Types',
          topic: 'TypeScript Mastery',
          priority: 'High',
          estimatedTime: '2 weeks',
          expectedScoreImprovement: 20,
          actionableSteps: ['Study TS utility types', 'Migrate React projects to TS'],
          suggestedResources: ['TypeScript Handbook'],
        },
        {
          phase: 'Phase 2: paradigms',
          topic: 'Systems paradigms in Go',
          priority: 'Medium',
          estimatedTime: '3 weeks',
          expectedScoreImprovement: 15,
          actionableSteps: ['Build systems scripts in Go', 'Understand channels and concurrency'],
          suggestedResources: ['A Tour of Go'],
        },
        {
          phase: 'Phase 3: deployments',
          topic: 'Docker Containers & CI/CD',
          priority: 'Low',
          estimatedTime: '1 week',
          expectedScoreImprovement: 10,
          actionableSteps: ['Write Dockerfiles', 'Configure automated test actions'],
          suggestedResources: ['Docker documentation'],
        },
      ],
    },
    interviewPrep: {
      likelyQuestions: ['Explain prototypical inheritance and closures', 'How do you structure CSS grid systems?'],
      talkingPoints: ['Highlight my open-source contributions', 'Explain doc standards on teams'],
      conceptsToReview: ['React fiber reconciliation model', 'JavaScript event loop'],
    },
  };

  const mockSavedList = [
    {
      id: 'saved-id-1',
      targetGithubUsername: 'octocat',
      developerScore: 85,
      createdAt: '2026-06-26T18:52:45.000Z',
      ...mockAiInsights,
    },
    {
      id: 'saved-id-2',
      targetGithubUsername: 'torvalds',
      developerScore: 99,
      createdAt: '2026-06-26T18:52:45.000Z',
      ...mockAiInsights,
      targetGithubUsername: 'torvalds',
      developerScore: 99,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/report/saved')) {
        return Promise.resolve({ data: { data: mockSavedList } });
      }
      if (url.includes('/api/v1/analytics/report/compare/')) {
        const mockCompareData = {
          timeline: [
            { id: 'saved-id-1', createdAt: '2026-06-25T18:52:45.000Z', developerScore: 85, categories: { repositoryQuality: 80 } },
            { id: 'saved-id-3', createdAt: '2026-06-26T18:52:45.000Z', developerScore: 90, categories: { repositoryQuality: 90 } }
          ],
          deltas: { overallScoreDelta: 5, categoryDeltas: { repositoryQuality: 10 } },
          biggestImprovement: 'repositoryQuality',
          areasRegressed: [],
          resolvedSuggestions: ['Add license']
        };
        return Promise.resolve({ data: { data: mockCompareData } });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  it('renders the welcome empty state on load, listing sample verified profile buttons', async () => {
    renderDashboard();

    expect(screen.getByText('No Active Analysis Loaded')).toBeInTheDocument();
    expect(screen.getByText(/octocat/)).toBeInTheDocument();
    expect(screen.getByText(/torvalds/)).toBeInTheDocument();
    
    // Checks that the saved reports are fetched and listed in the sidebar
    await waitFor(() => {
      const savedList = screen.getByTestId('saved-reports-list');
      expect(within(savedList).getByText(/octocat/)).toBeInTheDocument();
      expect(within(savedList).getByText(/torvalds/)).toBeInTheDocument();
    });
  });

  it('renders a loading skeleton when the profile analysis is triggered', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/analyze/')) {
        // Return a promise that never resolves during this test
        return new Promise(() => {});
      }
      if (url.includes('/api/v1/analytics/report/saved')) {
        return Promise.resolve({ data: { data: [] } });
      }
    });

    renderDashboard();

    const searchInput = screen.getByLabelText('GitHub Username');
    fireEvent.change(searchInput, { target: { value: 'octocat' } });

    const searchButton = screen.getByRole('button', { name: /Analyze Profile/i });
    fireEvent.click(searchButton);

    // Verify loading skeleton renders
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders the complete premium dashboard upon successful API profile analysis', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/analyze/octocat')) {
        return Promise.resolve({ data: { data: { result: mockAiInsights } } });
      }
      if (url.includes('/api/v1/analytics/report/saved')) {
        return Promise.resolve({ data: { data: [] } });
      }
    });

    renderDashboard();

    const searchInput = screen.getByLabelText('GitHub Username');
    fireEvent.change(searchInput, { target: { value: 'octocat' } });

    const searchButton = screen.getByRole('button', { name: /Analyze Profile/i });
    fireEvent.click(searchButton);

    // Wait for the loading to finish and rendering to complete
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Analysis for @\s*octocat/i })).toBeInTheDocument();
    });

    // 1. Verify Deterministic Scores & Category breakdowns
    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument(); // Overall Score
    });
    expect(screen.getByText('repository Quality')).toBeInTheDocument();
    expect(screen.getAllByText('80/100')[0]).toBeInTheDocument();
    expect(screen.getByText('documentation Quality')).toBeInTheDocument();
    expect(screen.getAllByText('90/100')[0]).toBeInTheDocument();
    expect(screen.getByText('Confidence Score:')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    // Verify Recharts Radar Container was rendered
    expect(screen.getByTestId('radar-container')).toBeInTheDocument();

    // 2. Verify AI qualitative insights
    expect(screen.getByText('AI-Powered Qualitative Insights')).toBeInTheDocument();
    expect(screen.getByText(mockAiInsights.aiSummary)).toBeInTheDocument();
    
    // Strengths and Weaknesses
    expect(screen.getByText('Strong JavaScript skills')).toBeInTheDocument();
    expect(screen.getByText('Needs to learn systems languages')).toBeInTheDocument();

    // Star rating
    expect(screen.getByLabelText('Readiness score: 4 out of 5 stars')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockAiInsights.resumeBreakdown.careerInsights))).toBeInTheDocument();
    expect(screen.getByText(mockAiInsights.resumeBreakdown.bulletPoints[0])).toBeInTheDocument();

    // Interactive Tab Switching in Interview Prep
    expect(screen.getByText('Likely Questions')).toBeInTheDocument();
    expect(screen.getByText('Explain prototypical inheritance and closures')).toBeInTheDocument(); // Question tab active by default

    const talkingPointsTab = screen.getByRole('button', { name: /Talking Points/i });
    fireEvent.click(talkingPointsTab);
    expect(screen.getByText('Highlight my open-source contributions')).toBeInTheDocument();

    const conceptsTab = screen.getByRole('button', { name: /Concepts to Review/i });
    fireEvent.click(conceptsTab);
    expect(screen.getByText('React fiber reconciliation model')).toBeInTheDocument();

    // Learning Roadmap Timeline
    expect(screen.getByText('AI Learning Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Phase 1: Types')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Mastery')).toBeInTheDocument();
    expect(screen.getByText('Study TS utility types')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Handbook')).toBeInTheDocument();

    // Diagnostics Metadata Footer
    expect(screen.getByText('Analysis Diagnostics & Performance Metadata')).toBeInTheDocument();
    expect(screen.getByText('gemini-1.5-flash')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
    expect(screen.getByText('Gemini AI')).toBeInTheDocument();
    expect(screen.getByText('CACHE MISS')).toBeInTheDocument();
    expect(screen.getByText('abc123sh...')).toBeInTheDocument();
  });

  it('clearly distinguishes Fallback Engine source mode in the diagnostics footer', async () => {
    const fallbackInsights = {
      ...mockAiInsights,
      scoreBreakdown: {
        ...mockAiInsights.scoreBreakdown,
        aiMetadata: {
          ...mockAiInsights.scoreBreakdown.aiMetadata,
          fallbackStatus: true,
          insightSource: 'fallback',
        },
      },
    };

    api.get.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/analyze/octocat')) {
        return Promise.resolve({ data: { data: { result: fallbackInsights } } });
      }
      if (url.includes('/api/v1/analytics/report/saved')) {
        return Promise.resolve({ data: { data: [] } });
      }
    });

    renderDashboard();

    const searchInput = screen.getByLabelText('GitHub Username');
    fireEvent.change(searchInput, { target: { value: 'octocat' } });

    const searchButton = screen.getByRole('button', { name: /Analyze Profile/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Analysis for @\s*octocat/i })).toBeInTheDocument();
    });

    // Verify Fallback modes are displayed
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(screen.getByText('Fallback Engine')).toBeInTheDocument();
  });

  it('displays CACHE HIT and 0ms when the response was retrieved from Redis cache', async () => {
    const cachedInsights = {
      ...mockAiInsights,
      scoreBreakdown: {
        ...mockAiInsights.scoreBreakdown,
        aiMetadata: {
          ...mockAiInsights.scoreBreakdown.aiMetadata,
          cached: true,
          responseTimeMs: 0,
        },
      },
    };

    api.get.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/analyze/octocat')) {
        return Promise.resolve({ data: { data: { result: cachedInsights } } });
      }
      if (url.includes('/api/v1/analytics/report/saved')) {
        return Promise.resolve({ data: { data: [] } });
      }
    });

    renderDashboard();

    const searchInput = screen.getByLabelText('GitHub Username');
    fireEvent.change(searchInput, { target: { value: 'octocat' } });

    const searchButton = screen.getByRole('button', { name: /Analyze Profile/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Analysis for @\s*octocat/i })).toBeInTheDocument();
    });

    expect(screen.getByText('CACHE HIT')).toBeInTheDocument();
    expect(screen.getByText('0ms')).toBeInTheDocument();
  });

  it('loads a saved report from the sidebar library when clicked', async () => {
    renderDashboard();

    await waitFor(() => {
      const savedList = screen.getByTestId('saved-reports-list');
      expect(within(savedList).getByText(/torvalds/)).toBeInTheDocument();
    });

    const savedList = screen.getByTestId('saved-reports-list');
    const savedReportButton = within(savedList).getByText(/torvalds/);
    fireEvent.click(savedReportButton);

    // Verify it renders torvalds profile dashboard immediately without calling analyze API
    expect(screen.getByRole('heading', { name: /Analysis for @\s*torvalds/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('99')).toBeInTheDocument(); // Torvalds mock score
    });
  });

  it('triggers delete API when delete button on a saved report is clicked', async () => {
    api.delete.mockResolvedValueOnce({ data: { success: true } });

    renderDashboard();

    await waitFor(() => {
      const savedList = screen.getByTestId('saved-reports-list');
      expect(within(savedList).getByText(/octocat/)).toBeInTheDocument();
    });

    // Mock confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

    const savedReportsElements = screen.getAllByTitle('Delete Saved Report');
    fireEvent.click(savedReportsElements[0]); // Click delete on first report

    expect(api.delete).toHaveBeenCalledWith('/api/v1/analytics/report/saved-id-1');
  });

  it('renders skip-to-content links and supports keyboard accessibility tags', async () => {
    renderDashboard();
    
    // 1. Verify skip link exists
    const skipLink = screen.getByText('Skip to Main Content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
    
    // 2. Verify theme toggler label
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  it('renders historical progression timeline charts when comparison history is loaded', async () => {
    // Mock the analyze profile response to load a result
    api.get.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/report/saved')) {
        return Promise.resolve({ data: { data: mockSavedList } });
      }
      if (url.includes('/api/v1/analytics/report/compare/')) {
        const mockCompareData = {
          timeline: [
            { id: 'saved-id-1', createdAt: '2026-06-25T18:52:45.000Z', developerScore: 85, categories: { repositoryQuality: 80 } },
            { id: 'saved-id-3', createdAt: '2026-06-26T18:52:45.000Z', developerScore: 90, categories: { repositoryQuality: 90 } }
          ],
          deltas: { overallScoreDelta: 5, categoryDeltas: { repositoryQuality: 10 } },
          biggestImprovement: 'repositoryQuality',
          areasRegressed: [],
          resolvedSuggestions: ['Add license']
        };
        return Promise.resolve({ data: { data: mockCompareData } });
      }
      if (url.includes('/api/v1/analytics/analyze/')) {
        return Promise.resolve({
          data: {
            data: {
              status: 'completed',
              result: {
                targetGithubUsername: 'octocat',
                developerScore: 85,
                scoreBreakdown: {
                  overallScore: 85,
                  confidenceScore: 60,
                  scoringVersion: '1.0.0',
                  categories: { repositoryQuality: { score: 80 } },
                  aiMetadata: {
                    provider: 'gemini',
                    model: 'gemini-1.5-flash',
                    promptVersion: '1.0.0',
                    timestamp: new Date().toISOString(),
                    responseTimeMs: 120,
                    retryCount: 0,
                    fallbackStatus: false,
                    cached: false,
                    analyticsHash: 'hash',
                    insightSource: 'gemini'
                  }
                },
                aiSummary: 'Summary',
                strengths: ['Strength 1', 'Strength 2'],
                weaknesses: ['Weakness 1', 'Weakness 2'],
                resumeReadinessStars: 4,
                resumeBreakdown: { bulletPoints: ['Bullet 1', 'Bullet 2', 'Bullet 3'], careerInsights: 'Insights' },
                learningRoadmap: { milestones: [] },
                interviewPrep: { likelyQuestions: [], talkingPoints: [], conceptsToReview: [] }
              }
            }
          }
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    renderDashboard();

    // Trigger analysis search to load profile results
    const searchInput = screen.getByLabelText('GitHub Username');
    fireEvent.change(searchInput, { target: { value: 'octocat' } });
    const analyzeButton = screen.getByRole('button', { name: /Analyze Profile/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Analysis for @\s*octocat/i })).toBeInTheDocument();
    });

    // Verify progression timeline header, score delta, and resolved suggestions
    expect(screen.getByText('Historical Progression Timeline')).toBeInTheDocument();
    expect(screen.getByText('+5 pts')).toBeInTheDocument();
    expect(screen.getByText('Add license')).toBeInTheDocument();
    expect(screen.getByText('BIGGEST IMPROVEMENT')).toBeInTheDocument();
  });

  it('triggers export document downloads for Markdown, JSON, and PDF when clicked', async () => {
    // Spy on URL utilities used inside export actions
    const createObjectURLMock = vi.fn().mockReturnValue('mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    // Spy on document links triggers
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    // Load analysis result
    api.get.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/report/saved')) {
        return Promise.resolve({ data: { data: mockSavedList } });
      }
      if (url.includes('/api/v1/analytics/report/compare/')) {
        return Promise.resolve({ data: { data: { timeline: [] } } });
      }
      if (url.includes('/api/v1/analytics/analyze/')) {
        return Promise.resolve({
          data: {
            data: {
              status: 'completed',
              result: {
                targetGithubUsername: 'octocat',
                developerScore: 85,
                scoreBreakdown: {
                  overallScore: 85,
                  confidenceScore: 60,
                  scoringVersion: '1.0.0',
                  categories: { repositoryQuality: { score: 80 } },
                  aiMetadata: {
                    provider: 'gemini',
                    model: 'gemini-1.5-flash',
                    promptVersion: '1.0.0',
                    timestamp: new Date().toISOString(),
                    responseTimeMs: 120,
                    retryCount: 0,
                    fallbackStatus: false,
                    cached: false,
                    analyticsHash: 'hash',
                    insightSource: 'gemini'
                  }
                },
                aiSummary: 'Summary',
                strengths: ['Strength 1', 'Strength 2'],
                weaknesses: ['Weakness 1', 'Weakness 2'],
                resumeReadinessStars: 4,
                resumeBreakdown: { bulletPoints: ['Bullet 1', 'Bullet 2', 'Bullet 3'], careerInsights: 'Insights' },
                learningRoadmap: { milestones: [] },
                interviewPrep: { likelyQuestions: [], talkingPoints: [], conceptsToReview: [] }
              }
            }
          }
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    api.post.mockResolvedValueOnce({ data: new Blob(['pdf-data'], { type: 'application/pdf' }) });

    renderDashboard();

    // Trigger analysis search to load profile results
    const searchInput = screen.getByLabelText('GitHub Username');
    fireEvent.change(searchInput, { target: { value: 'octocat' } });
    const analyzeButton = screen.getByRole('button', { name: /Analyze Profile/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Analysis for @\s*octocat/i })).toBeInTheDocument();
    });

    // 1. Click JSON export button
    const jsonBtn = screen.getByRole('button', { name: 'Export report as JSON' });
    fireEvent.click(jsonBtn);
    expect(createObjectURLMock).toHaveBeenCalled();

    // 2. Click MD export button
    const mdBtn = screen.getByRole('button', { name: 'Export report as Markdown' });
    fireEvent.click(mdBtn);
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);

    // 3. Click PDF export button (calls backend POST endpoint)
    const pdfBtn = screen.getByRole('button', { name: 'Export report as PDF' });
    fireEvent.click(pdfBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/analytics/export/pdf', expect.any(Object), { responseType: 'blob' });
      expect(createObjectURLMock).toHaveBeenCalledTimes(3);
    });
  });
});
