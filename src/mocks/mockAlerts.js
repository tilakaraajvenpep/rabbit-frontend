export const mockAlerts = [
  {
    id: 'a1',
    type: 'Timeline Risk',
    severity: 'Critical',
    message: 'Project Alpha Website Redesign is 15% behind schedule.',
    projectId: 'p1',
    projectName: 'Alpha Website Redesign',
    timestamp: '2024-05-03T10:00:00Z',
    acknowledged: false
  },
  {
    id: 'a2',
    type: 'Budget Risk',
    severity: 'Warning',
    message: 'Project Epsilon ERP Integration has consumed 85% of its initial budget.',
    projectId: 'p5',
    projectName: 'Epsilon ERP Integration',
    timestamp: '2024-05-02T14:30:00Z',
    acknowledged: false
  },
  {
    id: 'a3',
    type: 'Missing Report',
    severity: 'Info',
    message: 'John Employee has not submitted the EOD report for today.',
    projectId: 'p1',
    projectName: 'Alpha Website Redesign',
    employeeName: 'John Employee',
    timestamp: '2024-05-04T09:00:00Z',
    acknowledged: true,
    ackAt: '2024-05-04T10:00:00Z',
    ackComment: 'Spoke with John, he will submit by EOD.'
  },
  {
    id: 'a4',
    type: 'Overdue Ticket',
    severity: 'Critical',
    message: 'Ticket AD-102 (Database Migration) is overdue by 2 days.',
    projectId: 'p1',
    projectName: 'Alpha Website Redesign',
    employeeName: 'Jane Smith',
    timestamp: '2024-05-01T16:00:00Z',
    acknowledged: false
  }
];
