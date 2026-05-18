import { mockReports } from '../mocks/mockReports';
import { mockAlerts } from '../mocks/mockAlerts';
import { mockProjects } from '../mocks/mockProjects';

export const chatbotService = {
  sendQuery: async (query) => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const q = query.toLowerCase();

    if (q.includes('today report') || q.includes('daily report')) {
      return {
        type: 'report',
        title: 'Daily Report Summary',
        data: mockReports
      };
    }

    if (q.includes('critical alerts') || q.includes('alerts')) {
      return {
        type: 'alerts',
        title: 'Critical Alerts Feed',
        data: mockAlerts.filter(a => a.severity === 'Critical')
      };
    }

    if (q.includes('project status') || q.includes('status of')) {
      const project = mockProjects[0]; // Mocking first project
      return {
        type: 'project',
        title: `Status: ${project.name}`,
        data: project
      };
    }

    if (q.includes('missing report') || q.includes('who hasnt reported')) {
      return {
        type: 'text',
        content: 'As of now, John Doe and Harvey Specter have not submitted their EOD reports for today.'
      };
    }

    return {
      type: 'text',
      content: "I couldn't find specific data for that query. Try: 'Today's report', 'Critical alerts', or 'Status of Alpha project'."
    };
  }
};
