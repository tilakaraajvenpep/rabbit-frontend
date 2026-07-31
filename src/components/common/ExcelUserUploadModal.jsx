import React, { useState } from 'react';
import { Modal, Upload, Button, Table, Tag, Space, Progress, Alert, Typography, notification } from 'antd';
import { UploadOutlined, FileExcelOutlined, CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { adminService } from '../../services/adminService';

const { Text, Link } = Typography;

const ExcelUserUploadModal = ({ open, onClose, onSuccess, existingUsers = [] }) => {
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
        "Full Name": "John Doe",
        "Email": "john.doe@company.com",
        "Role": "Employee",
        "Reporting Team Lead": "TL Name or Email",
        "Project Manager": "PM Name or Email",
        "Cost Per Hour": 150,
        "Password": "SecurePassword123!"
      },
      {
        "Full Name": "Jane Smith",
        "Email": "jane.smith@company.com",
        "Role": "TeamLead",
        "Reporting Team Lead": "",
        "Project Manager": "PM Name or Email",
        "Cost Per Hour": 200,
        "Password": "AnotherPassword456!"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users Template");
    XLSX.writeFile(workbook, "user_import_template.xlsx");
  };

  const normalizeHeader = (header) => {
    return header.toString().toLowerCase().trim().replace(/[\s_-]/g, '');
  };

  const normalizeRole = (roleStr) => {
    if (!roleStr) return 'Employee';
    const clean = roleStr.toString().trim().toLowerCase().replace(/[\s_-]/g, '');
    if (clean === 'pm' || clean === 'projectmanager') return 'ProjectManager';
    if (clean === 'teamlead' || clean === 'lead' || clean === 'tl') return 'TeamLead';
    if (clean === 'employee' || clean === 'emp') return 'Employee';
    if (clean === 'hr') return 'HR';
    if (clean === 'accounts' || clean === 'acc') return 'Accounts';
    if (clean === 'sales') return 'Sales';
    // Capitalize first letter as fallback
    return roleStr.charAt(0).toUpperCase() + roleStr.slice(1);
  };

  const findUser = (nameOrEmail, expectedRole) => {
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

    // 3. Match by full name (partial)
    found = existingUsers.find(u => {
      const name = (u.name || u.fullName || '').toLowerCase();
      return name.includes(cleanSearch);
    });
    return found || null;
  };

  const handleUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          notification.warning({ message: 'Empty Sheet', description: 'No rows found in the uploaded excel sheet.' });
          return;
        }

        // Process rows and map columns
        const parsedRows = json.map((row, idx) => {
          let name = '';
          let email = '';
          let role = 'Employee';
          let tlVal = '';
          let pmVal = '';
          let costPerHourVal = 0;
          let passwordVal = '';

          Object.keys(row).forEach(key => {
            const normalizedKey = normalizeHeader(key);
            if (normalizedKey.includes('name') || normalizedKey === 'user') {
              name = row[key];
            } else if (normalizedKey.includes('email') || normalizedKey.includes('mail') || normalizedKey === 'login' || normalizedKey === 'id') {
              email = row[key];
            } else if (normalizedKey.includes('role') || normalizedKey.includes('designation')) {
              role = normalizeRole(row[key]);
            } else if (normalizedKey.includes('teamlead') || normalizedKey.includes('tl') || normalizedKey.includes('lead')) {
              tlVal = row[key];
            } else if (normalizedKey.includes('projectmanager') || normalizedKey.includes('pm') || normalizedKey.includes('manager')) {
              pmVal = row[key];
            } else if (normalizedKey.includes('costperhour') || normalizedKey.includes('cost') || normalizedKey.includes('rate')) {
              costPerHourVal = row[key];
            } else if (normalizedKey.includes('password') || normalizedKey.includes('pwd') || normalizedKey.includes('pass')) {
              passwordVal = row[key];
            }
          });

          // Simple email validation regex
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const isEmailValid = email && emailRegex.test(email.toString().trim());

          let status = 'ready';
          let errorMsg = '';
          if (!name) {
            status = 'error';
            errorMsg = 'Name is missing';
          } else if (!isEmailValid) {
            status = 'error';
            errorMsg = 'Invalid email';
          }

          return {
            key: idx,
            name: name?.toString().trim() || '',
            email: email?.toString().trim() || '',
            role,
            tlName: tlVal?.toString().trim() || '',
            pmName: pmVal?.toString().trim() || '',
            costPerHour: costPerHourVal ? Number(costPerHourVal) : 0,
            password: passwordVal?.toString().trim() || '',
            status,
            errorMsg
          };
        });

        // Pass 2: Resolve references against both DB and other sheet rows
        const mapped = parsedRows.map((item) => {
          const findUserInEither = (nameOrEmail) => {
            if (!nameOrEmail) return null;
            const cleanSearch = nameOrEmail.toString().trim().toLowerCase();

            // 1. Look in existing db users
            let found = existingUsers.find(u => u.email && u.email.toLowerCase() === cleanSearch);
            if (found) return found;
            found = existingUsers.find(u => {
              const n = (u.name || u.fullName || '').toLowerCase();
              return n === cleanSearch || n.includes(cleanSearch);
            });
            if (found) return found;

            // 2. Look in the parsed rows from excel
            found = parsedRows.find(u => u.email && u.email.toLowerCase() === cleanSearch);
            if (found) return found;
            found = parsedRows.find(u => {
              const n = (u.name || '').toLowerCase();
              return n === cleanSearch || n.includes(cleanSearch);
            });
            if (found) return found;

            return null;
          };

          const resolvedTL = findUserInEither(item.tlName);
          const resolvedPM = findUserInEither(item.pmName);

          return {
            ...item,
            teamLeadId: resolvedTL ? (resolvedTL.id || resolvedTL.userId || null) : null,
            projectManagerId: resolvedPM ? (resolvedPM.id || resolvedPM.userId || null) : null,
            resolvedTLName: resolvedTL ? (resolvedTL.name || resolvedTL.fullName || resolvedTL.name) : null,
            resolvedPMName: resolvedPM ? (resolvedPM.name || resolvedPM.fullName || resolvedPM.name) : null,
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
    const readyItems = parsedData.filter(d => d.status === 'ready');
    if (readyItems.length === 0) {
      notification.warning({ message: 'No valid users', description: 'There are no users ready to import.' });
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failCount = 0;
    const results = [...parsedData];

    // Build a map of resolved user IDs (existing users first)
    const resolvedIdsMap = new Map();
    existingUsers.forEach(u => {
      const id = u.id || u.userId;
      if (id) {
        if (u.email) resolvedIdsMap.set(u.email.toLowerCase().trim(), id);
        if (u.name || u.fullName) resolvedIdsMap.set((u.name || u.fullName).toLowerCase().trim(), id);
      }
    });

    // Helper to get role order priority
    const getRolePriority = (role) => {
      const r = role.toLowerCase();
      if (r === 'projectmanager' || r === 'tenantadmin') return 1;
      if (r === 'teamlead') return 2;
      return 3;
    };

    // Sort ready items by role priority so managers/leads are created first
    const sortedReadyItems = [...readyItems].sort((a, b) => getRolePriority(a.role) - getRolePriority(b.role));

    for (let i = 0; i < sortedReadyItems.length; i++) {
      const item = sortedReadyItems[i];
      
      // Try to resolve teamLeadId and projectManagerId if they weren't resolved from db originally
      let tlId = item.teamLeadId;
      if (!tlId && item.tlName) {
        tlId = resolvedIdsMap.get(item.tlName.toLowerCase().trim()) || null;
      }
      let pmId = item.projectManagerId;
      if (!pmId && item.pmName) {
        pmId = resolvedIdsMap.get(item.pmName.toLowerCase().trim()) || null;
      }

      try {
        // Invite the user
        const res = await adminService.inviteUser({
          fullName: item.name,
          email: item.email,
          role: item.role,
          teamLeadId: tlId,
          projectManagerId: pmId,
          costPerHour: item.costPerHour,
          password: item.password || 'Rabbit@123'
        });

        const createdUser = res?.data?.data || res?.data;
        const newId = createdUser?.userId || createdUser?.id;

        if (newId) {
          if (item.email) resolvedIdsMap.set(item.email.toLowerCase().trim(), newId);
          if (item.name) resolvedIdsMap.set(item.name.toLowerCase().trim(), newId);
        }

        // Find index of item in results and update status
        const idx = results.findIndex(r => r.key === item.key);
        if (idx !== -1) {
          results[idx] = { ...results[idx], importStatus: 'success', teamLeadId: tlId, projectManagerId: pmId };
        }
        successCount++;
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'API error';
        const idx = results.findIndex(r => r.key === item.key);
        if (idx !== -1) {
          results[idx] = { ...results[idx], importStatus: 'failed', importError: errorMsg };
        }
        failCount++;
      }

      setProgress(Math.round(((i + 1) / sortedReadyItems.length) * 100));
    }

    setImporting(false);
    setImportResults({ success: successCount, failed: failCount });
    setParsedData(results);
    onSuccess(); // refresh parent component data
    notification.success({
      message: 'Import Complete',
      description: `Successfully imported ${successCount} user(s). Failed: ${failCount}`
    });
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, fixed: 'left' },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 180, ellipsis: true },
    { title: 'Role', dataIndex: 'role', key: 'role', width: 120, render: (role) => <Tag color="blue">{role}</Tag> },
    { 
      title: 'Team Lead', 
      key: 'tl',
      width: 170,
      render: (_, record) => record.resolvedTLName ? (
        <Tag color="success">✓ {record.resolvedTLName}</Tag>
      ) : record.tlName ? (
        <Tag color="warning" title="Team Lead not found by this name/email">⚠️ Not Found ({record.tlName})</Tag>
      ) : <Text type="secondary">-</Text>
    },
    { 
      title: 'Project Manager', 
      key: 'pm',
      width: 170,
      render: (_, record) => record.resolvedPMName ? (
        <Tag color="gold">✓ {record.resolvedPMName}</Tag>
      ) : record.pmName ? (
        <Tag color="warning" title="PM not found by this name/email">⚠️ Not Found ({record.pmName})</Tag>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: 'Cost/Hr',
      dataIndex: 'costPerHour',
      key: 'costPerHour',
      width: 100,
      render: (cost) => <Text>₹{cost}/hr</Text>
    },
    {
      title: 'Password',
      dataIndex: 'password',
      key: 'password',
      width: 110,
      render: (pwd) => <Text type="secondary">{pwd ? '••••••••' : 'Default'}</Text>
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        if (record.importStatus === 'success') return <Tag color="green"><CheckCircleOutlined /> Success</Tag>;
        if (record.importStatus === 'failed') return <Tag color="red" title={record.importError}><CloseCircleOutlined /> Failed</Tag>;
        if (record.status === 'error') return <Tag color="red">{record.errorMsg}</Tag>;
        return <Tag color="processing">Ready</Tag>;
      }
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <FileExcelOutlined style={{ color: '#10b981', fontSize: 20 }} />
          <span style={{ fontWeight: 700 }}>Bulk User Import (Excel/CSV)</span>
        </Space>
      }
      open={open}
      onCancel={importing ? undefined : handleClose}
      width={950}
      footer={[
        <Button key="close" onClick={handleClose} disabled={importing}>
          Close
        </Button>,
        parsedData.length > 0 && !importResults && (
          <Button key="import" type="primary" onClick={startImport} loading={importing}>
            Import Users
          </Button>
        )
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
        <Alert
          type="info"
          message="Excel/CSV Import Guideline"
          description={
            <div style={{ fontSize: 12 }}>
              Upload an Excel or CSV file containing user details. Columns should include: <strong>Full Name</strong>, <strong>Email</strong>, <strong>Role</strong>, <strong>Reporting Team Lead</strong>, <strong>Project Manager</strong>, <strong>Cost Per Hour</strong>, and <strong>Password</strong>.
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
            <p className="ant-upload-text">Click or drag Excel/CSV template to this area to upload</p>
            <p className="ant-upload-hint">Supports .xlsx, .xls, and .csv files</p>
          </Upload.Dragger>
        )}

        {importing && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <Text strong>Importing users... Please do not close this window.</Text>
            <Progress percent={progress} status="active" strokeColor="#10b981" style={{ marginTop: 8 }} />
          </div>
        )}

        {importResults && (
          <Alert
            type="success"
            message="Import Completed Successfully"
            description={`Successfully processed ${importResults.success} users. Failures: ${importResults.failed}`}
            showIcon
            style={{ borderRadius: 8 }}
          />
        )}

        {parsedData.length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Preview Parsed Users ({parsedData.length} total)</Text>
            <Table
              dataSource={parsedData}
              columns={columns}
              size="small"
              pagination={{ pageSize: 5 }}
              scroll={{ x: 1050 }}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div><strong>Full Name:</strong> {record.name}</div>
                      <div><strong>Email:</strong> {record.email}</div>
                      <div><strong>Role:</strong> {record.role}</div>
                      <div><strong>Hourly Rate:</strong> ₹{record.costPerHour}/hr</div>
                      <div><strong>Reporting TL:</strong> {record.resolvedTLName || record.tlName || 'None'}</div>
                      <div><strong>Assigned PM:</strong> {record.resolvedPMName || record.pmName || 'None'}</div>
                      <div><strong>Password:</strong> {record.password || 'Default (Rabbit@123)'}</div>
                    </div>
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

export default ExcelUserUploadModal;
