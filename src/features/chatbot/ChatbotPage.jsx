import React, { useState, useRef, useEffect } from 'react';
import { 
  Layout, Menu, Input, Button, Avatar, Card, Space, 
  Typography, List, Tag, Table, Divider, Skeleton 
} from 'antd';
import { 
  SendOutlined, 
  PlusOutlined, 
  UserOutlined, 
  RobotOutlined,
  MessageOutlined,
  WarningOutlined,
  ProjectOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useChatStore } from '../../store/chatStore';
import { chatbotService } from '../../services/chatbotService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import HoursProgress from '../../components/common/HoursProgress';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const ChatbotPage = () => {
  const { sessions, activeSessionId, messages, isTyping, addMessage, setTyping, startNewSession, selectSession } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (val = inputValue) => {
    if (!val.trim()) return;

    const userMsg = { role: 'user', type: 'text', content: val };
    addMessage(userMsg);
    setInputValue('');
    setTyping(true);

    try {
      const response = await chatbotService.sendQuery(val);
      addMessage({ role: 'bot', ...response });
    } catch (error) {
      addMessage({ role: 'bot', type: 'text', content: 'Sorry, I encountered an error. Please try again.' });
    } finally {
      setTyping(false);
    }
  };

  const renderResponseCard = (msg) => {
    switch (msg.type) {
      case 'report':
        return (
          <Card title={msg.title} size="small" style={{ width: '100%' }}>
            <Table 
              size="small" 
              pagination={false} 
              dataSource={msg.data}
              columns={[
                { title: 'Employee', dataIndex: 'employeeName', key: 'name' },
                { title: 'Project', dataIndex: 'projectName', key: 'project' },
                { title: 'Hrs', dataIndex: 'totalHours', key: 'hrs' }
              ]}
            />
            <Button type="link" size="small" style={{ marginTop: 8 }}>View Full Reports</Button>
          </Card>
        );
      case 'alerts':
        return (
          <Card title={msg.title} size="small" style={{ width: '100%' }}>
            <List
              size="small"
              dataSource={msg.data}
              renderItem={item => (
                <List.Item>
                  <Space>
                    <WarningOutlined style={{ color: item.severity === 'Critical' ? '#ff4d4f' : '#fa8c16' }} />
                    <Text>{item.message}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        );
      case 'project':
        return (
          <Card title={msg.title} size="small" style={{ width: '100%' }}>
            <div style={{ marginBottom: 12 }}>
              <StatusBadge status={msg.data.status} />
              <Divider type="vertical" />
              <Text type="secondary">{msg.data.client}</Text>
            </div>
            <HoursProgress consumed={msg.data.consumedHours} total={msg.data.approvedHours} />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>Approved Budget: ₹{msg.data.approvedBudget.toLocaleString('en-IN')}</Text>
            </div>
          </Card>
        );
      default:
        return <Paragraph>{msg.content}</Paragraph>;
    }
  };

  return (
    <Layout style={{ height: 'calc(100vh - 112px)', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
      <Sider width={240} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 16 }}>
          <Button type="primary" block icon={<PlusOutlined />} onClick={startNewSession}>New Chat</Button>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeSessionId]}
          onClick={({ key }) => selectSession(key)}
          items={sessions.map(s => ({
            key: s.id,
            icon: <MessageOutlined />,
            label: (
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.title}
                <div style={{ fontSize: '10px', color: '#bfbfbf' }}>{dayjs(s.date).format('DD MMM')}</div>
              </div>
            )
          }))}
        />
      </Sider>

      <Layout style={{ background: '#fff' }}>
        <Content style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}>
            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 12 }} />
            <div>
              <Title level={5} style={{ margin: 0 }}>Rabbit Assistant</Title>
              <Text type="secondary" style={{ fontSize: '12px' }}>AI-Powered Project Insights</Text>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 24 }}>
                <div style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', maxWidth: '80%' }}>
                  <Avatar 
                    icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} 
                    style={{ backgroundColor: msg.role === 'user' ? '#87d068' : '#1890ff', flexShrink: 0 }}
                  />
                  <div style={{ margin: msg.role === 'user' ? '0 12px 0 0' : '0 0 0 12px' }}>
                    <div style={{ 
                      padding: msg.type === 'text' ? '12px 16px' : '0',
                      background: msg.role === 'user' ? '#f0f0f0' : (msg.type === 'text' ? '#e6f7ff' : 'transparent'),
                      borderRadius: 12,
                      boxShadow: msg.type !== 'text' ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      {renderResponseCard(msg)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#bfbfbf', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {dayjs(msg.timestamp).format('HH:mm')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', marginBottom: 24 }}>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 12 }} />
                <Card size="small" style={{ borderRadius: 12, background: '#f5f5f5' }}>
                  <Space>
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </Space>
                </Card>
              </div>
            )}
          </div>

          <div style={{ padding: '24px', borderTop: '1px solid #f0f0f0' }}>
            {messages.length === 1 && (
              <div style={{ marginBottom: 16 }}>
                <Space wrap>
                  <Tag style={{ cursor: 'pointer' }} onClick={() => handleSend("Today's report")}>Today's report</Tag>
                  <Tag style={{ cursor: 'pointer' }} onClick={() => handleSend("Critical alerts")}>Critical alerts</Tag>
                  <Tag style={{ cursor: 'pointer' }} onClick={() => handleSend("Status of project")}>Project status</Tag>
                  <Tag style={{ cursor: 'pointer' }} onClick={() => handleSend("Missing reports today")}>Missing reports</Tag>
                </Space>
              </div>
            )}
            <Input.Search
              placeholder="Ask Rabbit anything..."
              size="large"
              enterButton={<SendOutlined />}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onSearch={handleSend}
              loading={isTyping}
              disabled={isTyping}
            />
          </div>
        </Content>
      </Layout>

      <style>{`
        .typing-dot {
          width: 6px;
          height: 6px;
          background: #bfbfbf;
          border-radius: 50%;
          animation: typing 1s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </Layout>
  );
};

export default ChatbotPage;
