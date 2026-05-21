import React, { useState, useRef, useEffect } from 'react';
import { Drawer, Input, Button, Avatar, Typography, List, Space, Tag, Divider, Skeleton, Card, Table, theme } from 'antd';
import { 
  SendOutlined, 
  RobotOutlined, 
  UserOutlined, 
  CloseOutlined, 
  MessageOutlined,
  WarningOutlined,
  ProjectOutlined,
  InfoCircleOutlined,
  SparklesOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useChatStore } from '../../store/chatStore';
import { chatbotService } from '../../services/chatbotService';
import StatusBadge from './StatusBadge';
import HoursProgress from './HoursProgress';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text, Paragraph } = Typography;

const AssistantDrawer = ({ open, onClose }) => {
  const { messages, isTyping, addMessage, setTyping } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef(null);
  const { token } = theme.useToken();
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (val = inputValue) => {
    if (!val.trim()) return;

    const userMsg = { role: 'user', type: 'text', content: val, timestamp: new Date() };
    addMessage(userMsg);
    setInputValue('');
    setTyping(true);

    try {
      const response = await chatbotService.sendQuery(val);
      addMessage({ role: 'bot', ...response, timestamp: new Date() });
    } catch (error) {
      addMessage({ role: 'bot', type: 'text', content: 'Sorry, I encountered an error.', timestamp: new Date() });
    } finally {
      setTyping(false);
    }
  };

  const renderResponseCard = (msg) => {
    switch (msg.type) {
      case 'report':
        return (
          <Card 
            size="small" 
            style={{ 
              width: '100%', 
              borderRadius: 12, 
              border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0',
              background: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              overflow: 'hidden'
            }}
            bodyStyle={{ padding: 8 }}
          >
            <Table 
              size="small" 
              pagination={false} 
              dataSource={msg.data}
              columns={[
                { title: 'Emp', dataIndex: 'employeeName', key: 'name', render: t => <Text strong style={{ fontSize: 12 }}>{t}</Text> },
                { title: 'Project', dataIndex: 'projectName', key: 'project', render: t => <Text style={{ fontSize: 11 }}>{t}</Text> },
                { title: 'Hrs', dataIndex: 'totalHours', key: 'hrs', render: t => <Tag color="blue" style={{ margin: 0 }}>{t}h</Tag> }
              ]}
            />
          </Card>
        );
      case 'alerts':
        return (
          <Card 
            size="small" 
            style={{ 
              width: '100%', 
              borderRadius: 12, 
              border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0',
              background: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            <List
              size="small"
              dataSource={msg.data}
              renderItem={item => (
                <List.Item style={{ padding: '6px 0', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f5f5f5' }}>
                  <Space align="start">
                    <WarningOutlined style={{ color: item.severity === 'Critical' ? '#ef4444' : '#f59e0b', marginTop: 3 }} />
                    <Text style={{ fontSize: 12 }}>{item.message}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        );
      case 'project':
        return (
          <Card 
            size="small" 
            style={{ 
              width: '100%', 
              borderRadius: 12, 
              border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0',
              background: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <Title level={5} style={{ margin: 0, fontSize: 14 }}>{msg.title}</Title>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Status</Text>
              <StatusBadge status={msg.data.status} />
            </div>
            <HoursProgress consumed={msg.data.consumedHours} total={msg.data.approvedHours} />
          </Card>
        );
      default:
        return (
          <Paragraph 
            style={{ 
              margin: 0, 
              lineHeight: 1.5, 
              fontSize: 13,
              color: msg.role === 'user' ? '#fff' : (isDarkMode ? 'rgba(255,255,255,0.9)' : '#1f2937')
            }}
          >
            {msg.content}
          </Paragraph>
        );
    }
  };

  return (
    <Drawer
      title={
        <Space size={12}>
          <div style={{ position: 'relative' }}>
            <Avatar 
              icon={<RobotOutlined />} 
              style={{ 
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
              }} 
            />
            <span style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#10b981',
              border: `2px solid ${isDarkMode ? '#1e1e1e' : '#fff'}`,
              boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.4)'
            }} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.2 }}>Rabbit Assistant</div>
            <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>Active Online</div>
          </div>
        </Space>
      }
      placement="right"
      width={420}
      onClose={onClose}
      open={open}
      closeIcon={<CloseOutlined style={{ fontSize: 16 }} />}
      drawerStyle={{
        background: isDarkMode ? '#141414' : '#f8fafc',
      }}
      headerStyle={{
        borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
        padding: '16px 24px',
        background: isDarkMode ? '#18181b' : '#fff',
      }}
      footerStyle={{
        borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
        padding: '16px 20px',
        background: isDarkMode ? '#18181b' : '#fff',
      }}
      footer={
        <div>
          {messages.length < 3 && (
            <div style={{ marginBottom: 14 }}>
              <Space wrap size={8}>
                {["Today's reports", "Critical alerts", "Project status"].map(tag => (
                  <Tag 
                    key={tag} 
                    style={{ 
                      cursor: 'pointer', 
                      borderRadius: 20,
                      padding: '4px 12px',
                      background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                      color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#475569',
                      transition: 'all 0.2s',
                      fontWeight: 500,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#6366f1';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.borderColor = '#6366f1';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.04)' : '#f1f5f9';
                      e.currentTarget.style.color = isDarkMode ? 'rgba(255,255,255,0.8)' : '#475569';
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
                    }}
                    onClick={() => handleSend(tag)}
                  >
                    {tag}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Input
              placeholder="Type your message here..."
              size="large"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={() => handleSend()}
              disabled={isTyping}
              style={{
                borderRadius: 24,
                paddingRight: 50,
                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1',
                background: isDarkMode ? '#27272a' : '#fff',
                height: 48,
                fontSize: 14
              }}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined style={{ fontSize: 14 }} />}
              onClick={() => handleSend()}
              loading={isTyping}
              disabled={!inputValue.trim() || isTyping}
              style={{
                position: 'absolute',
                right: 6,
                height: 36,
                width: 36,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: 'none',
                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </div>
        </div>
      }
    >
      <div 
        ref={scrollRef} 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          paddingRight: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, 
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(79,70,229,0.05) 100%)',
              display: 'flex', alignItems: 'center', justify: 'center', fontSize: 32, color: '#6366f1',
              boxShadow: 'inset 0 0 12px rgba(99, 102, 241, 0.1)'
            }}>
              🤖
            </div>
            <div>
              <Title level={5} style={{ margin: 0, fontSize: 16 }}>How can I help you today?</Title>
              <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                Ask me about employee reports, project progression, active flags or workspace metrics.
              </Paragraph>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={idx} 
              style={{ 
                display: 'flex', 
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                alignItems: 'start',
                gap: 8
              }}
            >
              {!isUser && (
                <Avatar 
                  size={28}
                  icon={<RobotOutlined />} 
                  style={{ 
                    background: isDarkMode ? '#27272a' : '#e2e8f0',
                    color: '#6366f1',
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1'
                  }} 
                />
              )}
              <div style={{ 
                maxWidth: '80%', 
                padding: msg.type === 'text' ? '12px 16px' : '6px',
                background: isUser 
                  ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' 
                  : (isDarkMode ? '#1e1e24' : '#fff'),
                color: isUser ? '#fff' : (isDarkMode ? '#f4f4f5' : '#1f2937'),
                borderRadius: isUser ? '18px 18px 2px 18px' : '2px 18px 18px 18px',
                boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.03)',
                border: !isUser ? (isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0') : 'none'
              }}>
                {renderResponseCard(msg)}
                <div style={{ 
                  fontSize: '9px', 
                  color: isUser ? 'rgba(255,255,255,0.7)' : '#9ca3af', 
                  marginTop: 6, 
                  textAlign: 'right' 
                }}>
                  {dayjs(msg.timestamp).format('HH:mm')}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
            <Avatar 
              size={28}
              icon={<RobotOutlined />} 
              style={{ 
                background: isDarkMode ? '#27272a' : '#e2e8f0',
                color: '#6366f1',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1'
              }} 
            />
            <div style={{ 
              background: isDarkMode ? '#1e1e24' : '#fff', 
              padding: '12px 18px', 
              borderRadius: '2px 18px 18px 18px',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
              <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block', animationDelay: '0.2s' }} />
              <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block', animationDelay: '0.4s' }} />
              
              <style>{`
                @keyframes typingBounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-4px); }
                }
                .typing-dot {
                  animation: typingBounce 1s infinite ease-in-out;
                }
              `}</style>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default AssistantDrawer;
