import React, { useState } from 'react';
import { Modal, Upload, Button, Table, Tag, Space, Progress, Alert, Typography, notification } from 'antd';
import { UploadOutlined, FileExcelOutlined, CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { projectService } from '../../services/projectService';
import dayjs from 'dayjs';
import { useAuthStore } from '../../store/authStore';
import { parseHoursFromString, formatHoursToHrsMins } from '../../utils/timeUtils';

const { Text, Link } = Typography;

const ExcelProjectUploadModal = ({ open, onClose, onSuccess, existingUsers = [] }) => {
  const currentUser = useAuthStore(state => state.currentUser);
  const currentPmId = currentUser?.id || currentUser?.userId;
  const [fileList, setFileList] = useState([]);
  const [parsedData, setParsedData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);

  const handleClose = () => {
    setFileList([]);
    setParsedData([]);
    setImporting(false);
    setProgress(0);
    setImportResults(null);
    onClose();
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Project Name": "Acme CRM Integration",
        "Customer Name": "Acme Corp",
        "Project Code": "PRJ-CRM-01",
        "Project Category": "Customised",
        "Total Hours": "450 Hrs 0 Mins",
        "Utilized Hours": "150 Hrs 0 Mins",
        "Remaining Hours": "300 Hrs 0 Mins",
        "Start Date": "2026-07-01",
        "End Date": "2026-12-31",
        "Project Manager": "pm@acme.com",
        "Team Lead": "lead@acme.com",
        "Description": "Integration of Acme CRM with sales portal"
      },
      {
        "Project Name": "Mobile App UI Redesign",
        "Customer Name": "Globex Corp",
        "Project Code": "PRJ-UI-02",
        "Project Category": "General",
        "Total Hours": "200 Hrs 0 Mins",
        "Utilized Hours": "50 Hrs 0 Mins",
        "Remaining Hours": "150 Hrs 0 Mins",
        "Start Date": "2026-07-15",
        "End Date": "2026-10-15",
        "Project Manager": "pm@acme.com",
        "Team Lead": "lead@acme.com",
        "Description": "Revamp mobile application UI/UX flows"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Projects Template");
    XLSX.writeFile(workbook, "project_import_template.xlsx");
  };

  const normalizeHeader = (header) => {
    return header.toString().toLowerCase().trim().replace(/[\s_-]/g, '');
  };

  const findUser = (nameOrEmail) => {
    if (!nameOrEmail) return null;
    const cleanSearch = nameOrEmail.toString().trim().toLowerCase();

    // 1. Match by email
    let found = existingUsers.find(u => u.email && u.email.toLowerCase() === cleanSearch);
    if (found) return found;

    // 2. Match by full name (exact)
    found = existingUsers.find(u => {
      const name = (u.name || u.fullName || '').toLowerCase();
      return name === cleanSearch;
    });
    if (found) return found;

    // 3. Match by full name (word matching with initials conflict checking)
    const devWords = cleanSearch.split(/[\s.]+/).filter(Boolean);
    found = existingUsers.find(u => {
      const uName = (u.name || u.fullName || '').toLowerCase().trim();
      const uNameWords = uName.split(/[\s.]+/).filter(Boolean);

      // Check for conflicting single-letter initials (e.g. S vs R)
      const devInitials = devWords.filter(w => w.length === 1);
      const uInitials = uNameWords.filter(w => w.length === 1);
      if (devInitials.length > 0 && uInitials.length > 0) {
        const hasOverlap = devInitials.some(i => uInitials.includes(i));
        if (!hasOverlap) return false;
      }

      // Word-level exact match
      return uNameWords.some(w => w.length > 1 && devWords.includes(w)) || 
             devWords.some(w => w.length > 1 && uNameWords.includes(w));
    });
    if (found) return found;

    // 4. Fallback: Match by full name (partial match)
    return existingUsers.find(u => {
      const name = (u.name || u.fullName || '').toLowerCase();
      return name.includes(cleanSearch);
    }) || null;
  };

  const handleUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        // cellDates:true makes XLSX return real JS Date objects for date cells
        // Do NOT use raw:false — it overrides cellDates and returns serials as strings
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          notification.warning({ message: 'Empty Sheet', description: 'No rows found in the uploaded excel sheet.' });
          return;
        }

        const mapped = json.map((row, idx) => {
          let name = '';
          let client = '';
          let code = '';
          let totalHours = null;
          let utilizedHours = null;
          let remainingHours = null;
          let category = 'General';
          let expectedStart = null;
          let expectedEnd = null;
          let pmVal = '';
          let tlVal = '';
          let description = '';

          Object.keys(row).forEach(key => {
            const normalizedKey = normalizeHeader(key);
            if (normalizedKey.includes('projectname') || normalizedKey === 'name') {
              name = row[key];
            } else if (normalizedKey.includes('customer') || normalizedKey.includes('client')) {
              client = row[key];
            } else if (normalizedKey.includes('projectcode') || normalizedKey === 'code') {
              code = row[key];
            } else if (normalizedKey.includes('totalhours') || normalizedKey === 'hours' || normalizedKey === 'approvedhours') {
              totalHours = row[key];
            } else if (normalizedKey.includes('utilizedhours') || normalizedKey.includes('consumedhours') || normalizedKey === 'utilized' || normalizedKey === 'consumed') {
              utilizedHours = row[key];
            } else if (normalizedKey.includes('remaininghours') || normalizedKey.includes('balancehours') || normalizedKey === 'remaining' || normalizedKey === 'balance') {
              remainingHours = row[key];
            } else if (normalizedKey.includes('category') || normalizedKey.includes('projectcategory')) {
              category = row[key];
            } else if (normalizedKey.includes('startdate') || normalizedKey === 'start') {
              expectedStart = row[key];
            } else if (normalizedKey.includes('enddate') || normalizedKey === 'end') {
              expectedEnd = row[key];
            } else if (normalizedKey.includes('pm') || normalizedKey.includes('projectmanager')) {
              pmVal = row[key];
            } else if (normalizedKey.includes('teamlead') || normalizedKey.includes('tl') || normalizedKey.includes('lead')) {
              tlVal = row[key];
            } else if (normalizedKey.includes('description') || normalizedKey === 'desc') {
              description = row[key];
            }
          });

          // Resolve PM and TL
          const resolvedPM = findUser(pmVal);
          const resolvedTL = findUser(tlVal);

          let status = 'ready';
          let warningMsg = '';
          if (!name) {
            warningMsg = 'Project Name is missing';
          } else if (!client) {
            warningMsg = 'Customer Name is missing';
          }

          // Robust date parser — handles all 3 forms xlsx can return:
          //   1. JS Date  (cellDates:true worked)  → extract UTC y/m/d
          //   2. number   (Excel serial, e.g. 46025) → convert via epoch formula
          //   3. string   ("7/24/2026" or "2026-07-24") → dayjs parse
          const safeParseDate = (val) => {
            if (!val && val !== 0) return null;

            // 1. Real JS Date object
            if (val instanceof Date) {
              const y = val.getUTCFullYear();
              const mo = String(val.getUTCMonth() + 1).padStart(2, '0');
              const d = String(val.getUTCDate()).padStart(2, '0');
              return `${y}-${mo}-${d}`;
            }

            // 2. Excel serial number (days since 1 Jan 1900, with leap-year bug offset)
            if (typeof val === 'number') {
              // 25569 = days between 1900-01-01 and 1970-01-01 (accounting for Excel's 1900 bug)
              const msFromEpoch = (val - 25569) * 86400 * 1000;
              const dt = new Date(msFromEpoch);
              const y = dt.getUTCFullYear();
              const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
              const d = String(dt.getUTCDate()).padStart(2, '0');
              return `${y}-${mo}-${d}`;
            }

            // 3. String — handle 'm/d/yyyy', 'yyyy-mm-dd', numeric strings, etc.
            const str = String(val).trim();

            // 3a. If the string is numeric (Excel serial as string), parse it
            if (/^\d{4,6}$/.test(str)) {
              const serial = Number(str);
              const msFromEpoch = (serial - 25569) * 86400 * 1000;
              const dt = new Date(msFromEpoch);
              const y = dt.getUTCFullYear();
              const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
              const d = String(dt.getUTCDate()).padStart(2, '0');
              return `${y}-${mo}-${d}`;
            }

            // Try M/D/YYYY first (common US Excel format)
            const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mdyMatch) {
              const [, mo, d, y] = mdyMatch;
              return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
            }
            const parsed = dayjs(str);
            return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
          };
          const parsedStart = safeParseDate(expectedStart);
          const parsedEnd = safeParseDate(expectedEnd);
          const pmIdResolved = (resolvedPM ? (resolvedPM.id || resolvedPM.userId) : null) || currentPmId;
          const tlIdResolved = resolvedTL ? (resolvedTL.id || resolvedTL.userId) : null;

          const parsedTotal = parseHoursFromString(totalHours);
          const parsedUtilized = parseHoursFromString(utilizedHours);
          const parsedRemaining = remainingHours ? parseHoursFromString(remainingHours) : Math.max(0, parsedTotal - parsedUtilized);

          return {
            key: idx,
            name: name?.toString().trim() || 'Untitled Project',
            client: client?.toString().trim() || 'N/A',
            code: code?.toString().trim() || `PRJ-${Math.floor(100 + Math.random() * 900)}`,
            totalHours: parsedTotal,
            consumedHours: parsedUtilized,
            remainingHours: parsedRemaining,
            projectCategory: category?.toString().trim() || 'General',
            expectedStart: parsedStart,
            expectedEnd: parsedEnd,
            pmName: pmVal,
            tlName: tlVal,
            assignedProjectManagerId: pmIdResolved,
            assignedTeamLeadId: tlIdResolved,
            resolvedPMName: resolvedPM ? (resolvedPM.name || resolvedPM.fullName) : (pmVal ? `You (Default fallback for "${pmVal}")` : `You (Default)`),
            resolvedTLName: resolvedTL ? (resolvedTL.name || resolvedTL.fullName) : null,
            description: description?.toString().trim() || '',
            status,
            warningMsg
          };
        });

        setParsedData(mapped);
      } catch (err) {
        console.error(err);
        notification.error({ message: 'Parse Error', description: 'Failed to read the excel file. Please verify the template.' });
      }
    };
    reader.readAsArrayBuffer(file);
    setFileList([file]);
    return false; // prevent upload
  };

  const startImport = async () => {
    const readyItems = parsedData.filter(d => d.importStatus !== 'success');
    if (readyItems.length === 0) {
      notification.warning({ message: 'No valid projects', description: 'There are no projects ready to import.' });
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (let i = 0; i < parsedData.length; i++) {
      const item = parsedData[i];

      try {
        const pmIdToAssign = item.assignedProjectManagerId || currentPmId;
        console.log('Importing project payload:', {
          name: item.name,
          client: item.client,
          projectCode: item.code,
          totalHours: item.totalHours,
          approvedHours: item.totalHours,
          projectCategory: item.projectCategory,
          expectedStart: item.expectedStart,
          expectedEnd: item.expectedEnd,
          assignedProjectManagerId: pmIdToAssign,
          assignedTeamLeadId: item.assignedTeamLeadId,
          description: item.description,
          status: 'Approved'
        });
        // Create the project (default status as Approved for direct workflow availability)
        await projectService.createProject({
          name: item.name || 'Untitled Project',
          client: item.client || 'N/A',
          projectCode: item.code,
          totalHours: item.totalHours,
          approvedHours: item.totalHours,
          consumedHours: item.consumedHours,
          remainingHours: item.remainingHours,
          projectCategory: item.projectCategory,
          expectedStart: item.expectedStart,
          expectedEnd: item.expectedEnd,
          assignedProjectManagerId: pmIdToAssign,
          assignedTeamLeadId: item.assignedTeamLeadId,
          description: item.description,
          status: 'Approved' // auto-approve so it goes straight to dashboard
        });

        results.push({ ...item, importStatus: 'success' });
        successCount++;
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'API error';
        results.push({ ...item, importStatus: 'failed', importError: errorMsg });
        failCount++;
      }

      setProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    setImporting(false);
    setImportResults({ success: successCount, failed: failCount });
    setParsedData(results);
    onSuccess(); // refresh parent
    notification.success({
      message: 'Import Complete',
      description: `Successfully imported ${successCount} project(s). Failed: ${failCount}`
    });
  };

  const columns = [
    { title: 'Project Code', dataIndex: 'code', key: 'code', width: 120, fixed: 'left' },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    { title: 'Customer', dataIndex: 'client', key: 'client', width: 140, ellipsis: true },
    { title: 'Category', dataIndex: 'projectCategory', key: 'projectCategory', width: 120, render: (cat) => <Tag color="blue">{cat}</Tag> },
    { 
      title: 'Project Manager', 
      key: 'pm',
      width: 180,
      render: (_, record) => record.resolvedPMName ? (
        <Tag color="gold">✓ {record.resolvedPMName}</Tag>
      ) : <Text type="secondary">-</Text>
    },
    { title: 'Team Lead', key: 'tl', width: 180, render: (_, record) => record.resolvedTLName ? <Tag color="geekblue">✓ {record.resolvedTLName}</Tag> : (record.tlName ? <Tag color="warning" title="Team Lead not found">⚠️ Not Found ({record.tlName})</Tag> : <Text type="secondary">-</Text>) },
    { title: 'Start Date', dataIndex: 'expectedStart', key: 'expectedStart', width: 110, render: (d) => d || <Text type="secondary">-</Text> },
    { title: 'End Date', dataIndex: 'expectedEnd', key: 'expectedEnd', width: 110, render: (d) => d || <Text type="secondary">-</Text> },
    { title: 'Total Hours', dataIndex: 'totalHours', key: 'totalHours', width: 140, render: (h) => formatHoursToHrsMins(h) },
    { title: 'Utilized Hours', dataIndex: 'consumedHours', key: 'consumedHours', width: 140, render: (h) => formatHoursToHrsMins(h) },
    { title: 'Remaining Hours', dataIndex: 'remainingHours', key: 'remainingHours', width: 150, render: (h) => formatHoursToHrsMins(h) },
    { title: 'Description', dataIndex: 'description', key: 'description', width: 200, ellipsis: true, render: (d) => d || <Text type="secondary">No description</Text> },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      fixed: 'right',
      render: (_, record) => {
        if (record.importStatus === 'success') return <Tag color="green"><CheckCircleOutlined /> Success</Tag>;
        if (record.importStatus === 'failed') return <Tag color="red" title={record.importError}><CloseCircleOutlined /> Failed</Tag>;
        if (record.warningMsg) return <Tag color="error">{record.warningMsg}</Tag>;
        return <Tag color="processing">Ready</Tag>;
      }
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <FileExcelOutlined style={{ color: '#10b981', fontSize: 20 }} />
          <span style={{ fontWeight: 700 }}>Bulk Project Import (Excel/CSV)</span>
        </Space>
      }
      open={open}
      onCancel={importing ? undefined : handleClose}
      width={1050}
      footer={[
        <Button key="close" onClick={handleClose} disabled={importing}>
          Close
        </Button>,
        parsedData.length > 0 && !importResults && (
          <Button key="import" type="primary" onClick={startImport} loading={importing}>
            Import Projects
          </Button>
        )
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
        <Alert
          type="info"
          message="Excel/CSV Project Import Guideline"
          description={
            <div style={{ fontSize: 12 }}>
              Upload an Excel or CSV file containing project details. Columns should include: <strong>Project Name</strong>, <strong>Customer Name</strong>, <strong>Project Code</strong>, <strong>Project Category</strong>, <strong>Total Hours</strong>, <strong>Start Date</strong>, <strong>End Date</strong>, <strong>Project Manager</strong>, <strong>Team Lead</strong>, and <strong>Description</strong>.
              <br />
              <Link onClick={downloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', marginTop: 6, fontWeight: 600 }}>
                <DownloadOutlined style={{ marginRight: 4 }} /> Download Sample Template
              </Link>
            </div>
          }
          showIcon
        />

        {parsedData.length === 0 && (
          <Upload.Dragger
            accept=".xlsx, .xls, .csv"
            fileList={fileList}
            beforeUpload={handleUpload}
            showUploadList={false}
            style={{ padding: 24, borderRadius: 12 }}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ color: '#10b981', fontSize: 40 }} />
            </p>
            <p className="ant-upload-drag-text">Click or drag Excel/CSV template to this area to upload</p>
            <p className="ant-upload-hint">Supports .xlsx, .xls, and .csv files</p>
          </Upload.Dragger>
        )}

        {importing && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <Text strong>Importing projects... Please do not close this window.</Text>
            <Progress percent={progress} status="active" strokeColor="#10b981" style={{ marginTop: 8 }} />
          </div>
        )}

        {importResults && (
          <Alert
            type="success"
            message="Import Completed Successfully"
            description={`Successfully processed ${importResults.success} projects. Failures: ${importResults.failed}`}
            showIcon
            style={{ borderRadius: 8 }}
          />
        )}

        {parsedData.length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Preview Parsed Projects ({parsedData.length} total)</Text>
            <Table
              dataSource={parsedData}
              columns={columns}
              size="small"
              pagination={{ pageSize: 5 }}
              scroll={{ x: 1450 }}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: 13 }}>
                      <div><strong>Full Project Name:</strong> {record.name || '-'}</div>
                      <div><strong>Customer/Client:</strong> {record.client || '-'}</div>
                      <div><strong>Project Code:</strong> {record.code || '-'}</div>
                      <div><strong>Category:</strong> {record.projectCategory || '-'}</div>
                      <div><strong>Total Hours:</strong> {formatHoursToHrsMins(record.totalHours)}</div>
                      <div><strong>Utilized Hours:</strong> {formatHoursToHrsMins(record.consumedHours)}</div>
                      <div><strong>Remaining Hours:</strong> {formatHoursToHrsMins(record.remainingHours)}</div>
                      <div><strong>Start Date:</strong> {record.expectedStart || 'Not specified'}</div>
                      <div><strong>End Date:</strong> {record.expectedEnd || 'Not specified'}</div>
                      <div><strong>PM Assignment:</strong> {record.resolvedPMName || record.pmName || 'Default'}</div>
                      <div><strong>TL Assignment:</strong> {record.resolvedTLName || record.tlName || 'None'}</div>
                    </div>
                    {record.description && (
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        <strong>Description:</strong>
                        <div style={{ color: '#555', marginTop: 2, whiteSpace: 'pre-wrap' }}>{record.description}</div>
                      </div>
                    )}
                  </div>
                ),
                rowExpandable: () => true
              }}
              style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ExcelProjectUploadModal;
