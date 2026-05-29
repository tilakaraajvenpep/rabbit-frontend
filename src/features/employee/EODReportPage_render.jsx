
  // ─── Pre-render derived values ───────────────────────────────────────────
  const userId = currentUser?.userId || currentUser?.id;
  const selectedProject = allProjects.find(p => String(p.id) === String(selectedTopProjectId));
  const projectAllocatedHours = selectedProject ? Number(selectedProject.employeeAllocatedHours?.[userId] || 0) : 0;
  const projectHoursToday = (watchedItems || [])
    .filter(item => String(item.projectId) === String(selectedTopProjectId))
    .reduce((s, item) => s + (Number(item.hoursInput) || 0) + (Number(item.minutesInput) || 0) / 60, 0);
  const projectRemaining = Math.max(0, projectAllocatedHours - projectHoursToday);

  const showRestrictionResult = isOutsideCurrentWeek && !existingReport && !hasAccessForDate;
  const hasAccessPending = myAccessRequests.find(r => r.targetDate === selectedDate);
  const isSunday = dayjs(selectedDate).day() === 0;
  const isNextWeek = dayjs(selectedDate).isAfter(dayjs().endOf('week'));

  const bg = isDarkMode ? '#0d0f18' : '#f1f3f9';
  const card = isDarkMode ? '#161925' : '#ffffff';
  const border = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const accent = '#6366f1';
  const emerald = '#10b981';
  const t1 = isDarkMode ? '#f1f5f9' : '#0f172a';
  const t2 = isDarkMode ? '#94a3b8' : '#64748b';

  const fmtH = (dec) => {
    const h = Math.floor(dec); const m = Math.round((dec - h) * 60);
    if (!h && !m) return '0m';
    return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
  };

  const dayStatus = weeklyStatus[selectedDate];
  const { bg: stBg, text: stTxt, label: stLabel } = getStatusColorAndLabel(dayjs(selectedDate), dayStatus, totalHours);

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: bg, overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Button shape="circle" size="small" icon={<LeftOutlined style={{ fontSize: 10 }} />}
          onClick={() => { const d = dayjs(selectedDate).subtract(1, 'day'); setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); }} />
        <DatePicker value={dayjs(selectedDate)} allowClear={false} size="small" style={{ width: 136 }}
          onChange={d => { if (d) { setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); } }} />
        <Button shape="circle" size="small" icon={<RightOutlined style={{ fontSize: 10 }} />}
          onClick={() => { const d = dayjs(selectedDate).add(1, 'day'); setSelectedDate(d.format('YYYY-MM-DD')); setBaseDate(d.startOf('week').add(1, 'day')); }} />

        <div style={{ fontWeight: 800, fontSize: 15, color: t1, marginLeft: 4 }}>{dayjs(selectedDate).format('dddd, D MMM YYYY')}</div>
        <span style={{ background: stBg, color: stTxt, padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{stLabel}</span>

        <div style={{ flex: 1 }} />

        <Button size="small" onClick={handleGoToToday}>Today</Button>
        <Button size="small" icon={<CalendarOutlined />} style={{ borderColor: '#ec4899', color: '#ec4899' }}
          onClick={() => handleOpenApplyLeaveModal(selectedDate)}>Apply Leave</Button>
        {existingReport && viewOnly && (
          <Button size="small" type="primary" icon={<EditOutlined />}
            style={{ background: accent, borderColor: accent }} onClick={() => setViewOnly(false)}>Edit</Button>
        )}
        {existingReport && !viewOnly && (
          <Button size="small" onClick={() => { setViewOnly(true); reset(existingReport); }}>Cancel</Button>
        )}
        {!viewOnly && !isSunday && !isNextWeek && (
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={submitting}
            style={{ background: emerald, borderColor: emerald, fontWeight: 700 }}
            onClick={handleSubmit(onSubmit)}>Submit Report</Button>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: 252, background: card, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

          {/* Week strip */}
          <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: t2 }}>This Week</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button size="small" style={{ height: 20, width: 24, padding: 0, fontSize: 10 }} icon={<LeftOutlined />} onClick={handlePrevWeek} />
                <Button size="small" style={{ height: 20, width: 24, padding: 0, fontSize: 10 }} icon={<RightOutlined />} onClick={handleNextWeek} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {weekDates.map((d, i) => {
                const ds = d.format('YYYY-MM-DD');
                const sel = ds === selectedDate;
                const st = weeklyStatus[ds];
                const dotColors = { submitted: emerald, incomplete: '#ef4444', leave: '#3b82f6', half_leave: '#38bdf8', holiday: '#9ca3af', restricted: '#9ca3af', pending: '#f59e0b', optional: '#8b5cf6' };
                return (
                  <div key={i} onClick={() => { setSelectedDate(ds); setBaseDate(d.startOf('week').add(1, 'day')); }}
                    style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '5px 2px', borderRadius: 8,
                      background: sel ? `${accent}15` : 'transparent', border: `1.5px solid ${sel ? accent : 'transparent'}` }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: sel ? accent : t2 }}>{d.format('dd').toUpperCase()}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: sel ? accent : t1 }}>{d.format('D')}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColors[st] || '#cbd5e1' }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hours summary */}
          <div style={{ padding: '12px', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: t2, marginBottom: 8 }}>Hours Summary</div>
            {[
              { label: 'Weekly Quota', val: fmtH(allocatedHoursPerDay), color: accent },
              { label: 'Logged Today', val: fmtH(totalHours), color: '#f59e0b' },
              { label: 'Remaining', val: fmtH(Math.max(0, REQUIRED_HOURS - totalHours)), color: emerald },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: t2 }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.val}</span>
              </div>
            ))}
            {REQUIRED_HOURS > 0 && (
              <Progress size="small" showInfo={false} percent={Math.min(100, Math.round((totalHours / REQUIRED_HOURS) * 100))}
                strokeColor={totalHours > REQUIRED_HOURS ? '#ef4444' : accent} style={{ marginTop: 4 }} />
            )}
          </div>

          {/* Project selector */}
          <div style={{ padding: '12px', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: t2, marginBottom: 8 }}>Project</div>
            <Select placeholder="Select project" value={selectedTopProjectId} onChange={v => setSelectedTopProjectId(v)}
              style={{ width: '100%' }} size="small" showSearch
              filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
              options={allProjects.map(p => ({ value: p.id, label: p.name || p.projectName }))} />
            {selectedProject && (
              <div style={{ marginTop: 10, background: isDarkMode ? '#0b0d15' : '#f8f9ff', borderRadius: 8, padding: '10px 12px', border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: t2 }}>Allocated</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{fmtH(projectAllocatedHours)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: t2 }}>Remaining</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: projectRemaining > 0 ? emerald : '#ef4444' }}>{fmtH(projectRemaining)}</span>
                </div>
                <Progress size="small" showInfo={false}
                  percent={projectAllocatedHours > 0 ? Math.min(100, Math.round((projectHoursToday / projectAllocatedHours) * 100)) : 0}
                  strokeColor={emerald} />
              </div>
            )}
          </div>

          {/* Leave info */}
          {currentLeave && (
            <div style={{ padding: '10px 12px' }}>
              <Alert type="warning" showIcon style={{ fontSize: 11, borderRadius: 8 }}
                message={currentLeave.type === 'FullDay' ? 'Full Day Leave' : currentLeave.type === 'HalfDay' ? 'Half Day Leave' : 'Permission'} />
            </div>
          )}
        </div>

        {/* RIGHT MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {isSunday ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Result icon={<CheckCircleOutlined style={{ color: '#faad14' }} />} title="Happy Sunday!" subTitle="No EOD reporting required today. Rest & recharge." />
            </div>
          ) : isNextWeek ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Result icon={<CalendarOutlined style={{ color: accent }} />} title="Future Date" subTitle="You cannot log reports for future weeks." />
            </div>
          ) : showRestrictionResult ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
              <Result icon={<CalendarOutlined style={{ color: accent }} />} title="Reporting Restricted"
                subTitle="This date is outside your current week. Request access to log a report." />
              {!hasAccessPending && (
                <Button type="primary" style={{ background: accent, borderColor: accent }}
                  onClick={() => setIsAccessRequestModalOpen(true)}>Request Access</Button>
              )}
            </div>
          ) : (
            <>
              {/* Tasks header */}
              <div style={{ padding: '10px 20px', background: card, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: t1 }}>Task Entries</span>
                  <span style={{ fontSize: 12, color: t2 }}>{fields.length} task{fields.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Scrollable task list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fields.map((field, index) => {
                  const item = watchedItems?.[index] || {};
                  const rowProjId = item.projectId || selectedTopProjectId;
                  const rowTickets = rowProjId
                    ? myTickets.filter(t => String(t.projectId) === String(rowProjId))
                    : myTickets;
                  return (
                    <div key={field.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
                      {/* Row top */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: accent, flexShrink: 0 }}>{index + 1}</div>
                        {/* Project per row */}
                        <Controller control={control} name={`items.${index}.projectId`} render={({ field: f }) => (
                          <Select {...f} placeholder="Project" size="small" style={{ width: 180 }} disabled={viewOnly}
                            options={allProjects.map(p => ({ value: p.id, label: p.name || p.projectName }))}
                            onChange={v => { f.onChange(v); setValue(`items.${index}.ticketId`, ''); }} showSearch
                            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())} />
                        )} />
                        <div style={{ flex: 1 }} />
                        {/* Alert toggle */}
                        <Controller control={control} name="isAlertIssue" render={({ field: af }) => (
                          <Button size="small" icon={<AlertOutlined />} danger={af.value} type={af.value ? 'primary' : 'default'}
                            style={{ fontSize: 11, borderRadius: 6 }} onClick={() => af.onChange(!af.value)}>
                            {af.value ? 'Alert ON' : 'Alert'}
                          </Button>
                        )} />
                        {/* New ticket */}
                        {!viewOnly && (
                          <Button size="small" icon={<PlusOutlined />} style={{ fontSize: 11, borderRadius: 6 }}
                            onClick={() => { setActiveTicketRowIndex(index); ticketForm.setFieldsValue({ projectId: item.projectId || selectedTopProjectId }); setIsTicketModalOpen(true); }}>
                            New Ticket
                          </Button>
                        )}
                        {/* Delete */}
                        {!viewOnly && fields.length > 1 && (
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(index)} />
                        )}
                      </div>

                      {/* Ticket + Hours row */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }}>
                        <Controller control={control} name={`items.${index}.ticketId`} render={({ field: f }) => (
                          <Select {...f} placeholder="Select ticket / task category" size="small" style={{ flex: 1, minWidth: 200 }}
                            disabled={viewOnly} showSearch
                            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                            options={rowTickets.map(t => ({ value: t.id, label: `${t.code || '#' + t.id} — ${t.title || t.ticketTitle || ''}` }))} />
                        )} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <Controller control={control} name={`items.${index}.hoursInput`} render={({ field: f }) => (
                            <InputNumber {...f} min={0} max={24} size="small" style={{ width: 58 }} disabled={viewOnly} placeholder="0" />
                          )} />
                          <span style={{ fontSize: 11, color: t2, fontWeight: 600 }}>h</span>
                          <Controller control={control} name={`items.${index}.minutesInput`} render={({ field: f }) => (
                            <InputNumber {...f} min={0} max={59} size="small" style={{ width: 58 }} disabled={viewOnly} placeholder="0" />
                          )} />
                          <span style={{ fontSize: 11, color: t2, fontWeight: 600 }}>m</span>
                        </div>
                      </div>

                      {/* Description */}
                      <Controller control={control} name={`items.${index}.workDone`} render={({ field: f }) => (
                        <TextArea {...f} rows={2} disabled={viewOnly} placeholder="Describe work done for this task..." style={{ resize: 'none', fontSize: 12, borderRadius: 8 }} />
                      )} />

                      {/* Alert message (only on first row when alert is ON) */}
                      {index === 0 && (
                        <Controller control={control} name="isAlertIssue" render={({ field: af }) => af.value ? (
                          <div style={{ marginTop: 8 }}>
                            <Controller control={control} name="alertMessage" render={({ field: f }) => (
                              <Input {...f} prefix={<WarningOutlined style={{ color: '#ef4444' }} />}
                                placeholder="Describe the blocker or critical issue..." disabled={viewOnly}
                                style={{ borderRadius: 8, borderColor: '#ef4444', fontSize: 12 }} />
                            )} />
                          </div>
                        ) : null} />
                      )}
                    </div>
                  );
                })}

                {/* Add task */}
                {!viewOnly && (
                  <button onClick={() => append({ projectId: selectedTopProjectId || allProjects[0]?.id || '', ticketId: '', hoursInput: 0, minutesInput: 0, workDone: '' })}
                    style={{ width: '100%', height: 44, border: `2px dashed ${accent}60`, borderRadius: 10, background: 'transparent', color: accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Another Task for this Project
                  </button>
                )}
              </div>

              {/* Footer submit */}
              <div style={{ padding: '10px 20px', borderTop: `1px solid ${border}`, background: card, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                {!viewOnly && (
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={submitting}
                    style={{ background: emerald, borderColor: emerald, height: 38, fontWeight: 700, fontSize: 13, paddingInline: 28 }}
                    onClick={handleSubmit(onSubmit)}>Submit EOD Report</Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      <Modal title="Apply for Leave" open={isLeaveModalOpen} onCancel={() => setIsLeaveModalOpen(false)} footer={null} destroyOnClose>
        <Form form={leaveForm} layout="vertical" onFinish={handleApplyLeaveSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="fromDate" label="From Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="toDate" label="To Date (optional)"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="Leave Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'FullDay', label: 'Full Day Leave' }, { value: 'HalfDay', label: 'Half Day Leave' }, { value: 'Permission', label: 'Permission (< 2 hrs)' }]} />
          </Form.Item>
          <Form.Item name="reason" label="Reason"><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={leaveApplying} block style={{ background: accent, borderColor: accent }}>Submit Leave Request</Button>
        </Form>
      </Modal>

      <Modal title="Create New Ticket" open={isTicketModalOpen} onCancel={() => setIsTicketModalOpen(false)} footer={null} destroyOnClose>
        <Form form={ticketForm} layout="vertical" onFinish={handleCreateTicket} style={{ marginTop: 16 }}>
          <Form.Item name="projectId" label="Project" rules={[{ required: true }]}>
            <Select options={allProjects.map(p => ({ value: p.id, label: p.name || p.projectName }))} />
          </Form.Item>
          <Form.Item name="title" label="Ticket Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={newTicketLoading} block>Create Ticket</Button>
        </Form>
      </Modal>

      <Modal title="Hours Exceeded — Action Required" open={isHoursBlockedModalOpen} onCancel={() => setIsHoursBlockedModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsHoursBlockedModalOpen(false)}>Cancel</Button>,
          <Button key="req" type="primary" danger onClick={() => { setIsHoursBlockedModalOpen(false); const t = watchedItems?.[0]; handleOpenRequestModal('ExceededLimit', { id: t?.ticketId, title: 'EOD Report' }); }}>Request Additional Hours</Button>
        ]}>
        <Result icon={<ExclamationCircleFilled style={{ color: '#ff4d4f' }} />}
          title={`${fmtH(blockedSubmitTotal)} exceeds your quota`}
          subTitle="You must request additional hours approval before submitting." />
      </Modal>

      <Modal title="Request Additional Hours" open={isRequestModalOpen} onCancel={() => setIsRequestModalOpen(false)} footer={null} destroyOnClose>
        <Form form={requestForm} layout="vertical" onFinish={handleRequestSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="ticketId" hidden><Input /></Form.Item>
          <Form.Item name="requestType" label="Request Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'TimerMissed', label: 'Timer Missed' }, { value: 'ExceededLimit', label: 'Hours Exceeded' }]} />
          </Form.Item>
          {!['TeamLead', 'ProjectManager', 'TenantAdmin'].includes(role) && (
            <Form.Item name="teamLeadId" label="Team Lead" rules={[{ required: true }]}>
              <Select options={teamLeads.map(tl => ({ value: tl.id || tl.userId, label: tl.fullName || tl.name }))} />
            </Form.Item>
          )}
          <Form.Item name="requestedHours" label="Requested Hours" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={requesting} block>Submit Request</Button>
        </Form>
      </Modal>

      <Modal title="Request Report Access" open={isAccessRequestModalOpen} onCancel={() => setIsAccessRequestModalOpen(false)} footer={null} destroyOnClose>
        <Form form={accessRequestForm} layout="vertical" style={{ marginTop: 16 }}
          onFinish={async (vals) => {
            setAccessRequestSubmitting(true);
            try {
              await reportAccessService.createRequest({ targetDate: selectedDate, reason: vals.reason, requestType: accessRequestType });
              notification.success({ message: 'Access Request Submitted' });
              setIsAccessRequestModalOpen(false);
            } catch { notification.error({ message: 'Failed to submit' }); }
            finally { setAccessRequestSubmitting(false); }
          }}>
          <Form.Item name="reason" label="Reason for access" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={accessRequestSubmitting} block>Submit Request</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default EODReportPage;
